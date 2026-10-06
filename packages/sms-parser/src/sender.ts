import type { DltSuffix, SenderInfo } from './types';

/**
 * DLT header (6 chars, without operator prefix/suffix) → institution id.
 * Best-known headers; confirm each against real samples and add more as fixtures arrive.
 */
const INSTITUTIONS: Readonly<Record<string, string>> = {
  HDFCBK: 'hdfc',
  ICICIB: 'icici',
  ICICIT: 'icici',
  SBIINB: 'sbi',
  SBIUPI: 'sbi',
  ATMSBI: 'sbi',
  CBSSBI: 'sbi',
  SBICRD: 'sbicard',
  AXISBK: 'axis',
  KOTAKB: 'kotak',
  YESBNK: 'yes',
  IDFCFB: 'idfcfirst',
  INDUSB: 'indusind',
  PNBSMS: 'pnb',
  BOBTXN: 'bob',
  CANBNK: 'canara',
  UNIONB: 'union',
  AUBANK: 'au',
  PAYTMB: 'paytm',
  PHONPE: 'phonepe',
};

// "VM-HDFCBK-S", "AD-HDFCBK", "HDFCBK"
const DLT_HEADER = /^(?:[A-Z]{2}-)?([A-Z0-9]{6})(?:-([STPG]))?$/i;

export function resolveSender(sender: string): SenderInfo {
  const m = DLT_HEADER.exec(sender.trim());
  if (!m) return { header: sender.trim(), institution: null, dltSuffix: null };

  const header = m[1]!.toUpperCase();
  const suffix = m[2]?.toUpperCase() as DltSuffix | undefined;
  return { header, institution: INSTITUTIONS[header] ?? null, dltSuffix: suffix ?? null };
}
