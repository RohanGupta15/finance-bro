import journal from '../../drizzle/meta/_journal.json';
import initialLedger from '../../drizzle/0000_initial_ledger.sql';
import type { LedgerMigrations } from './ledger';

export const ledgerMigrations: LedgerMigrations = {
  journal,
  migrations: { m0000: initialLedger },
};
