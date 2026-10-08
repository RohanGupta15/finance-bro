import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExportCleanupError, writeCsvWithCleanup } from '../src/exports/save-csv-write';

describe('writeCsvWithCleanup', () => {
  it('does not clean up after a successful write', async () => {
    let cleanupCalled = false;
    await writeCsvWithCleanup(async () => {}, async () => { cleanupCalled = true; });
    assert.equal(cleanupCalled, false);
  });

  it('preserves the write error when cleanup succeeds', async () => {
    const writeError = new Error('write failed');
    let cleanupCalled = false;
    await assert.rejects(
      writeCsvWithCleanup(async () => { throw writeError; }, async () => { cleanupCalled = true; }),
      (error: unknown) => error === writeError,
    );
    assert.equal(cleanupCalled, true);
  });

  it('exposes both errors when cleanup fails', async () => {
    const writeError = new Error('write failed');
    const cleanupError = new Error('delete failed');
    await assert.rejects(
      writeCsvWithCleanup(async () => { throw writeError; }, async () => { throw cleanupError; }),
      (error: unknown) => {
        assert.ok(error instanceof ExportCleanupError);
        assert.equal(error.writeError, writeError);
        assert.equal(error.cleanupError, cleanupError);
        return true;
      },
    );
  });
});
