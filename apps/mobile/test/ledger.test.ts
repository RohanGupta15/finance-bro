/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { eq } from 'drizzle-orm';
import { after, before, describe, it } from 'node:test';
import {
  createLedger,
  migrateLedger,
  type ImportedTransaction,
  type LedgerMigrations,
  type LedgerSQLiteClient,
  type NewTransaction,
  type TransactionPatch,
} from '../src/db/ledger';
import { accounts, categories, transactions } from '../src/db/schema';

const migrationsDirectory = resolve(process.cwd(), 'drizzle');
const migrations: LedgerMigrations = {
  journal: JSON.parse(readFileSync(join(migrationsDirectory, 'meta/_journal.json'), 'utf8')),
  migrations: {
    m0000: readFileSync(join(migrationsDirectory, '0000_initial_ledger.sql'), 'utf8'),
  },
};

function openLedger(filename: string) {
  const sqlite = new DatabaseSync(filename);
  const client = {
    execAsync: async (source: string) => { sqlite.exec(source); },
    getFirstAsync: async <T>(source: string, ...params: unknown[]) =>
      (sqlite.prepare(source).get(...params as never[]) as T | undefined) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
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

  return { sqlite, client, ledger: createLedger(client, migrations) };
}

function temporaryFile() {
  const directory = mkdtempSync(join(tmpdir(), 'finance-bro-ledger-'));
  return { directory, filename: join(directory, 'ledger.sqlite') };
}

function removeTemporaryFile(directory: string, filename: string) {
  rmSync(filename, { force: true });
  rmdirSync(directory);
}

function transaction(id: string, overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    id,
    amountPaise: 45600,
    direction: 'debit',
    kind: 'expense',
    source: 'paste',
    occurredAt: new Date('2026-10-06T12:00:00.000Z'),
    ...overrides,
  };
}

function importedTransaction(id: string, overrides: Partial<ImportedTransaction> = {}): ImportedTransaction {
  return { ...transaction(id), source: 'paste', ...overrides };
}

async function findTransaction(ledger: ReturnType<typeof createLedger>, id: string) {
  return ledger.db.select().from(transactions).where(eq(transactions.id, id)).get();
}

describe('ledger', () => {
  let directory: string;
  let filename: string;

  before(() => {
    ({ directory, filename } = temporaryFile());
  });

  after(() => removeTemporaryFile(directory, filename));

  it('migrates, persists, reopens, and ignores runtime-only metadata', async () => {
    let fixture = openLedger(filename);
    await fixture.ledger.migrateLedger();
    await fixture.ledger.db.insert(accounts).values({ id: 'cash', name: 'Fictional cash', type: 'cash' }).run();
    await fixture.ledger.db.insert(categories).values({ id: 'food', name: 'Fictional food', kind: 'expense' }).run();

    const note = `Fictional note ${'x'.repeat(400)}`;
    const injected = {
      ...transaction('persisted', { accountId: 'cash', categoryId: 'food', note }),
      userEdited: true,
      deletedAt: new Date('2026-10-05T00:00:00.000Z'),
    } as NewTransaction;
    await fixture.ledger.createTransaction(injected);
    const original = await findTransaction(fixture.ledger, 'persisted');
    assert.ok(original);
    assert.equal(original.userEdited, false);
    assert.equal(original.deletedAt, null);
    assert.equal(original.note, note);
    fixture.sqlite.close();

    fixture = openLedger(filename);
    await fixture.ledger.migrateLedger();
    const reopened = await findTransaction(fixture.ledger, 'persisted');
    assert.ok(reopened);
    assert.equal(reopened.amountPaise, 45600);
    assert.equal(reopened.accountId, 'cash');
    assert.equal(reopened.categoryId, 'food');
    assert.equal(reopened.note, note);
    assert.equal(reopened.deletedAt, null);
    fixture.sqlite.close();
  });

  it('updates only untouched imports and preserves edits, tombstones, and manual rows', async () => {
    const fixture = openLedger(filename);
    try {
      await fixture.ledger.migrateLedger();
      const imported = importedTransaction('import-update');
      const injected = {
        ...imported,
        createdAt: new Date(1),
        updatedAt: new Date(1),
        deletedAt: new Date(1),
        userEdited: true,
      } as ImportedTransaction;
      assert.equal(await fixture.ledger.upsertImportedTransaction(injected), true);
      let row = await findTransaction(fixture.ledger, 'import-update');
      assert.equal(row?.userEdited, false);
      assert.equal(row?.deletedAt, null);
      assert.notEqual(row?.createdAt.getTime(), 1);

      fixture.sqlite.prepare('UPDATE transactions SET created_at = 123456 WHERE id = ?').run('import-update');
      assert.equal(await fixture.ledger.upsertImportedTransaction({ ...imported, amountPaise: 50000 }), true);
      row = await findTransaction(fixture.ledger, 'import-update');
      assert.equal(row?.amountPaise, 50000);
      assert.equal(row?.createdAt.getTime(), 123456);

      const injectedPatch = {
        amountPaise: 51000,
        id: 'forged-id',
        source: 'manual',
        userEdited: false,
        deletedAt: new Date(1),
      } as TransactionPatch;
      assert.equal(await fixture.ledger.editTransaction('import-update', injectedPatch), true);
      assert.equal(await fixture.ledger.upsertImportedTransaction({ ...imported, amountPaise: 52000 }), false);
      row = await findTransaction(fixture.ledger, 'import-update');
      assert.equal(row?.amountPaise, 51000);
      assert.equal(row?.userEdited, true);
      assert.equal(row?.deletedAt, null);
      assert.equal(row?.source, 'paste');
      assert.equal(await findTransaction(fixture.ledger, 'forged-id'), undefined);

      const deleted = importedTransaction('import-deleted');
      await fixture.ledger.upsertImportedTransaction(deleted);
      assert.equal(await fixture.ledger.softDeleteTransaction('import-deleted'), true);
      assert.equal(await fixture.ledger.upsertImportedTransaction({ ...deleted, amountPaise: 52000 }), false);
      row = await findTransaction(fixture.ledger, 'import-deleted');
      assert.ok(row?.deletedAt);
      assert.equal(row.amountPaise, 45600);

      await fixture.ledger.createTransaction(transaction('manual-row', { source: 'manual' }));
      fixture.sqlite.prepare('UPDATE transactions SET user_edited = 0 WHERE id = ?').run('manual-row');
      assert.equal(await fixture.ledger.upsertImportedTransaction(importedTransaction('manual-row')), false);
      row = await findTransaction(fixture.ledger, 'manual-row');
      assert.equal(row?.source, 'manual');
      assert.equal(row?.userEdited, false);
      await assert.rejects(
        fixture.ledger.upsertImportedTransaction(transaction('bad-import', { source: 'manual' }) as ImportedTransaction),
        TypeError,
      );
    } finally {
      fixture.sqlite.close();
    }
  });

  it('rejects unsafe money in the API and invalid money, enum, and foreign-key values in SQLite', async () => {
    const fixture = openLedger(filename);
    try {
      await fixture.ledger.migrateLedger();
      const invalidAmounts = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
      for (const amountPaise of invalidAmounts) {
        await assert.rejects(fixture.ledger.createTransaction(transaction(`bad-${String(amountPaise)}`, { amountPaise })));
      }
      await assert.rejects(fixture.ledger.editTransaction('absent', { amountPaise: 1.5 }));
      await assert.rejects(fixture.ledger.upsertImportedTransaction(importedTransaction('bad-import', { amountPaise: 0 })));
      await fixture.ledger.createTransaction(transaction('max-safe', { amountPaise: Number.MAX_SAFE_INTEGER }));

      const insert = fixture.sqlite.prepare(`
        INSERT INTO transactions (id, amount_paise, direction, kind, account_id, occurred_at, source, created_at, updated_at)
        VALUES (?, ?, ?, 'expense', ?, 1, 'paste', 1, 1)
      `);
      for (const amountPaise of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => insert.run(`sql-bad-${String(amountPaise)}`, amountPaise, 'debit', null));
      }
      assert.throws(() => insert.run('sql-bad-direction', 10, 'wire', null));
      assert.throws(() => insert.run('sql-bad-account', 10, 'debit', 'missing-account'));
    } finally {
      fixture.sqlite.close();
    }
  });

  it('applies new migrations without losing rows, rejects newer schemas, and rolls failures back', async () => {
    const fixture = openLedger(filename);
    try {
      await fixture.ledger.migrateLedger();
      await fixture.ledger.db.insert(accounts).values({ id: 'kept', name: 'Fictional account', type: 'cash' }).run();
      await fixture.ledger.createTransaction(transaction('migration-edited', { source: 'manual', amountPaise: 12000 }));
      await fixture.ledger.editTransaction('migration-edited', { amountPaise: 13000 });
      await fixture.ledger.createTransaction(transaction('migration-deleted'));
      await fixture.ledger.softDeleteTransaction('migration-deleted', new Date('2026-10-06T13:00:00.000Z'));

      const nextMigrations: LedgerMigrations = {
        journal: {
          entries: [...migrations.journal.entries, { idx: 1, when: 1, tag: '0001_test_column', breakpoints: true }],
        },
        migrations: {
          ...migrations.migrations,
          m0001: `ALTER TABLE accounts ADD COLUMN migration_marker TEXT NOT NULL DEFAULT 'preserved'`,
        },
      };
      await migrateLedger(fixture.client, nextMigrations);
      const account = fixture.sqlite.prepare('SELECT id, migration_marker FROM accounts WHERE id = ?').get('kept') as
        | { id: string; migration_marker: string }
        | undefined;
      assert.equal(account?.id, 'kept');
      assert.equal(account?.migration_marker, 'preserved');
      assert.equal((fixture.sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 2);
      const edited = await findTransaction(fixture.ledger, 'migration-edited');
      assert.equal(edited?.amountPaise, 13000);
      assert.equal(edited?.userEdited, true);
      const deleted = await findTransaction(fixture.ledger, 'migration-deleted');
      assert.equal(deleted?.amountPaise, 45600);
      assert.equal(deleted?.deletedAt?.toISOString(), '2026-10-06T13:00:00.000Z');
      await assert.rejects(migrateLedger(fixture.client, migrations), /newer than this app supports/);
    } finally {
      fixture.sqlite.close();
    }

    const failed = temporaryFile();
    const failedFixture = openLedger(failed.filename);
    try {
      await failedFixture.ledger.migrateLedger();
      await failedFixture.ledger.db.insert(accounts).values({ id: 'kept', name: 'Fictional account', type: 'cash' }).run();
      const brokenMigrations: LedgerMigrations = {
        journal: {
          entries: [...migrations.journal.entries, { idx: 1, when: 1, tag: '0001_broken', breakpoints: true }],
        },
        migrations: {
          ...migrations.migrations,
          m0001: 'CREATE TABLE rollback_probe (id TEXT);--> statement-breakpoint SELECT * FROM missing_table',
        },
      };
      await assert.rejects(migrateLedger(failedFixture.client, brokenMigrations));
      assert.equal((failedFixture.sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 1);
      assert.equal(
        (failedFixture.sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'rollback_probe'").get() as { count: number }).count,
        0,
      );
      assert.equal((failedFixture.sqlite.prepare('SELECT count(*) AS count FROM accounts WHERE id = ?').get('kept') as { count: number }).count, 1);
    } finally {
      failedFixture.sqlite.close();
      removeTemporaryFile(failed.directory, failed.filename);
    }
  });
});
