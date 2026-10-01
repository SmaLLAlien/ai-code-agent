import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TITLE, toTitle } from './chat.registry.js';

test('toTitle takes the first line and shortens long text', () => {
  assert.equal(toTitle('  Coffee shop site\nwith a menu'), 'Coffee shop site');
  const long = toTitle('a'.repeat(100));
  assert.equal(long.length, 60);
  assert.ok(long.endsWith('…'));
  assert.equal(toTitle('   '), DEFAULT_TITLE);
});
