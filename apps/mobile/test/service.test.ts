import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createDataLayer } from '../src/db/service';
import { ledgerMigrations, openTestLedger } from './helpers/ledger';

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
