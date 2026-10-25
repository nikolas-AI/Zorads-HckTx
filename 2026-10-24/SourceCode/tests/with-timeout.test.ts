import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../src/lib/with-timeout';

test('stalled session restoration ends instead of leaving the welcome page loading forever', async () => {
  await assert.rejects(withTimeout(new Promise<never>(() => {}), 10), /timed out/);
});
test('successful and failed lookups retain their results', async () => {
  assert.equal(await withTimeout(Promise.resolve('restored'), 1000), 'restored');
  await assert.rejects(withTimeout(Promise.reject(new Error('offline')), 1000), /offline/);
});
