import type { DataLayer } from '../db/service';
import type { LedgerSQLiteClient, NewTransaction } from '../db/ledger';
import { indiaDate, parseIndiaDate } from '../utils/display';

/** Explicit development fixture; normal app startup never calls this. */
export async function seedDemoLedger(client: LedgerSQLiteClient, ledger: DataLayer, now: Date): Promise<boolean> {
  const today = indiaDate(now);
  const month = today.slice(0, 7);
  const dayMs = 86_400_000;
  const marker = 'demo-v1-salary';
  let inserted = false;
  await client.withTransactionAsync(async () => {
    // Keep a deleted/edited demo intact too; the last record marks an atomic seed.
    if (await client.getFirstAsync('SELECT 1 FROM transactions WHERE id = ?', marker)) return;
    await ledger.createAccount({ id: 'demo-v1-bank', name: 'Demo bank', type: 'bank', institution: 'Fictional Bank', last4: '1234' });
    await ledger.createAccount({ id: 'demo-v1-cash', name: 'Demo cash', type: 'cash' });
    const limits = [
      ['food', 'Food', 600_000], ['rent', 'Rent', 1_800_000], ['groceries', 'Groceries', 700_000],
      ['shopping', 'Shopping', 400_000], ['travel', 'Travel', 300_000], ['bills', 'Bills', 300_000],
    ] as const;
    for (const [key, name, amountPaise] of limits) {
      await ledger.createCategory({ id: `demo-v1-${key}`, name, kind: 'expense' });
      await ledger.setBudget({ id: `demo-v1-budget-${key}`, categoryId: `demo-v1-${key}`, month, amountPaise });
    }
    await ledger.createCategory({ id: 'demo-v1-income', name: 'Salary', kind: 'income' });
    const add = async (id: string, amountPaise: number, category: string | null, counterparty: string, occurredAt: Date, extra: Partial<NewTransaction> = {}) => {
      await ledger.createTransaction({
        id: `demo-v1-${id}`, amountPaise, direction: 'debit', kind: 'expense', status: 'posted', source: 'manual',
        categoryId: category ? `demo-v1-${category}` : null, accountId: 'demo-v1-bank',
        counterparty, occurredAt, note: 'Fictional demo data for visual preview.', ...extra,
      });
    };
    const earlier = (day: number) => parseIndiaDate(`${month}-${String(Math.min(day, Number(today.slice(8)))).padStart(2, '0')}`);
    const recent = (minutes: number) => new Date(Math.max(parseIndiaDate(today).getTime(), now.getTime() - minutes * 60_000));
    await add('rent', 1_650_000, 'rent', 'Fictional rent', earlier(1));
    await add('groceries', 420_000, 'groceries', 'Fictional Market', earlier(3));
    await add('shoes', 620_000, 'shopping', 'Fictional Outfitters', earlier(4));
    await add('refund', 50_000, 'shopping', 'Fictional return', earlier(5), { direction: 'credit', kind: 'refund' });
    await add('electricity', 149_900, 'bills', 'Fictional electricity', earlier(5));
    await add('internet', 99_900, 'bills', 'Fictional internet', earlier(6));
    await add('metro', 135_000, 'travel', 'Fictional Metro', earlier(6));
    await add('dinner', 185_000, 'food', 'Fictional Kitchen', earlier(6));
    await add('lunches', 142_500, 'food', 'Fictional Café', earlier(7));
    // Exactly three recent records fill the reference's fanned cards.
    await add('today-coffee', 18_000, 'food', 'Fictional Café', recent(40), { accountId: 'demo-v1-cash' });
    await add('today-ride', 24_500, 'travel', 'Fictional Ride', recent(20));
    await add('today-market', 87_500, 'groceries', 'Fictional Market', now);
    await add('pending', 75_000, 'shopping', 'Fictional pending order', earlier(4), { status: 'pending' });
    await add('excluded', 45_000, 'food', 'Fictional reimbursed meal', earlier(5), { excludeFromStats: true });
    await add('transfer', 500_000, null, 'Fictional transfer', earlier(2), { kind: 'transfer' });
    for (let back = 1; back <= 5; back++) {
      const historical = new Date(`${month}-15T12:00:00Z`);
      historical.setUTCMonth(historical.getUTCMonth() - back);
      const occurredAt = parseIndiaDate(`${indiaDate(historical).slice(0, 7)}-02`);
      await add(`history-food-${back}`, 260_000 + back * 12_500, 'food', 'Fictional Kitchen', occurredAt);
      await add(`history-rent-${back}`, 1_650_000, 'rent', 'Fictional rent', occurredAt);
      await add(`history-income-${back}`, 8_500_000, 'income', 'Fictional employer', occurredAt, { direction: 'credit', kind: 'income' });
    }
    const billDate = (offset: number) => indiaDate(new Date(parseIndiaDate(today).getTime() + offset * dayMs));
    for (const [key, label, amountPaise, offset] of [
      ['power', 'Demo electricity', 149_900, -2], ['phone', 'Demo mobile plan', 39_900, 2],
      ['internet', 'Demo internet', 99_900, 5], ['rent', 'Demo rent', 1_650_000, 12],
      ['paid', 'Demo subscription', 29_900, -3],
    ] as const) {
      await ledger.createBill({ id: `demo-v1-bill-${key}`, label, amountPaise, dueDate: billDate(offset) });
    }
    await ledger.setBillPaid('demo-v1-bill-paid', true);
    await add('salary', 8_500_000, 'income', 'Fictional employer', earlier(1), { direction: 'credit', kind: 'income' });
    inserted = true;
  });
  return inserted;
}
