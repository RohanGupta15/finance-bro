/// <reference types="node" />

import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createFingerprinter,
  createHmacSha256,
  decodeKeyHex,
  encodeKeyHex,
  type Sha256,
} from '../src/imports/fingerprint';

const sha256: Sha256 = async (bytes) => Uint8Array.from(createHash('sha256').update(bytes).digest());

describe('device-keyed fingerprints', () => {
  it('matches RFC 4231 HMAC-SHA256 vectors, including keys longer than one block', async () => {
    const shortKey = new Uint8Array(20).fill(0x0b);
    const shortMac = await createHmacSha256(shortKey, sha256)(new TextEncoder().encode('Hi There'));
    assert.equal(encodeKeyHex(shortMac), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');

    const longKey = new Uint8Array(131).fill(0xaa);
    const longMac = await createHmacSha256(longKey, sha256)(new TextEncoder().encode('Test Using Larger Than Block-Size Key - Hash Key First'));
    assert.equal(encodeKeyHex(longMac), '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
  });

  it('separates key identity and transaction fingerprints and shares concurrent key loading', async () => {
    const key = new Uint8Array(32).fill(0x42);
    const signer = createHmacSha256(key, sha256);
    let loads = 0;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const getFingerprinter = createFingerprinter(async () => {
      loads += 1;
      await waiting;
      return signer;
    });

    const firstPromise = getFingerprinter();
    const secondPromise = getFingerprinter();
    assert.equal(loads, 1);
    release();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    const keyId = createHmac('sha256', key).update('finance-bro/fingerprint-key-id/v1\0').digest('hex');
    const fingerprint = createHmac('sha256', key)
      .update('finance-bro/transaction-fingerprint/v1\0fictional sms text')
      .digest('hex');
    assert.equal(first.keyId, keyId);
    assert.equal(await first.fingerprint('fictional sms text'), fingerprint);
    assert.equal(await second.fingerprint('fictional sms text'), fingerprint);
    assert.equal(first.keyId.length, 64);
    assert.notEqual(first.keyId, fingerprint);
  });

  it('retries failed loading without inventing an ephemeral key and rejects malformed serialized keys', async () => {
    let loads = 0;
    const getFingerprinter = createFingerprinter(async () => {
      loads += 1;
      if (loads === 1) throw new Error('storage unavailable');
      return createHmacSha256(new Uint8Array(32).fill(0x17), sha256);
    });

    await assert.rejects(getFingerprinter(), /storage unavailable/);
    assert.equal(loads, 1);
    assert.equal((await getFingerprinter()).keyId.length, 64);
    assert.equal(loads, 2);
    assert.throws(() => decodeKeyHex('not-a-serialized-key'), /malformed/);
    assert.equal(decodeKeyHex('00'.repeat(32)).length, 32);
  });
});
