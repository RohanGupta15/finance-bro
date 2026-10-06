import { classify } from './classify';
import { normalise } from './normalise';
import { rulesFor } from './rules';
import type { ParseResult, RawSms } from './types';

/** Pure: same SMS in, same result out. Never reads the clock or any global state. */
export function parseSms(raw: RawSms): ParseResult {
  const sms = normalise(raw);
  const classification = classify(sms);

  if (classification !== 'transaction' && classification !== 'unknown') {
    return { kind: 'ignored', reason: classification };
  }

  for (const rule of rulesFor(sms.senderInfo.institution)) {
    const match = rule.match(sms);
    if (!match) continue;
    if (classification === 'transaction' && match.confidence !== 'low') {
      return { kind: 'transaction', txn: match.txn, ruleId: rule.id, ruleVersion: rule.version, confidence: match.confidence };
    }
    return { kind: 'review', candidate: match.txn, ruleId: rule.id, ruleVersion: rule.version };
  }

  return { kind: 'review', candidate: null, ruleId: null, ruleVersion: null };
}
