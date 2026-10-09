import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { it } from 'node:test';
import { createDataLayer } from '../src/db/service';
import type { Fingerprinter } from '../src/imports/fingerprint';
import { transactions } from '../src/db/schema';
import { ledgerMigrations, openTestLedger } from './helpers/ledger';

const testFingerprinter: Fingerprinter = {
  keyId: 'c'.repeat(64),
  async fingerprint(value) {
    return createHmac('sha256', 'fictional-paste-test-key').update(value).digest('hex');
  },
};

it('composes manual entry, corrections, monthly budgets, bills and CSV with shared spend rules', async () => {
  const fixture = openTestLedger();
  const api = createDataLayer(fixture.client, ledgerMigrations);
  try {
    assert.equal('db' in api, false);
    assert.equal('insertReviewedPaste' in api, false);
    assert.equal('upsertImportedTransaction' in api, false);
    await api.migrateLedger();
    await api.createCategory({ id: 'food', name: 'Fictional food', kind: 'expense' });
    await api.setBudget({ id: 'budget', categoryId: 'food', month: '2026-10', amountPaise: 40000 });
    await api.saveManualEntry({ id: 'expense', amountInr: '450.50', direction: 'debit', categoryId: 'food', occurredAt: new Date('2026-10-07T12:00:00Z') });
    let budget = (await api.getBudgetSummary('2026-10'))[0]!;
    assert.equal(budget.spentPaise, 45050);
    assert.equal(budget.remainingPaise, -5050);
    assert.equal(budget.overBudget, true);
    await api.editTransaction('expense', { amountPaise: 35000 });
    budget = (await api.getBudgetSummary('2026-10'))[0]!;
    assert.equal(budget.remainingPaise, 5000);
    await api.softDeleteTransaction('expense');
    assert.equal((await api.getBudgetSummary('2026-10'))[0]!.spentPaise, 0);
    assert.deepEqual(await api.getBudgetSummary('2026-11'), []);
    await api.createBill({ id: 'bill', label: 'Fictional rent', amountPaise: 100000, dueDate: '2026-10-06' });
    await api.setBillPaid('bill', true);
    assert.equal((await api.listBills('2026-10-07'))[0]!.status, 'paid');
    assert.equal((await api.getMonthlySummary('2026-10')).expensePaise, 0);
    assert.equal((await api.listTransactions()).length, 0);
    assert.equal((await api.exportTransactionsCsv()).split('\r\n').length, 2);
  } finally { fixture.sqlite.close(); }
});

it('lets an explicit timestamp separate identical no-reference purchases without weakening replay protection', async () => {
  const fixture = openTestLedger();
  const api = createDataLayer(fixture.client, ledgerMigrations, async () => testFingerprinter);
  const receivedAt = Date.parse('2026-10-07T10:00:00.000Z');
  const sms = {
    sender: 'VM-HDFCBK-S',
    body: 'INR 450.00 debited from A/c XX1234 at Fictional Market.',
    receivedAt,
  };
  try {
    await api.migrateLedger();
    const first = await api.preparePaste(sms);
    assert.equal(first.kind, 'needs-review');
    if (first.kind !== 'needs-review') throw new Error('Expected review');
    assert.equal(first.identity.dedupeKey.startsWith('body:'), true);
    assert.equal(first.candidate?.upiRef, null);
    assert.equal(first.collision, null);
    assert.equal(JSON.stringify(first).includes(sms.body), false);
    const simultaneous = await api.preparePaste(sms);
    assert.equal(simultaneous.kind, 'needs-review');
    if (simultaneous.kind !== 'needs-review') throw new Error('Expected review');
    assert.equal(simultaneous.collision, null);
    assert.equal(await api.saveReviewedPaste(first), 'inserted');
    assert.equal(await api.saveReviewedPaste(simultaneous), 'duplicate');
    assert.deepEqual(await api.getPasteCollision(simultaneous.identity.id), { occurredAt: receivedAt, deleted: false });
    await api.editTransaction(first.identity.id, { amountPaise: 47000 });

    const replay = await api.preparePaste({ ...sms, receivedAt: receivedAt + 86_400_000 });
    assert.equal(replay.kind, 'needs-review');
    if (replay.kind !== 'needs-review') throw new Error('Expected review');
    assert.deepEqual(replay.collision, { occurredAt: receivedAt, deleted: false });
    assert.equal(await api.saveReviewedPaste(replay), 'duplicate');
    assert.equal((await api.getTransaction(first.identity.id))?.amountPaise, 47000);

    const secondAt = new Date(receivedAt + 1_000);
    await assert.rejects(
      api.saveReviewedPaste(replay, { upiRef: '612345678901', occurredAt: secondAt }, { separatePaymentAt: secondAt }),
      /no-reference paste collision/i,
    );
    assert.equal(await api.saveReviewedPaste(replay, {}, { separatePaymentAt: secondAt }), 'inserted');
    const rows = await fixture.ledger.db.select().from(transactions).all();
    assert.equal(rows.length, 2);
    const second = rows.find((row) => row.id !== first.identity.id);
    assert.ok(second);
    assert.equal(second.occurredAt.getTime(), secondAt.getTime());
    assert.equal(second.dedupeKey?.startsWith('body:'), true);
    assert.equal(second.bodyHash, first.identity.bodyHash);
    assert.equal(JSON.stringify(rows).includes(sms.body), false);

    assert.equal(await api.saveReviewedPaste(replay, {}, { separatePaymentAt: secondAt }), 'duplicate');
    await api.editTransaction(second.id, { amountPaise: 48000 });
    assert.equal(await api.saveReviewedPaste(replay, {}, { separatePaymentAt: secondAt }), 'duplicate');
    await api.softDeleteTransaction(second.id);
    assert.equal(await api.saveReviewedPaste(replay, {}, { separatePaymentAt: secondAt }), 'duplicate');
    const finalRows = await fixture.ledger.db.select().from(transactions).all();
    assert.equal(finalRows.length, 2);
    assert.equal(finalRows.find((row) => row.id === second.id)?.amountPaise, 48000);
    assert.ok(finalRows.find((row) => row.id === second.id)?.deletedAt);

    await assert.rejects(
      api.saveReviewedPaste(replay, { occurredAt: new Date(receivedAt + 500) }, { separatePaymentAt: new Date(receivedAt + 500) }),
      /whole second/i,
    );
    await assert.rejects(
      api.saveReviewedPaste(replay, { occurredAt: new Date(receivedAt) }, { separatePaymentAt: new Date(receivedAt) }),
      /different actual time/i,
    );
  } finally { fixture.sqlite.close(); }
});

it('does not allow a strong UPI identity to be split by time', async () => {
  const fixture = openTestLedger();
  const api = createDataLayer(fixture.client, ledgerMigrations, async () => testFingerprinter);
  const sms = {
    sender: 'VM-HDFCBK-S',
    body: 'INR 450.00 debited from A/c XX1234 to VPA fictional@axisbank (UPI Ref No 612345678901).',
    receivedAt: Date.parse('2026-10-07T10:00:00.000Z'),
  };
  try {
    await api.migrateLedger();
    const prepared = await api.preparePaste(sms);
    assert.equal(prepared.kind, 'needs-review');
    if (prepared.kind !== 'needs-review') throw new Error('Expected review');
    assert.ok(prepared.candidate?.upiRef);
    await assert.rejects(
      api.saveReviewedPaste(prepared, { occurredAt: new Date(sms.receivedAt + 1_000) }, { separatePaymentAt: new Date(sms.receivedAt + 1_000) }),
      /no-reference paste collision/i,
    );
    assert.equal((await fixture.ledger.db.select().from(transactions).all()).length, 0);
  } finally { fixture.sqlite.close(); }
});
