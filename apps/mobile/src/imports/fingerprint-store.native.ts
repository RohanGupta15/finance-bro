import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  createFingerprinter,
  createHmacSha256,
  decodeKeyHex,
  encodeKeyHex,
  type FingerprintSigner,
} from './fingerprint';

const storageKey = 'finance-bro.transaction-fingerprint-key.v1';
let keyLoading: Promise<Uint8Array> | undefined;

function loadKey(): Promise<Uint8Array> {
  keyLoading ??= (async () => {
    const stored = await SecureStore.getItemAsync(storageKey);
    if (stored !== null) return decodeKeyHex(stored);

    const key = await Crypto.getRandomBytesAsync(32);
    if (key.length !== 32) throw new Error('Could not generate a valid fingerprint key');
    await SecureStore.setItemAsync(storageKey, encodeKeyHex(key), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
  })().catch((error: unknown) => {
    keyLoading = undefined;
    throw error;
  });
  return keyLoading;
}

async function loadSigner(): Promise<FingerprintSigner> {
  const key = await loadKey();
  return createHmacSha256(key, async (bytes) => {
    const input = new Uint8Array(bytes.byteLength);
    input.set(bytes);
    return new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input.buffer));
  });
}

export const getFingerprinter = createFingerprinter(loadSigner);
