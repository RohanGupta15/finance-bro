import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createDataLayer } from '../src/db/service';
import { seedDemoLedger } from '../src/dev/seed-demo';
import { ledgerMigrations, openTestLedger } from './helpers/ledger';

it('seeds fictional visuals atomically and never overwrites edited or deleted demo records', async () => {
  const fixture = openTestLedger();
  const ledger = createDataLayer(fixture.client, ledgerMigrations);
  try {
    await ledger.migrateLedger();
    assert.equal(await seedDemoLedger(fixture.client, ledger, new Date('2026-10-08T13:00:00Z')), true);
    assert.equal((await ledger.listTransactions()).length, 31);
    const totals = await ledger.getMonthlySummary('2026-10');
    assert.equal(totals.incomePaise, 8_500_000);
    assert.equal(totals.expensePaise, 3_482_300);
    for (const month of ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) {
      assert.equal((await ledger.listTransactions({ month })).length, 3);
    }
    const budgets = await ledger.getBudgetSummary('2026-10');
    assert.equal(budgets.length, 6);
    assert.equal(budgets.find((budget) => budget.categoryId === 'demo-v1-shopping')!.overBudget, true);
    assert.deepEqual(new Set((await ledger.listBills('2026-10-08')).map((bill) => bill.status)), new Set(['upcoming', 'overdue', 'paid']));
    await ledger.editTransaction('demo-v1-today-market', { amountPaise: 12_345 });
    await ledger.softDeleteTransaction('demo-v1-salary');
    assert.equal(await seedDemoLedger(fixture.client, ledger, new Date('2026-11-01T00:00:00Z')), false);
    assert.equal((await ledger.listTransactions()).length, 30);
    assert.equal((await ledger.listTransactions()).find((row) => row.id === 'demo-v1-today-market')!.amountPaise, 12_345);
  } finally { fixture.sqlite.close(); }
});

it('rolls back an interrupted seed so a retry can complete it', async () => {
  const fixture = openTestLedger();
  const ledger = createDataLayer(fixture.client, ledgerMigrations);
  try {
    await ledger.migrateLedger();
    await assert.rejects(seedDemoLedger(fixture.client, {
      ...ledger, createBill: async () => { throw new Error('Simulated storage failure'); },
    }, new Date('2026-10-08T13:00:00Z')), /Simulated storage failure/);
    assert.equal((await ledger.listTransactions()).length, 0);
    assert.equal((await ledger.listAccounts()).length, 0);
    assert.equal((await ledger.listCategories()).length, 0);
    assert.equal(await seedDemoLedger(fixture.client, ledger, new Date('2026-10-08T13:00:00Z')), true);
  } finally { fixture.sqlite.close(); }
});
