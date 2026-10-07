export type Sha256 = (bytes: Uint8Array) => Promise<Uint8Array>;
export type FingerprintSigner = (bytes: Uint8Array) => Promise<Uint8Array>;
export type FingerprintKeyManager = () => Promise<FingerprintSigner>;
export type Fingerprinter = {
  keyId: string;
  fingerprint(text: string): Promise<string>;
};

const hmacBlockSize = 64;
const textEncoder = new TextEncoder();
const keyIdDomain = textEncoder.encode('finance-bro/fingerprint-key-id/v1\0');
const fingerprintDomain = 'finance-bro/transaction-fingerprint/v1\0';

export function encodeKeyHex(key: Uint8Array): string {
  return [...key].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function decodeKeyHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2}){32}$/i.test(value)) throw new Error('Stored fingerprint key is malformed');
  return Uint8Array.from(value.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

export function createHmacSha256(key: Uint8Array, sha256: Sha256): FingerprintSigner {
  const keyMaterial = Uint8Array.from(key);
  return async (message) => {
    const digest = async (bytes: Uint8Array) => {
      const value = await sha256(bytes);
      if (value.length !== 32) throw new Error('SHA-256 digest must contain 32 bytes');
      return value;
    };
    const normalizedKey = keyMaterial.length > hmacBlockSize ? await digest(keyMaterial) : keyMaterial;

    const innerPad = new Uint8Array(hmacBlockSize + message.length);
    const outerPad = new Uint8Array(hmacBlockSize + 32);
    for (let index = 0; index < hmacBlockSize; index += 1) {
      const byte = normalizedKey[index] ?? 0;
      innerPad[index] = byte ^ 0x36;
      outerPad[index] = byte ^ 0x5c;
    }
    innerPad.set(message, hmacBlockSize);
    outerPad.set(await digest(innerPad), hmacBlockSize);
    return digest(outerPad);
  };
}

function hex(bytes: Uint8Array): string {
  return encodeKeyHex(bytes);
}

export function createFingerprinter(loadSigner: FingerprintKeyManager): () => Promise<Fingerprinter> {
  let loading: Promise<Fingerprinter> | undefined;
  return () => {
    loading ??= (async () => {
      const sign = await loadSigner();
      return {
        keyId: hex(await sign(keyIdDomain)),
        async fingerprint(text: string): Promise<string> {
          const message = textEncoder.encode(`${fingerprintDomain}${text}`);
          return hex(await sign(message));
        },
      };
    })().catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
    return loading;
  };
}
