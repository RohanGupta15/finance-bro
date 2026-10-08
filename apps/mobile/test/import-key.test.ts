import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { it } from 'node:test';
import { createDataLayer } from '../src/db/service';
import { DuplicateReviewRequiredError } from '../src/imports/key-state';
import { ledgerMigrations, openTestLedger } from './helpers/ledger';
import type { Fingerprinter } from '../src/imports/fingerprint';

function signer(key: string): Fingerprinter {
  return {
    keyId: createHmac('sha256', key).update('fixture-key-id').digest('hex'),
    fingerprint: async (text) => createHmac('sha256', key).update(text).digest('hex'),
  };
}
const sms = { sender: 'VM-HDFCBK-S', body: 'INR 450.00 debited from A/c XX1234 to VPA fictional@axisbank (UPI Ref No 612345678901).', receivedAt: Date.parse('2026-10-07T10:00:00Z') };

it('detects key loss, requires duplicate review and preserves corrected/deleted old records', async () => {
  const fixture = openTestLedger();
  let current = signer('fictional-first-key');
  const api = createDataLayer(fixture.client, ledgerMigrations, async () => current);
  try {
    await api.migrateLedger();
    const original = await api.preparePaste(sms);
    assert.equal(original.kind, 'needs-review');
    if (original.kind !== 'needs-review') throw new Error('Review required');
    assert.equal(original.duplicateReviewRequired, false);
    assert.equal(await api.saveReviewedPaste(original), 'inserted');
    await api.editTransaction(original.identity.id, { amountPaise: 47000 });
    assert.equal(await api.saveReviewedPaste(original), 'duplicate');
    await api.softDeleteTransaction(original.identity.id);
    current = signer('fictional-replacement-key');
    const recovered = await api.preparePaste(sms);
    if (recovered.kind !== 'needs-review') throw new Error('Review required');
    assert.equal(recovered.duplicateReviewRequired, true);
    assert.notEqual(recovered.identity.id, original.identity.id);
    await assert.rejects(api.saveReviewedPaste(recovered), DuplicateReviewRequiredError);
    assert.equal((await api.listTransactions()).length, 0);
    assert.equal(await api.saveReviewedPaste(recovered, {}, { acknowledgeDuplicateRisk: true }), 'inserted');
    await assert.rejects(api.saveReviewedPaste(recovered), DuplicateReviewRequiredError);
    assert.equal(await api.saveReviewedPaste(recovered, {}, { acknowledgeDuplicateRisk: true }), 'duplicate');
    assert.equal((await api.listTransactions()).length, 1);
    assert.equal(await api.getTransaction(original.identity.id), undefined);
  } finally { fixture.sqlite.close(); }
});

it('legacy pasted records require manual duplicate review and key errors never fall back to weak fingerprints', async () => {
  const fixture = openTestLedger();
  try {
    await fixture.ledger.migrateLedger();
    fixture.sqlite.exec("INSERT INTO transactions(id,amount_paise,direction,kind,source,occurred_at,created_at,updated_at) VALUES('legacy',100,'debit','expense','paste',1,1,1)");
    const api = createDataLayer(fixture.client, ledgerMigrations, async () => signer('fictional-key'));
    const prepared = await api.preparePaste(sms);
    if (prepared.kind !== 'needs-review') throw new Error('Review required');
    assert.equal(prepared.duplicateReviewRequired, true);
    await assert.rejects(api.saveReviewedPaste(prepared), DuplicateReviewRequiredError);
    const unavailable = createDataLayer(fixture.client, ledgerMigrations, async () => { throw new Error('Key store unavailable'); });
    await assert.rejects(unavailable.preparePaste(sms), /Key store unavailable/);
    assert.equal((await api.listTransactions()).length, 1);
  } finally { fixture.sqlite.close(); }
});
