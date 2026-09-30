import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventType } from '@ag-ui/core';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { PiToAgUiTranslator } from './pi-to-agui.js';

function textEvent(type: 'text_start' | 'text_end'): AgentSessionEvent;
function textEvent(type: 'text_delta', delta: string): AgentSessionEvent;
function textEvent(type: string, delta?: string): AgentSessionEvent {
  return {
    type: 'message_update',
    assistantMessageEvent: { type, contentIndex: 0, delta, content: '' },
  } as unknown as AgentSessionEvent;
}

test('text stream maps to one AG-UI message', () => {
  const t = new PiToAgUiTranslator();
  const events = [
    textEvent('text_start'),
    textEvent('text_delta', 'Hel'),
    textEvent('text_delta', 'lo'),
    textEvent('text_end'),
  ].flatMap((e) => t.translate(e));

  assert.deepEqual(
    events.map((e) => e.type),
    [
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
    ],
  );
  const ids = new Set(events.map((e) => ('messageId' in e ? e.messageId : undefined)));
  assert.equal(ids.size, 1);
  assert.deepEqual(t.closeOpen(), []);
});

test('empty deltas are skipped and a delta without start opens a message', () => {
  const t = new PiToAgUiTranslator();
  assert.deepEqual(t.translate(textEvent('text_delta', '')), []);
  assert.deepEqual(
    t.translate(textEvent('text_delta', 'x')).map((e) => e.type),
    [EventType.TEXT_MESSAGE_START, EventType.TEXT_MESSAGE_CONTENT],
  );
});

test('closeOpen ends a message left open by an aborted run', () => {
  const t = new PiToAgUiTranslator();
  t.translate(textEvent('text_start'));
  assert.deepEqual(
    t.closeOpen().map((e) => e.type),
    [EventType.TEXT_MESSAGE_END],
  );
  assert.deepEqual(t.closeOpen(), []);
});

test('tool execution maps to START, ARGS, END and RESULT with one toolCallId', () => {
  const t = new PiToAgUiTranslator();
  const start = t.translate({
    type: 'tool_execution_start',
    toolCallId: 'call-1',
    toolName: 'read',
    args: { path: 'src/main.ts' },
  } as AgentSessionEvent);
  const end = t.translate({
    type: 'tool_execution_end',
    toolCallId: 'call-1',
    toolName: 'read',
    result: { content: [{ type: 'text', text: 'file body' }] },
    isError: false,
  } as AgentSessionEvent);

  assert.deepEqual(
    [...start, ...end].map((e) => e.type),
    [
      EventType.TOOL_CALL_START,
      EventType.TOOL_CALL_ARGS,
      EventType.TOOL_CALL_END,
      EventType.TOOL_CALL_RESULT,
    ],
  );
  assert.ok([...start, ...end].every((e) => 'toolCallId' in e && e.toolCallId === 'call-1'));
  assert.deepEqual(start[1], {
    type: EventType.TOOL_CALL_ARGS,
    toolCallId: 'call-1',
    delta: '{"path":"src/main.ts"}',
  });
  assert.equal(end[0] && 'content' in end[0] ? end[0].content : undefined, 'file body');
});

test('a tool call closes the open text message first', () => {
  const t = new PiToAgUiTranslator();
  t.translate(textEvent('text_start'));
  const events = t.translate({
    type: 'tool_execution_start',
    toolCallId: 'call-2',
    toolName: 'bash',
    args: { command: 'ls' },
  } as AgentSessionEvent);
  assert.equal(events[0]?.type, EventType.TEXT_MESSAGE_END);
});

test('tool errors are prefixed and model errors are recorded', () => {
  const t = new PiToAgUiTranslator();
  const [result] = t.translate({
    type: 'tool_execution_end',
    toolCallId: 'call-3',
    toolName: 'bash',
    result: { content: [{ type: 'text', text: 'boom' }] },
    isError: true,
  } as AgentSessionEvent);
  assert.equal(result && 'content' in result ? result.content : undefined, 'Error: boom');

  t.translate({
    type: 'message_update',
    assistantMessageEvent: { type: 'error', reason: 'error', error: { errorMessage: '401' } },
  } as unknown as AgentSessionEvent);
  assert.equal(t.error, '401');
});

test('a failed model request reported via message_end is recorded as the run error', () => {
  const t = new PiToAgUiTranslator();
  t.translate({
    type: 'message_end',
    message: { role: 'user', content: 'hi' },
  } as unknown as AgentSessionEvent);
  assert.equal(t.error, undefined);

  t.translate({
    type: 'message_end',
    message: { role: 'assistant', stopReason: 'error', errorMessage: '404 status code (no body)' },
  } as unknown as AgentSessionEvent);
  assert.equal(t.error, '404 status code (no body)');
});
