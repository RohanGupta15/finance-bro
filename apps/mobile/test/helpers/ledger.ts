import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLedger, type LedgerMigrations, type LedgerSQLiteClient } from '../../src/db/ledger';

const directory = resolve(process.cwd(), 'drizzle');
const journal: LedgerMigrations['journal'] = JSON.parse(readFileSync(join(directory, 'meta/_journal.json'), 'utf8'));
export const ledgerMigrations: LedgerMigrations = {
  journal,
  migrations: Object.fromEntries(journal.entries.map((entry) => [
    `m${String(entry.idx).padStart(4, '0')}`,
    readFileSync(join(directory, `${entry.tag}.sql`), 'utf8'),
  ])),
};

export function openTestLedger(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  const client = {
    execAsync: async (source: string) => { sqlite.exec(source); },
    getFirstAsync: async <T>(source: string, ...params: unknown[]) =>
      (sqlite.prepare(source).get(...params as never[]) as T | undefined) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await task(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    prepareAsync: async (source: string) => {
      const statement = sqlite.prepare(source);
      return {
        executeForRawResultAsync: async (params: unknown[]) => {
          const names = statement.columns().map(({ name }) => name);
          const rows = statement.all(...params as never[]).map((row) => names.map((name) => row[name]));
          return { getAllAsync: async () => rows };
        },
        finalizeAsync: async () => {},
      };
    },
  } as unknown as LedgerSQLiteClient;
  return { sqlite, client, ledger: createLedger(client, ledgerMigrations) };
}

export function temporaryFile() {
  const directory = mkdtempSync(join(tmpdir(), 'finance-bro-v1-'));
  return { directory, filename: join(directory, 'ledger.sqlite') };
}
