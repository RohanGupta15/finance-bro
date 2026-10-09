import { describe, expect, it } from 'vitest';

import { isSameTransaction, isTransferPair, resolveSender, smsDedupeKey, toPaise } from '../src';
import type { ParsedTxn } from '../src';

describe('toPaise', () => {
  it.each([
    ['500', 50000],
    ['1,23,456.5', 12345650],
    ['0.05', 5],
    ['12.34', 1234],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('%s → %i', (input, paise) => expect(toPaise(input)).toBe(paise));

  it('rejects malformed amounts', () => {
    expect(toPaise('12.345')).toBeNull();
    expect(toPaise('')).toBeNull();
  });

  it('rejects amounts outside safe integer paise', () => {
    expect(toPaise('90071992547409.92')).toBeNull();
    expect(toPaise('999999999999999999999999999999999999')).toBeNull();
  });
});

describe('resolveSender', () => {
  it('strips operator prefix and DLT suffix', () => {
    expect(resolveSender('VM-HDFCBK-S')).toEqual({ header: 'HDFCBK', institution: 'hdfc', dltSuffix: 'S' });
    expect(resolveSender('AD-ICICIB')).toEqual({ header: 'ICICIB', institution: 'icici', dltSuffix: null });
  });

  it('leaves phone numbers and unknown headers without an institution', () => {
    expect(resolveSender('+919800000000').institution).toBeNull();
    expect(resolveSender('VM-ABCDEF-T')).toEqual({ header: 'ABCDEF', institution: null, dltSuffix: 'T' });
  });
});

describe('smsDedupeKey', () => {
  const sms = { sender: 'VM-HDFCBK-S', body: 'INR 450 debited', receivedAt: 1_000_000 };

  it('is stable for a re-delivered SMS', () => {
    expect(smsDedupeKey({ ...sms, sender: 'vm-hdfcbk-s ' })).toBe(smsDedupeKey(sms));
  });

  it('differs when the body differs', () => {
    expect(smsDedupeKey({ ...sms, body: 'INR 451 debited' })).not.toBe(smsDedupeKey(sms));
  });
});

const base: ParsedTxn = {
  amountPaise: 45000,
  direction: 'debit',
  kind: 'expense',
  status: 'posted',
  channel: 'upi',
  institution: 'hdfc',
  accountLast4: '1234',
  counterparty: null,
  vpa: null,
  upiRef: null,
  balancePaise: null,
  occurredAt: 0,
};

describe('isSameTransaction', () => {
  it('matches on UPI ref when both have one', () => {
    expect(isSameTransaction({ ...base, upiRef: '612345678901' }, { ...base, institution: 'phonepe', upiRef: '612345678901' })).toBe(true);
  });

  it('merges bank + app alerts for the same amount within the window', () => {
    expect(isSameTransaction(base, { ...base, institution: 'phonepe', accountLast4: null, occurredAt: 5 * 60_000 })).toBe(true);
  });

  it('never merges two alerts from the same institution', () => {
    expect(isSameTransaction(base, { ...base, occurredAt: 30_000 })).toBe(false);
  });
});

describe('isTransferPair', () => {
  const own = new Set(['1234', '9876']);
  const credit: ParsedTxn = { ...base, direction: 'credit', kind: 'income', institution: 'icici', accountLast4: '9876', occurredAt: 60_000 };

  it('pairs a debit and credit between own accounts', () => {
    expect(isTransferPair(base, credit, own)).toBe(true);
  });

  it('ignores credits to accounts that are not the user’s', () => {
    expect(isTransferPair(base, { ...credit, accountLast4: '5555' }, own)).toBe(false);
  });
});
