import type { ParsedTxn, RawSms } from '../types';

/** cyrb53: small, fast, non-cryptographic 53-bit string hash. Pure JS so it runs in Hermes and JavaScriptCore. */
export function hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const REDELIVERY_WINDOW_MS = 60_000;

/**
 * Identifies the *same SMS* seen twice (re-delivery, catch-up re-reading the inbox,
 * iOS automation firing twice). Two genuinely separate identical messages inside a
 * minute would collide; UPI refs and timestamps in bodies make that rare.
 */
export function smsDedupeKey(sms: RawSms): string {
  const bucket = Math.floor(sms.receivedAt / REDELIVERY_WINDOW_MS);
  return `${hashString(`${sms.sender.trim().toUpperCase()}\n${sms.body}`)}:${bucket}`;
}

const SAME_TXN_WINDOW_MS = 10 * 60_000;

/**
 * True when two parsed SMS describe one money movement, e.g. the bank's alert and
 * a UPI app's alert for the same payment. Messages from the same institution are
 * never merged: two identical ₹20 payments from one account are two transactions.
 */
export function isSameTransaction(a: ParsedTxn, b: ParsedTxn): boolean {
  if (a.upiRef && b.upiRef) return a.upiRef === b.upiRef;
  if (a.institution !== null && a.institution === b.institution) return false;
  if (a.amountPaise !== b.amountPaise || a.direction !== b.direction || a.status !== b.status) return false;
  if (a.accountLast4 && b.accountLast4 && a.accountLast4 !== b.accountLast4) return false;
  return Math.abs(a.occurredAt - b.occurredAt) <= SAME_TXN_WINDOW_MS;
}

const TRANSFER_WINDOW_MS = 2 * 60 * 60_000;

/**
 * True when a debit from one of the user's accounts and a credit to another of
 * their accounts are the same money moving (self transfer, card bill payment).
 * `ownLast4s` comes from accounts the user has marked as their own.
 */
export function isTransferPair(debit: ParsedTxn, credit: ParsedTxn, ownLast4s: ReadonlySet<string>): boolean {
  return (
    debit.direction === 'debit' &&
    credit.direction === 'credit' &&
    debit.status === 'posted' &&
    credit.status === 'posted' &&
    debit.amountPaise === credit.amountPaise &&
    debit.accountLast4 !== null &&
    credit.accountLast4 !== null &&
    debit.accountLast4 !== credit.accountLast4 &&
    ownLast4s.has(debit.accountLast4) &&
    ownLast4s.has(credit.accountLast4) &&
    credit.occurredAt >= debit.occurredAt &&
    credit.occurredAt - debit.occurredAt <= TRANSFER_WINDOW_MS
  );
}
