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
import { preparePastedSms, saveReviewedPaste } from '../src/imports/paste';

const migrationsDirectory = resolve(process.cwd(), 'drizzle');
const journal: LedgerMigrations['journal'] = JSON.parse(readFileSync(join(migrationsDirectory, 'meta/_journal.json'), 'utf8'));
const migrations: LedgerMigrations = {
  journal,
  migrations: Object.fromEntries(journal.entries.map((entry) => [
    `m${String(entry.idx).padStart(4, '0')}`,
    readFileSync(join(migrationsDirectory, `${entry.tag}.sql`), 'utf8'),
  ])),
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

  it('upgrades the original ledger without losing corrections or tombstones', async () => {
    const fixture = openLedger(':memory:');
    try {
      await migrateLedger(fixture.client, {
        journal: { entries: journal.entries.slice(0, 1) },
        migrations: { m0000: migrations.migrations.m0000! },
      });
      fixture.sqlite.exec(`
        INSERT INTO transactions (id, amount_paise, direction, kind, occurred_at, source, user_edited, created_at, updated_at, deleted_at)
        VALUES ('old-corrected', 45000, 'debit', 'expense', 1, 'paste', 1, 1, 1, NULL),
               ('old-deleted', 75000, 'debit', 'expense', 1, 'paste', 0, 1, 1, 2);
      `);
      await fixture.ledger.migrateLedger();
      const corrected = await findTransaction(fixture.ledger, 'old-corrected');
      const deleted = await findTransaction(fixture.ledger, 'old-deleted');
      assert.equal(corrected?.amountPaise, 45000);
      assert.equal(corrected?.userEdited, true);
      assert.equal(corrected?.ruleId, null);
      assert.equal(deleted?.deletedAt?.getTime(), 2);
    } finally {
      fixture.sqlite.close();
    }
  });

  it('requires review, persists provenance, and protects corrected and deleted paste replays', async () => {
    const fixture = openLedger(':memory:');
    const sms = {
      sender: 'VM-HDFCBK-S',
      body: 'INR 450.00 debited from A/c XX1234 to VPA fictional@axisbank (UPI Ref No 612345678901).',
      receivedAt: Date.parse('2026-10-07T10:00:00Z'),
    };
    try {
      await fixture.ledger.migrateLedger();
      const prepared = preparePastedSms(sms);
      assert.equal(prepared.kind, 'needs-review');
      if (prepared.kind !== 'needs-review') throw new Error('Expected review');
      assert.ok(prepared.candidate);
      assert.equal(JSON.stringify(prepared).includes(sms.body), false);
      assert.equal((await fixture.ledger.db.select().from(transactions).all()).length, 0);
      assert.equal(await saveReviewedPaste(fixture.ledger, prepared, { amountPaise: 47000 }), 'inserted');
      let row = await findTransaction(fixture.ledger, prepared.identity.id);
      assert.equal(row?.amountPaise, 47000);
      assert.equal(row?.userEdited, true);
      assert.equal(row?.ruleId, prepared.ruleId);
      assert.equal(row?.ruleVersion, prepared.ruleVersion);
      assert.equal(row?.source, 'paste');

      const replay = preparePastedSms({ ...sms, receivedAt: sms.receivedAt + 86_400_000 });
      assert.equal(await saveReviewedPaste(fixture.ledger, replay, {}), 'duplicate');
      const alternateAlert = preparePastedSms({ ...sms, sender: 'AD-ICICIB-S', body: sms.body.replace('450.00', '450') });
      assert.equal(await saveReviewedPaste(fixture.ledger, alternateAlert, {}), 'duplicate');
      assert.equal((await findTransaction(fixture.ledger, prepared.identity.id))?.amountPaise, 47000);
      await fixture.ledger.editTransaction(prepared.identity.id, { amountPaise: 49000 });
      assert.equal(await saveReviewedPaste(fixture.ledger, replay, {}), 'duplicate');
      await fixture.ledger.softDeleteTransaction(prepared.identity.id);
      assert.equal(await saveReviewedPaste(fixture.ledger, replay, {}), 'duplicate');
      row = await findTransaction(fixture.ledger, prepared.identity.id);
      assert.equal(row?.amountPaise, 49000);
      assert.ok(row?.deletedAt);
      assert.equal((await fixture.ledger.db.select().from(transactions).all()).length, 1);
    } finally {
      fixture.sqlite.close();
    }
  });

  it('handles ambiguous and ignored pastes, validates corrections, and atomically deduplicates concurrent saves', async () => {
    const fixture = openLedger(':memory:');
    const raw = { sender: 'PASTE', receivedAt: Date.parse('2026-10-07T12:00:00Z'), body: 'Your A/c XX1234 INR 750 txn 612345678901' };
    try {
      await fixture.ledger.migrateLedger();
      const unknown = preparePastedSms(raw);
      assert.equal(unknown.kind, 'needs-review');
      if (unknown.kind !== 'needs-review') throw new Error('Expected review');
      assert.equal(unknown.candidate, null);
      await assert.rejects(saveReviewedPaste(fixture.ledger, unknown, {}));
      const values = { amountPaise: 75000, direction: 'debit' as const, kind: 'expense' as const, status: 'posted' as const, occurredAt: new Date(raw.receivedAt) };
      for (const amountPaise of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        await assert.rejects(saveReviewedPaste(fixture.ledger, unknown, { ...values, amountPaise }));
      }
      await assert.rejects(saveReviewedPaste(fixture.ledger, unknown, { ...values, occurredAt: new Date(NaN) }));
      await assert.rejects(saveReviewedPaste(fixture.ledger, unknown, { ...values, accountId: 'missing' }));
      const outcomes = await Promise.all([
        saveReviewedPaste(fixture.ledger, unknown, values),
        saveReviewedPaste(fixture.ledger, unknown, values),
      ]);
      assert.deepEqual(outcomes.sort(), ['duplicate', 'inserted']);
      const replay = preparePastedSms({ ...raw, receivedAt: raw.receivedAt + 86_400_000 });
      assert.equal(await saveReviewedPaste(fixture.ledger, replay, values), 'duplicate');
      const ignored = preparePastedSms({ ...raw, body: '123456 is your OTP for INR 450. Do not share.' });
      assert.equal(ignored.kind, 'ignored');
      await assert.rejects(saveReviewedPaste(fixture.ledger, ignored, values));
      const ambiguous = preparePastedSms({ ...raw, body: 'Paid you Rs 500 for dinner' });
      assert.equal(ambiguous.kind, 'needs-review');
      if (ambiguous.kind !== 'needs-review') throw new Error('Expected review');
      assert.ok(ambiguous.candidate);
      assert.equal(await saveReviewedPaste(fixture.ledger, ambiguous, { direction: 'credit', kind: 'income' }), 'inserted');
    } finally {
      fixture.sqlite.close();
    }
  });

  it('keeps opposite UPI movements separate and ignores injected correction metadata', async () => {
    const fixture = openLedger(':memory:');
    const sms = { sender: 'PASTE', body: 'INR 450 debited from A/c XX1234 (UPI Ref No 612345678901).', receivedAt: Date.parse('2026-10-07T10:00:00Z') };
    try {
      await fixture.ledger.migrateLedger();
      const debit = preparePastedSms(sms);
      const credit = preparePastedSms({ ...sms, body: sms.body.replace('debited from', 'credited to') });
      if (debit.kind !== 'needs-review' || credit.kind !== 'needs-review') throw new Error('Expected review');
      assert.notEqual(debit.identity.id, credit.identity.id);
      const injected = { id: 'forged', source: 'manual', ruleId: 'forged', body: sms.body, userEdited: false, deletedAt: new Date(1) };
      assert.equal(await saveReviewedPaste(fixture.ledger, debit, injected as Parameters<typeof saveReviewedPaste>[2]), 'inserted');
      assert.equal(await saveReviewedPaste(fixture.ledger, credit, {}), 'inserted');
      const row = await findTransaction(fixture.ledger, debit.identity.id);
      assert.equal(row?.source, 'paste');
      assert.equal(row?.ruleId, debit.ruleId);
      assert.equal(row?.userEdited, true);
      assert.equal(row?.deletedAt, null);
      assert.equal(await findTransaction(fixture.ledger, 'forged'), undefined);
      assert.equal(JSON.stringify(await fixture.ledger.db.select().from(transactions).all()).includes(sms.body), false);
    } finally {
      fixture.sqlite.close();
    }
  });

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
          entries: [...migrations.journal.entries, { idx: journal.entries.length, when: 1, tag: 'test_column', breakpoints: true }],
        },
        migrations: {
          ...migrations.migrations,
          [`m${String(journal.entries.length).padStart(4, '0')}`]: `ALTER TABLE accounts ADD COLUMN migration_marker TEXT NOT NULL DEFAULT 'preserved'`,
        },
      };
      await migrateLedger(fixture.client, nextMigrations);
      const account = fixture.sqlite.prepare('SELECT id, migration_marker FROM accounts WHERE id = ?').get('kept') as
        | { id: string; migration_marker: string }
        | undefined;
      assert.equal(account?.id, 'kept');
      assert.equal(account?.migration_marker, 'preserved');
      assert.equal((fixture.sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, journal.entries.length + 1);
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
          entries: [...migrations.journal.entries, { idx: journal.entries.length, when: 1, tag: 'broken', breakpoints: true }],
        },
        migrations: {
          ...migrations.migrations,
          [`m${String(journal.entries.length).padStart(4, '0')}`]: 'CREATE TABLE rollback_probe (id TEXT);--> statement-breakpoint SELECT * FROM missing_table',
        },
      };
      await assert.rejects(migrateLedger(failedFixture.client, brokenMigrations));
      assert.equal((failedFixture.sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, journal.entries.length);
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
