// Runs on normalised text, where every currency marker is "INR ".
const AMOUNT = /INR ([\d,]+(?:\.\d{1,2})?)/g;

/** Words that mean the amount right after them is not the transaction amount. */
const NON_TXN_CONTEXT = /\b(?:bal|balance|lmt|limit|avl|available|outstanding|due)\b[^\d]{0,25}$/i;
const BALANCE_CONTEXT = /\b(?:bal|balance)\b[^\d]{0,25}$/i;

/** "1,23,456.5" → 12345650. Integer maths only; returns null for malformed input. */
export function toPaise(amount: string): number | null {
  const clean = amount.replace(/,/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [rupees, paise = ''] = clean.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
}

interface AmountMention {
  paise: number;
  before: string;
}

function mentions(text: string): AmountMention[] {
  const out: AmountMention[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const paise = toPaise(m[1]!);
    if (paise !== null) out.push({ paise, before: text.slice(Math.max(0, m.index - 40), m.index) });
  }
  return out;
}

/** First amount that isn't a balance/limit/due figure. */
export function extractTxnAmount(text: string): number | null {
  const hit = mentions(text).find((m) => m.paise > 0 && !NON_TXN_CONTEXT.test(m.before));
  return hit?.paise ?? null;
}

export function extractBalance(text: string): number | null {
  return mentions(text).find((m) => BALANCE_CONTEXT.test(m.before))?.paise ?? null;
}

export function hasAmount(text: string): boolean {
  return mentions(text).length > 0;
}
