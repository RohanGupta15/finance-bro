import { hashString, parseSms, smsDedupeKey } from '@finance-bro/sms-parser';
import type { ParsedTxn, RawSms } from '@finance-bro/sms-parser';
import type { Ledger, ReviewedPasteTransaction, TransactionPatch } from '../db/ledger';

export type PastePreparation =
  | { kind: 'ignored'; reason: string }
  | {
      kind: 'needs-review';
      candidate: ParsedTxn | null;
      ruleId: string | null;
      ruleVersion: number | null;
      identity: { id: string; dedupeKey: string; bodyHash: string };
    };

export type ReviewCorrections = TransactionPatch;

export type PasteSaveResult = 'inserted' | 'duplicate';

export function preparePastedSms(raw: RawSms): PastePreparation {
  const result = parseSms(raw);
  if (result.kind === 'ignored') return { kind: 'ignored', reason: result.reason };

  const candidate = result.kind === 'transaction' ? result.txn : result.candidate;
  const bodyHash = hashString(raw.body);
  // ponytail: identical no-ref pastes share an ID; add a user-selected time disambiguator for repeated identical payments.
  // hashString is non-cryptographic, so these IDs provide dedupe stability, not collision-resistant security.
  const identityKey = candidate?.upiRef
    ? `upi:${hashString(`${candidate.upiRef}\n${candidate.direction}\n${candidate.status}\n${candidate.kind}`)}`
    : `body:${smsDedupeKey({ ...raw, receivedAt: 0 })}`;

  return {
    kind: 'needs-review',
    candidate,
    ruleId: result.ruleId,
    ruleVersion: result.ruleVersion,
    identity: { id: `paste:${identityKey}`, dedupeKey: identityKey, bodyHash },
  };
}

export async function saveReviewedPaste(
  ledger: Ledger,
  prepared: PastePreparation,
  corrections: ReviewCorrections = {},
): Promise<PasteSaveResult> {
  if (prepared.kind !== 'needs-review') throw new TypeError('Ignored SMS cannot be saved');
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
