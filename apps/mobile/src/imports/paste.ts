import { parseSms } from '@finance-bro/sms-parser';
import type { ParsedTxn, RawSms } from '@finance-bro/sms-parser';
import type { Ledger, ReviewedPasteTransaction, TransactionPatch } from '../db/ledger';
import type { Fingerprinter } from './fingerprint';
import { DuplicateReviewRequiredError, requiresDuplicateReview } from './key-state';

export type PastePreparation =
  | { kind: 'ignored'; reason: string }
  | {
      kind: 'needs-review';
      candidate: ParsedTxn | null;
      ruleId: string | null;
      ruleVersion: number | null;
      identity: { id: string; dedupeKey: string; bodyHash: string };
      fingerprintKeyId: string;
      duplicateReviewRequired: boolean;
    };

export type ReviewCorrections = TransactionPatch;

export type PasteSaveResult = 'inserted' | 'duplicate';

export async function preparePastedSms(raw: RawSms, fingerprinter: Fingerprinter): Promise<PastePreparation> {
  const result = parseSms(raw);
  if (result.kind === 'ignored') return { kind: 'ignored', reason: result.reason };

  const candidate = result.kind === 'transaction' ? result.txn : result.candidate;
  const fingerprint = async (value: unknown[]) => {
    const result = await fingerprinter.fingerprint(JSON.stringify(value));
    if (!/^[a-f0-9]{64}$/.test(result)) throw new TypeError('Invalid keyed fingerprint');
    return result;
  };
  const bodyHash = await fingerprint(['body', raw.body]);
  // ponytail: identical no-ref pastes share an ID; add a user-selected time disambiguator for repeated identical payments.
  const identityKey = candidate?.upiRef
    ? `upi:${await fingerprint(['upi', candidate.upiRef, candidate.direction, candidate.status, candidate.kind])}`
    : `body:${await fingerprint(['sms', raw.sender.trim().toUpperCase(), raw.body])}`;

  return {
    kind: 'needs-review',
    candidate,
    ruleId: result.ruleId,
    ruleVersion: result.ruleVersion,
    identity: { id: `paste:${identityKey}`, dedupeKey: identityKey, bodyHash },
    fingerprintKeyId: fingerprinter.keyId,
    duplicateReviewRequired: false,
  };
}

export async function saveReviewedPaste(
  ledger: Ledger,
  prepared: PastePreparation,
  corrections: ReviewCorrections = {},
  options: { acknowledgeDuplicateRisk?: boolean } = {},
): Promise<PasteSaveResult> {
  if (prepared.kind !== 'needs-review') throw new TypeError('Ignored SMS cannot be saved');
  if (!/^[a-f0-9]{64}$/.test(prepared.identity.bodyHash) ||
      !/^(upi|body):[a-f0-9]{64}$/.test(prepared.identity.dedupeKey) ||
      prepared.identity.id !== `paste:${prepared.identity.dedupeKey}`) {
    throw new TypeError('Invalid keyed paste identity');
  }
  if (await requiresDuplicateReview(ledger, prepared.fingerprintKeyId) && options.acknowledgeDuplicateRisk !== true) {
    throw new DuplicateReviewRequiredError();
  }
  const candidate = prepared.candidate;
  if (!candidate) {
    for (const key of ['amountPaise', 'direction', 'kind', 'status', 'occurredAt'] as const) {
      if (corrections[key] === undefined) throw new TypeError(`${key} is required for an unparsed SMS`);
    }
  }

  const value = <K extends keyof ReviewCorrections>(key: K, fallback: ReviewCorrections[K]) =>
    corrections[key] === undefined ? fallback : corrections[key] as ReviewCorrections[K];
  const amountPaise = value('amountPaise', candidate?.amountPaise);
  const direction = value('direction', candidate?.direction);
  const kind = value('kind', candidate?.kind);
  const status = value('status', candidate?.status);
  const occurredAt = value('occurredAt', candidate ? new Date(candidate.occurredAt) : undefined);
  if (amountPaise === undefined || direction === undefined || kind === undefined || status === undefined || occurredAt === undefined) {
    throw new TypeError('A complete reviewed transaction is required');
  }

  const insert: ReviewedPasteTransaction = {
    id: prepared.identity.id,
    amountPaise,
    direction,
    kind,
    status,
    occurredAt,
    dedupeKey: prepared.identity.dedupeKey,
    bodyHash: prepared.identity.bodyHash,
    ruleId: prepared.ruleId,
    ruleVersion: prepared.ruleVersion,
    accountId: value('accountId', null),
    counterparty: value('counterparty', candidate?.counterparty ?? null),
    merchantId: value('merchantId', null),
    categoryId: value('categoryId', null),
    note: value('note', null),
    upiRef: value('upiRef', candidate?.upiRef ?? null),
    linkedTxnId: value('linkedTxnId', null),
    excludeFromStats: value('excludeFromStats', false),
  };
  return await ledger.insertReviewedPaste(insert) ? 'inserted' : 'duplicate';
}
