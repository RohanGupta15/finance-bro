import { createLedger, type LedgerMigrations, type LedgerSQLiteClient } from './ledger';
import { createPlanning } from './planning';
import { createPreferences } from './preferences';
import { createLedgerQueries } from './queries';
import { createLedgerCsvExporter } from '../exports/csv';
import { saveManualEntry, type ManualEntry } from './manual';
import { preparePastedSms, saveReviewedPaste, type PastePreparation, type ReviewCorrections } from '../imports/paste';
import { requiresDuplicateReview } from '../imports/key-state';
import type { Fingerprinter } from '../imports/fingerprint';
import type { RawSms } from '@finance-bro/sms-parser';

/** One local business API for screens; no network or UI dependencies. */
export function createDataLayer(client: LedgerSQLiteClient, migrations: LedgerMigrations, fingerprints?: () => Promise<Fingerprinter>) {
  const ledger = createLedger(client, migrations);
  const { db, insertReviewedPaste: _insertReviewedPaste, upsertImportedTransaction: _upsertImportedTransaction, ...manualLedger } = ledger;
  const queries = createLedgerQueries(db);
  const planning = createPlanning(db);
  return {
    ...manualLedger,
    ...queries,
    ...planning,
    ...createPreferences(db),
    ...createLedgerCsvExporter(db),
    saveManualEntry: (input: ManualEntry) => saveManualEntry(ledger, input),
    async preparePaste(raw: RawSms) {
      if (!fingerprints) throw new Error('A platform fingerprint provider is required for paste imports');
      const prepared = await preparePastedSms(raw, await fingerprints());
      if (prepared.kind === 'needs-review') {
        prepared.duplicateReviewRequired = await requiresDuplicateReview(ledger, prepared.fingerprintKeyId);
      }
      return prepared;
    },
    saveReviewedPaste: (prepared: PastePreparation, corrections: ReviewCorrections = {}, options: { acknowledgeDuplicateRisk?: boolean } = {}) =>
      saveReviewedPaste(ledger, prepared, corrections, options),
    async getBudgetSummary(month: string) {
      const [budgets, summary] = await Promise.all([
        planning.listBudgets(month), queries.getMonthlySummary(month),
      ]);
      return budgets.map((budget) => {
        const spending = summary.categories.find((category) => category.categoryId === budget.categoryId);
        const spentPaise = spending?.expensePaise ?? 0;
        const remaining = BigInt(budget.amountPaise) - BigInt(spentPaise);
        if (remaining > BigInt(Number.MAX_SAFE_INTEGER) || remaining < BigInt(Number.MIN_SAFE_INTEGER)) {
          throw new RangeError('Budget remaining exceeds safe integer paise');
        }
        return { ...budget, spentPaise, remainingPaise: Number(remaining), overBudget: remaining < 0n };
      });
    },
  };
}

export type DataLayer = ReturnType<typeof createDataLayer>;
