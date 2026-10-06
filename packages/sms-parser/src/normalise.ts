import { resolveSender } from './sender';
import type { NormalisedSms, RawSms } from './types';

/**
 * Canonicalises an SMS so rules only deal with one spelling of things:
 * collapsed whitespace and a single currency token ("INR ").
 */
export function normalise(sms: RawSms): NormalisedSms {
  const text = sms.body
    .replace(/\s+/g, ' ')
    .replace(/₹\s*/g, 'INR ')
    .replace(/\bRs\.?\s*(?=\d)/gi, 'INR ')
    .replace(/\bINR\.?\s*(?=\d)/gi, 'INR ')
    .trim();

  return { ...sms, text, senderInfo: resolveSender(sms.sender) };
}
