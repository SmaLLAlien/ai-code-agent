import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { AssistantMessage } from '@earendil-works/pi-ai';

/**
 * An empty answer cut by `content_filter`. juapi returns it now and then from a flaky upstream
 * (zero output tokens, before the model wrote anything); the same request passes on the next try.
 */
export function isEmptyContentFilter(message: AssistantMessage): boolean {
  return (
    message.stopReason === 'error' &&
    /content_filter/i.test(message.errorMessage ?? '') &&
    message.usage.output === 0
  );
}

/**
 * Lets pi's built-in auto-retry (backoff, failed attempt dropped from the model's history) also
 * cover empty `content_filter` answers. pi exposes no option for this, so its private check is
 * wrapped; pi is pinned to an exact version, re-check `_isRetryableError` when upgrading.
 */
export function retryEmptyContentFilter(session: AgentSession): void {
  const internal = session as unknown as {
    _isRetryableError(message: AssistantMessage): boolean;
  };
  if (typeof internal._isRetryableError !== 'function') {
    throw new Error('pi AgentSession._isRetryableError is gone: update agent/retry.ts');
  }
  const isRetryable = internal._isRetryableError.bind(session);
  internal._isRetryableError = (message) => isRetryable(message) || isEmptyContentFilter(message);
}
