import assert from 'node:assert/strict';
import { it } from 'node:test';
import { openTestLedger } from './helpers/ledger';

it('SQLite atomically blocks category and direction changes that could corrupt totals', async () => {
  const fixture = openTestLedger();
  try {
    await fixture.ledger.migrateLedger();
    await fixture.ledger.createCategory({ id: 'food', name: 'Fictional food', kind: 'expense' });
    await fixture.ledger.createCategory({ id: 'salary', name: 'Fictional income', kind: 'income' });
    await fixture.ledger.createTransaction({ id: 'expense', amountPaise: 100, direction: 'debit', kind: 'expense', source: 'manual', categoryId: 'food', occurredAt: new Date(1) });
    assert.throws(() => fixture.sqlite.exec("UPDATE transactions SET direction='credit' WHERE id='expense'"));
    assert.throws(() => fixture.sqlite.exec("UPDATE transactions SET category_id='salary' WHERE id='expense'"));
    await fixture.ledger.softDeleteTransaction('expense');
    assert.throws(() => fixture.sqlite.exec("UPDATE categories SET kind='income' WHERE id='food'"));
    assert.throws(() => fixture.sqlite.exec("INSERT INTO transactions(id,amount_paise,direction,kind,source,occurred_at,created_at,updated_at) VALUES('bad',100,'debit','income','manual',1,1,1)"));
  } finally { fixture.sqlite.close(); }
});
