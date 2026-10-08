import { createLedgerQueries } from '../db/queries';
import type { Ledger } from '../db/ledger';

/** Stable CSV column order; IDs are retained so a future importer can preserve references. */
export const transactionCsvColumns = [
  'id',
  'amount_inr',
  'direction',
  'kind',
  'status',
  'occurred_at',
  'category_id',
  'category_name',
  'account_id',
  'account_name',
  'source',
  'counterparty',
  'note',
] as const;

function spreadsheetSafe(value: string): string {
  return /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function csvField(value: string): string {
  return `"${spreadsheetSafe(value).replaceAll('"', '""')}"`;
}

function amountInr(amountPaise: number): string {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) {
    throw new RangeError('amountPaise must be a non-negative safe integer');
  }
  const amount = BigInt(amountPaise);
  return `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
}

export function createLedgerCsvExporter(db: Ledger['db']) {
  const queries = createLedgerQueries(db);
  return {
    async exportTransactionsCsv(): Promise<string> {
      const rows = await queries.listTransactions();
      const lines = [transactionCsvColumns.map(csvField).join(',')];
      for (const row of rows) {
        lines.push([
          row.id,
          amountInr(row.amountPaise),
          row.direction,
          row.kind,
          row.status,
          row.occurredAt.toISOString(),
          row.categoryId,
          row.categoryName,
          row.accountId,
          row.accountName,
          row.source,
          row.counterparty,
          row.note,
        ].map((value) => csvField(value ?? '')).join(','));
      }
      return `${lines.join('\r\n')}\r\n`;
    },
  };
}
