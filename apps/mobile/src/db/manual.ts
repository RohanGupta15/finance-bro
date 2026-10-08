import { assertValidAmountPaise, type Ledger, type TransactionPatch } from './ledger';

/** Plain INR decimal input, without currency symbols or digit grouping. */
export function parseInrAmount(input: string): number {
  if (typeof input !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(input.trim())) {
    throw new TypeError('Enter an INR amount with at most two decimal places');
  }
  const [rupees, fraction = ''] = input.trim().split('.');
  const value = BigInt(rupees!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Amount is too large');
  const amountPaise = Number(value);
  assertValidAmountPaise(amountPaise);
  return amountPaise;
}

export type ManualEntry = {
  /** Reuse the same ID when retrying a save; a different ID is a new entry. */
  id: string;
  amountInr: string;
  direction: 'debit' | 'credit';
  occurredAt: Date;
  categoryId?: string | null;
  accountId?: string | null;
  note?: string | null;
};

export async function saveManualEntry(ledger: Ledger, input: ManualEntry): Promise<void> {
  await ledger.createTransaction({
    id: input.id,
    amountPaise: parseInrAmount(input.amountInr),
    direction: input.direction,
    kind: input.direction === 'debit' ? 'expense' : 'income',
    status: 'posted',
    source: 'manual',
    occurredAt: input.occurredAt,
    categoryId: input.categoryId,
    accountId: input.accountId,
    note: input.note,
  });
}

export async function editManualAmount(ledger: Ledger, id: string, amountInr: string, patch: TransactionPatch = {}) {
  return ledger.editTransaction(id, { ...patch, amountPaise: parseInrAmount(amountInr) });
}
