import { eq } from 'drizzle-orm';
import type { Ledger } from './ledger';
import { assertValidAmountPaise } from './ledger';
import { bills, budgets, categories } from './schema';

type BudgetFields = Pick<typeof budgets.$inferInsert, 'id' | 'categoryId' | 'month' | 'amountPaise'>;
export type NewBudget = BudgetFields;
export type BudgetPatch = Partial<Omit<BudgetFields, 'id'>>;
export type BudgetRow = typeof budgets.$inferSelect;
export type NewBill = Pick<typeof bills.$inferInsert, 'id' | 'label' | 'amountPaise' | 'dueDate'>;
export type BillPatch = Partial<Pick<NewBill, 'label' | 'amountPaise' | 'dueDate'>>;
export type BillStatus = 'upcoming' | 'overdue' | 'paid';
export type BillRow = typeof bills.$inferSelect;
export type BillWithStatus = BillRow & { status: BillStatus };

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertId(value: unknown, name = 'id'): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${name} must be a non-empty string`);
}

function assertMonth(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value.startsWith('0000')) {
    throw new TypeError('month must be a valid YYYY-MM month');
  }
}

function assertCalendarDate(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) {
    throw new TypeError(`${name} must be a valid YYYY-MM-DD date`);
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || year < 1 || month === undefined || day === undefined) {
    throw new TypeError(`${name} must be a valid YYYY-MM-DD date`);
  }
  const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (daysInMonth === undefined || day < 1 || day > daysInMonth) {
    throw new TypeError(`${name} must be a valid YYYY-MM-DD date`);
  }
}

function assertAmount(value: unknown): asserts value is number {
  if (typeof value !== 'number') throw new TypeError('amountPaise must be a positive safe integer');
  assertValidAmountPaise(value);
}

function normaliseLabel(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError('label must be a non-empty string');
  return value.trim();
}

async function assertExpenseCategory(db: Ledger['db'], categoryId: string): Promise<void> {
  const category = await db.select({ kind: categories.kind }).from(categories).where(eq(categories.id, categoryId)).get();
  if (category?.kind !== 'expense') throw new RangeError('categoryId must refer to an expense category');
}

function validateBudget(input: unknown): asserts input is NewBudget {
  assertRecord(input, 'budget');
  assertId(input.id);
  assertId(input.categoryId, 'categoryId');
  assertMonth(input.month);
  assertAmount(input.amountPaise);
}

function validateBill(input: unknown): asserts input is NewBill {
  assertRecord(input, 'bill');
  assertId(input.id);
  normaliseLabel(input.label);
  assertAmount(input.amountPaise);
  assertCalendarDate(input.dueDate, 'dueDate');
}

export function createPlanning(db: Ledger['db']) {
  return {
    async setBudget(input: NewBudget): Promise<string> {
      validateBudget(input);
      await assertExpenseCategory(db, input.categoryId);
      const rows = await db.insert(budgets).values({
        id: input.id,
        categoryId: input.categoryId,
        month: input.month,
        amountPaise: input.amountPaise,
      })
        .onConflictDoUpdate({
          target: [budgets.categoryId, budgets.month],
          set: { amountPaise: input.amountPaise },
        })
        .returning({ id: budgets.id }).all();
      return rows[0]!.id;
    },
    async editBudget(id: string, patch: BudgetPatch): Promise<boolean> {
      assertId(id);
      assertRecord(patch, 'patch');
      if (patch.categoryId !== undefined) assertId(patch.categoryId, 'categoryId');
      if (patch.month !== undefined) assertMonth(patch.month);
      if (patch.amountPaise !== undefined) assertAmount(patch.amountPaise);
      if (patch.categoryId !== undefined) await assertExpenseCategory(db, patch.categoryId);
      const changes = Object.fromEntries(Object.entries({
        categoryId: patch.categoryId,
        month: patch.month,
        amountPaise: patch.amountPaise,
      }).filter(([, value]) => value !== undefined)) as BudgetPatch;
      if (Object.keys(changes).length === 0) return false;
      const rows = await db.update(budgets).set(changes).where(eq(budgets.id, id)).returning({ id: budgets.id }).all();
      return rows.length > 0;
    },
    async removeBudget(id: string): Promise<boolean> {
      assertId(id);
      const rows = await db.delete(budgets).where(eq(budgets.id, id)).returning({ id: budgets.id }).all();
      return rows.length > 0;
    },
    async listBudgets(month?: string): Promise<BudgetRow[]> {
      if (month !== undefined) assertMonth(month);
      const query = db.select().from(budgets);
      return (month === undefined ? query : query.where(eq(budgets.month, month)))
        .orderBy(budgets.month, budgets.categoryId).all();
    },
    async createBill(input: NewBill): Promise<void> {
      validateBill(input);
      await db.insert(bills).values({
        id: input.id,
        label: normaliseLabel(input.label),
        amountPaise: input.amountPaise,
        dueDate: input.dueDate,
      }).run();
    },
    async editBill(id: string, patch: BillPatch): Promise<boolean> {
      assertId(id);
      assertRecord(patch, 'patch');
      const label = patch.label === undefined ? undefined : normaliseLabel(patch.label);
      if (patch.amountPaise !== undefined) assertAmount(patch.amountPaise);
      if (patch.dueDate !== undefined) assertCalendarDate(patch.dueDate, 'dueDate');
      const changes = Object.fromEntries(Object.entries({
        label,
        amountPaise: patch.amountPaise,
        dueDate: patch.dueDate,
      }).filter(([, value]) => value !== undefined)) as BillPatch;
      if (Object.keys(changes).length === 0) return false;
      const rows = await db.update(bills).set(changes).where(eq(bills.id, id)).returning({ id: bills.id }).all();
      return rows.length > 0;
    },
    async setBillPaid(id: string, paid: boolean): Promise<boolean> {
      assertId(id);
      if (typeof paid !== 'boolean') throw new TypeError('paid must be a boolean');
      const rows = await db.update(bills).set({ paid }).where(eq(bills.id, id)).returning({ id: bills.id }).all();
      return rows.length > 0;
    },
    async removeBill(id: string): Promise<boolean> {
      assertId(id);
      const rows = await db.delete(bills).where(eq(bills.id, id)).returning({ id: bills.id }).all();
      return rows.length > 0;
    },
    async listBills(today: string): Promise<BillWithStatus[]> {
      assertCalendarDate(today, 'today');
      const rows = await db.select().from(bills).orderBy(bills.dueDate, bills.label).all();
      return rows.map((bill) => ({
        ...bill,
        status: bill.paid ? 'paid' : bill.dueDate < today ? 'overdue' : 'upcoming',
      }));
    },
  };
}
