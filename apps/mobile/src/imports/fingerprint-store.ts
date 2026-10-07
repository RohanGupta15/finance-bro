import type { Fingerprinter } from './fingerprint';

export async function getFingerprinter(): Promise<Fingerprinter> {
  throw new Error('Fingerprinting is unavailable on this platform');
}
