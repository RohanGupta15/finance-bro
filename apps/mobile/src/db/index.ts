import * as SQLite from 'expo-sqlite';
import { createLedger, type Ledger } from './ledger';
import { ledgerMigrations } from './migrations';

let opening: Promise<Ledger> | undefined;

async function openLedger(): Promise<Ledger> {
  const client = await SQLite.openDatabaseAsync('finance-bro.db', { enableChangeListener: true });
  const ledger = createLedger(client, ledgerMigrations);
  try {
    await ledger.migrateLedger();
    return ledger;
  } catch (error) {
    await client.closeAsync().catch(() => {});
    throw error;
  }
}

export function getLedger(): Promise<Ledger> {
  opening ??= openLedger().catch((error: unknown) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

export { createLedger, migrateLedger, assertValidAmountPaise } from './ledger';
export type {
  ImportedTransaction,
  Ledger,
  LedgerMigrations,
  LedgerSQLiteClient,
  NewTransaction,
  TransactionPatch,
} from './ledger';
