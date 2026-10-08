/// <reference types="node" />

import assert from 'node:assert/strict';
import { rmSync, rmdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ledgerMigrations, openTestLedger, temporaryFile } from './helpers/ledger';
import { runDataLayerRuntimeCheck } from './runtime-check';

describe('data layer runtime check', () => {
  it('seeds, closes, reopens, and verifies persisted app data', async () => {
    const { directory, filename } = temporaryFile();
    let fixture: ReturnType<typeof openTestLedger> | undefined;
    try {
      fixture = openTestLedger(filename);
      const seeded = await runDataLayerRuntimeCheck(fixture.client, ledgerMigrations, 'seed');
      assert.equal(seeded.passed, true);
      assert.ok(seeded.checks.length >= 7);
      const repeatedSeed = await runDataLayerRuntimeCheck(fixture.client, ledgerMigrations, 'seed');
      assert.deepEqual(repeatedSeed.checks, seeded.checks);
      fixture.sqlite.close();
      fixture = undefined;

      fixture = openTestLedger(filename);
      const reopened = await runDataLayerRuntimeCheck(fixture.client, ledgerMigrations, 'reopen');
      assert.equal(reopened.passed, true);
      assert.deepEqual(reopened.checks, seeded.checks);
    } finally {
      fixture?.sqlite.close();
      rmSync(filename, { force: true });
      rmdirSync(directory);
    }
  });
});
