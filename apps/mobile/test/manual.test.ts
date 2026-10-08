import assert from 'node:assert/strict';
import { it } from 'node:test';
import { eq } from 'drizzle-orm';
import { parseInrAmount, saveManualEntry } from '../src/db/manual';
import { transactions } from '../src/db/schema';
import { openTestLedger } from './helpers/ledger';

it('parses exact INR and rejects ambiguous, fractional and unsafe money', () => {
  assert.equal(parseInrAmount(' 450.5 '), 45050);
  assert.equal(parseInrAmount('0.01'), 1);
  assert.equal(parseInrAmount('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  for (const text of ['', '0', '-1', '+1', '1e3', '.50', '1.', '1.001', '1,000', '₹450', 'Infinity', '90071992547409.92']) {
    assert.throws(() => parseInrAmount(text), { name: /TypeError|RangeError/ }, text);
  }
});

it('manual saves are protected, reject repeated stable IDs and preserve the first entry', async () => {
  const fixture = openTestLedger();
  try {
    await fixture.ledger.migrateLedger();
    const input = { id: 'manual', amountInr: '450.50', direction: 'debit' as const, occurredAt: new Date('2026-10-07T12:00:00Z') };
    await saveManualEntry(fixture.ledger, input);
    await assert.rejects(saveManualEntry(fixture.ledger, { ...input, amountInr: '500' }));
    await assert.rejects(saveManualEntry(fixture.ledger, { ...input, id: 'invalid', amountInr: '1.001' }));
    const rows = await fixture.ledger.db.select().from(transactions).where(eq(transactions.id, 'manual')).all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.amountPaise, 45050);
    assert.equal(rows[0]?.userEdited, true);
    assert.equal(rows[0]?.source, 'manual');
  } finally { fixture.sqlite.close(); }
});
