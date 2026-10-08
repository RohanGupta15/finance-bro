import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmSave as androidConfirmation } from '../src/utils/confirm-save.android';
import { confirmSave } from '../src/utils/confirm-save';

test('save confirmation remains optional when the native haptics module is unavailable', async () => {
  // Node has no Expo native runtime, exercising the missing-module recovery path.
  await assert.doesNotReject(androidConfirmation());
  await assert.doesNotReject(confirmSave());
});
