import { and, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  accounts,
  categories,
  transactionDirections,
  transactionKinds,
  transactionStatuses,
  transactions,
} from './schema';

export type LedgerMigrations = {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
  };
  migrations: Record<string, string>;
};

export type LedgerSQLiteClient = Pick<
  SQLiteDatabase,
  'execAsync' | 'getFirstAsync' | 'withTransactionAsync' | 'prepareAsync'
>;

type TransactionInsert = typeof transactions.$inferInsert;
type TransactionRow = typeof transactions.$inferSelect;
export type ReviewedPasteTransaction = Pick<
  TransactionRow,
  | 'id'
  | 'amountPaise'
  | 'direction'
  | 'kind'
  | 'status'
  | 'occurredAt'
  | 'dedupeKey'
  | 'bodyHash'
  | 'ruleId'
  | 'ruleVersion'
> & Partial<Pick<
  TransactionRow,
  | 'accountId'
  | 'counterparty'
  | 'merchantId'
  | 'categoryId'
  | 'note'
  | 'upiRef'
  | 'linkedTxnId'
  | 'excludeFromStats'
>>;
export type NewTransaction = Omit<
  TransactionInsert,
  'createdAt' | 'updatedAt' | 'deletedAt' | 'userEdited'
> & Partial<Pick<TransactionInsert, 'createdAt' | 'updatedAt'>>;
export type ImportedTransaction = Omit<NewTransaction, 'source' | 'createdAt' | 'updatedAt'> & {
  source: Exclude<TransactionInsert['source'], 'manual'>;
};
export type TransactionPatch = Partial<
  Pick<
    TransactionInsert,
    | 'amountPaise'
    | 'direction'
    | 'kind'
    | 'status'
    | 'accountId'
    | 'counterparty'
    | 'merchantId'
    | 'categoryId'
    | 'occurredAt'
    | 'note'
    | 'upiRef'
    | 'linkedTxnId'
    | 'excludeFromStats'
  >
>;

export function assertValidAmountPaise(amountPaise: number): void {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new RangeError('amountPaise must be a positive safe integer');
  }
}

function assertValidDate(value: Date, name: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${name} must be a valid Date`);
  }
}

function assertValidReviewedPaste(input: ReviewedPasteTransaction): void {
  if (typeof input.id !== 'string' || input.id.length === 0) throw new TypeError('id must be a non-empty string');
  assertValidAmountPaise(input.amountPaise);
  assertValidDate(input.occurredAt, 'occurredAt');
  if (!transactionDirections.includes(input.direction)) throw new TypeError('direction is invalid');
  if (!transactionKinds.includes(input.kind)) throw new TypeError('kind is invalid');
  if (!transactionStatuses.includes(input.status)) throw new TypeError('status is invalid');
  if (typeof input.dedupeKey !== 'string' || input.dedupeKey.length === 0) throw new TypeError('dedupeKey is required');
  if (typeof input.bodyHash !== 'string' || input.bodyHash.length === 0) throw new TypeError('bodyHash is required');
  if ((input.ruleId === null) !== (input.ruleVersion === null)) throw new TypeError('ruleId and ruleVersion must both be null or set');
  if (input.ruleId !== null && (typeof input.ruleId !== 'string' || input.ruleId.length === 0)) {
    throw new TypeError('ruleId must be a non-empty string or null');
  }
  if (input.ruleVersion !== null && (!Number.isSafeInteger(input.ruleVersion) || input.ruleVersion <= 0)) {
    throw new TypeError('ruleVersion must be a positive safe integer or null');
  }
}

export async function migrateLedger(client: LedgerSQLiteClient, migrations: LedgerMigrations): Promise<void> {
  const entries = migrations.journal.entries;
  if (entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Ledger migration journal must have contiguous indexes starting at 0');
  }

  for (const entry of entries) {
    if (!migrations.migrations[`m${String(entry.idx).padStart(4, '0')}`]) {
      throw new Error(`Missing ledger migration: ${entry.tag}`);
    }
  }

  await client.execAsync('PRAGMA foreign_keys = ON');
  const latestVersion = entries.length;
  const currentVersion = (await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (!Number.isInteger(currentVersion) || currentVersion < 0 || currentVersion > latestVersion) {
    throw new Error(`Database schema version ${currentVersion} is newer than this app supports (${latestVersion})`);
  }
  if (currentVersion === latestVersion) return;

  await client.withTransactionAsync(async () => {
    const version = (await client.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
    if (!Number.isInteger(version) || version < 0 || version > latestVersion) {
      throw new Error(`Database schema version ${version} is newer than this app supports (${latestVersion})`);
    }

    for (const entry of entries.slice(version)) {
      const migration = migrations.migrations[`m${String(entry.idx).padStart(4, '0')}`];
      if (!migration) throw new Error(`Missing ledger migration: ${entry.tag}`);
      for (const statement of migration.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) {
        await client.execAsync(statement);
      }
      await client.execAsync(`PRAGMA user_version = ${entry.idx + 1}`);
    }
  });
}

export function createLedger(client: LedgerSQLiteClient, migrations: LedgerMigrations) {
  const db = drizzle(async (query, params, method) => {
    const statement = await client.prepareAsync(query);
    try {
      const rows = await (await statement.executeForRawResultAsync(params)).getAllAsync();
      return { rows: method === 'get' ? rows[0] : rows };
    } finally {
      await statement.finalizeAsync();
    }
  }, { schema: { accounts, categories, transactions } });
  const now = () => new Date();

  return {
    db,
    migrateLedger: () => migrateLedger(client, migrations),
    async createTransaction(input: NewTransaction): Promise<void> {
      assertValidAmountPaise(input.amountPaise);
      assertValidDate(input.occurredAt, 'occurredAt');
      const createdAt = input.createdAt ?? now();
      const updatedAt = input.updatedAt ?? createdAt;
      assertValidDate(createdAt, 'createdAt');
      assertValidDate(updatedAt, 'updatedAt');
      await db.insert(transactions).values({
        ...input,
        createdAt,
        updatedAt,
        deletedAt: null,
        userEdited: input.source === 'manual',
      }).run();
    },
    async editTransaction(id: string, patch: TransactionPatch): Promise<boolean> {
      if (patch.amountPaise !== undefined) assertValidAmountPaise(patch.amountPaise);
      if (patch.occurredAt !== undefined) assertValidDate(patch.occurredAt, 'occurredAt');
      const changes = Object.fromEntries(Object.entries({
        amountPaise: patch.amountPaise,
        direction: patch.direction,
        kind: patch.kind,
        status: patch.status,
        accountId: patch.accountId,
        counterparty: patch.counterparty,
        merchantId: patch.merchantId,
        categoryId: patch.categoryId,
        occurredAt: patch.occurredAt,
        note: patch.note,
        upiRef: patch.upiRef,
        linkedTxnId: patch.linkedTxnId,
        excludeFromStats: patch.excludeFromStats,
      }).filter(([, value]) => value !== undefined)) as TransactionPatch;
      return db.update(transactions)
        .set({ ...changes, userEdited: true, updatedAt: now() })
        .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
        .returning({ id: transactions.id }).all().then((rows) => rows.length > 0);
    },
    async softDeleteTransaction(id: string, deletedAt = now()): Promise<boolean> {
      assertValidDate(deletedAt, 'deletedAt');
      return db.update(transactions)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
        .returning({ id: transactions.id }).all().then((rows) => rows.length > 0);
    },
    async upsertImportedTransaction(input: ImportedTransaction): Promise<boolean> {
      const source: string = input.source;
      if (source === 'manual') throw new TypeError('Imported transactions cannot use the manual source');
      assertValidAmountPaise(input.amountPaise);
      assertValidDate(input.occurredAt, 'occurredAt');
      const createdAt = now();
      const updatedAt = createdAt;
      const updates = {
        amountPaise: input.amountPaise,
        direction: input.direction,
        kind: input.kind,
        status: input.status,
        accountId: input.accountId,
        counterparty: input.counterparty,
        merchantId: input.merchantId,
        categoryId: input.categoryId,
        occurredAt: input.occurredAt,
        note: input.note,
        source: input.source,
        smsRefId: input.smsRefId,
        upiRef: input.upiRef,
        dedupeKey: input.dedupeKey,
        bodyHash: input.bodyHash,
        ruleId: input.ruleId,
        ruleVersion: input.ruleVersion,
        linkedTxnId: input.linkedTxnId,
        excludeFromStats: input.excludeFromStats,
        updatedAt,
      };
      return db.insert(transactions)
        .values({ ...updates, id: input.id, createdAt, deletedAt: null, userEdited: false })
        .onConflictDoUpdate({
          target: transactions.id,
          set: updates,
          where: and(
            eq(transactions.userEdited, false),
            isNull(transactions.deletedAt),
            sql`${transactions.source} <> 'manual'`,
          ),
        })
        .returning({ id: transactions.id }).all().then((rows) => rows.length > 0);
    },
    async insertReviewedPaste(input: ReviewedPasteTransaction): Promise<boolean> {
      assertValidReviewedPaste(input);
      const createdAt = now();
      return db.insert(transactions).values({
        id: input.id,
        amountPaise: input.amountPaise,
        direction: input.direction,
        kind: input.kind,
        status: input.status,
        accountId: input.accountId,
        counterparty: input.counterparty,
        merchantId: input.merchantId,
        categoryId: input.categoryId,
        occurredAt: input.occurredAt,
        note: input.note,
        source: 'paste',
        upiRef: input.upiRef,
        dedupeKey: input.dedupeKey,
        bodyHash: input.bodyHash,
        ruleId: input.ruleId,
        ruleVersion: input.ruleVersion,
        linkedTxnId: input.linkedTxnId,
        excludeFromStats: input.excludeFromStats ?? false,
        userEdited: true,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      }).onConflictDoNothing()
        .returning({ id: transactions.id }).all().then((rows) => rows.length > 0);
    },
  };
}

export type Ledger = ReturnType<typeof createLedger>;
