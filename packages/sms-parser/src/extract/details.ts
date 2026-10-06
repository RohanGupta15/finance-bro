import type { Channel, Direction } from '../types';

const DEBIT = /\b(?:debited|spent|sent|paid|withdrawn|deducted|charged|purchased?)\b/i;
const CREDIT = /\b(?:credited|received|deposited|refunded|reversed|added to)\b/i;
// "Credit Card" and "Debit Card" are product names, not directions.
const CARD_NAMES = /\b(?:credit|debit) card\b/gi;

/** Whichever direction word comes first wins: "debited from A/c … and credited to VPA" is a debit. */
export function detectDirection(text: string): Direction | null {
  const t = text.replace(CARD_NAMES, 'card');
  const d = DEBIT.exec(t)?.index ?? Infinity;
  const c = CREDIT.exec(t)?.index ?? Infinity;
  if (d === Infinity && c === Infinity) return null;
  return d <= c ? 'debit' : 'credit';
}

const CHANNELS: readonly [Channel, RegExp][] = [
  ['upi', /\bupi\b/i],
  ['atm', /\batm\b|\bcash withdrawal\b|\bwithdrawn\b/i],
  ['imps', /\bimps\b/i],
  ['neft', /\bneft\b/i],
  ['rtgs', /\brtgs\b/i],
  ['card', /\bcard\b|\bpos\b/i],
  ['netbanking', /\bnet ?banking\b/i],
  ['wallet', /\bwallet\b/i],
];

export function detectChannel(text: string): Channel {
  return CHANNELS.find(([, re]) => re.test(text))?.[0] ?? 'unknown';
}

const PAYEE_KEYWORDS: Readonly<Record<Direction, readonly string[]>> = {
  debit: ['to', 'at', 'towards'],
  credit: ['from', 'by'],
};
const STOP = String.raw`(?=\s+(?:on|via|ref|upi|using|avl|is|was|for|dated|thru|and)\b|[.,;:(]|$)`;
const NOT_A_PAYEE = /^(?:neft|imps|rtgs|upi|your|a\/c|ac|acct|account|card|INR)\b/i;

/**
 * Best-effort payee/payer name ("at AMAZON", "from ACME PVT LTD").
 * Returns null when the only identifier is a VPA, which is reported separately.
 */
export function extractCounterparty(text: string, direction: Direction): string | null {
  for (const kw of PAYEE_KEYWORDS[direction]) {
    const re = new RegExp(String.raw`\b${kw}\s+(?:VPA\s+)?([A-Za-z0-9][A-Za-z0-9 &'@_/-]{0,40}?)${STOP}`, 'gi');
    for (const m of text.matchAll(re)) {
      const name = m[1]!.trim();
      if (NOT_A_PAYEE.test(name)) continue;
      return name.includes('@') ? null : name;
    }
  }
  return null;
}
