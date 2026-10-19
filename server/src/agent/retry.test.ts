import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { isEmptyContentFilter, retryEmptyContentFilter } from './retry.js';

function failed(errorMessage: string, output = 0): AssistantMessage {
  return { stopReason: 'error', errorMessage, usage: { output } } as unknown as AssistantMessage;
}

test('isEmptyContentFilter matches only an empty content_filter error', () => {
  assert.equal(isEmptyContentFilter(failed('Provider finish_reason: content_filter')), true);
  assert.equal(isEmptyContentFilter(failed('Provider finish_reason: content_filter', 50)), false);
  assert.equal(isEmptyContentFilter(failed('401 Unauthorized')), false);
  const ok = { stopReason: 'stop', usage: { output: 0 } } as unknown as AssistantMessage;
  assert.equal(isEmptyContentFilter(ok), false);
});

test('retryEmptyContentFilter extends the session retry check and keeps the original one', () => {
  const session = { _isRetryableError: (m: AssistantMessage) => m.errorMessage === '503' };
  retryEmptyContentFilter(session as unknown as AgentSession);
  assert.equal(session._isRetryableError(failed('503')), true);
  assert.equal(session._isRetryableError(failed('Provider finish_reason: content_filter')), true);
  assert.equal(session._isRetryableError(failed('400 Bad Request')), false);
});

test('retryEmptyContentFilter fails loudly if pi drops the private check', () => {
  assert.throws(() => retryEmptyContentFilter({} as AgentSession), /update agent\/retry\.ts/);
});
