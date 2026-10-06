// "A/c XX1234", "a/c no. XXXXXX1234", "A/C *123", "account ending with 1234", "Card XX4321"
const LAST_DIGITS =
  /\b(?:a\/c|acct|account|ac|card)(?:\s*(?:no\.?|number))?(?:\s*ending(?:\s*(?:with|in))?)?\s*[:-]?\s*[x*]*\s*(\d{3,4})\b/i;

/** Last 3–4 digits of the account or card. Some banks mask down to 3. */
export function extractLast4(text: string): string | null {
  return LAST_DIGITS.exec(text)?.[1] ?? null;
}
