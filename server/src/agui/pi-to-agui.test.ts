import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type AGUIEvent, EventType } from '@ag-ui/core';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { createChatState } from '../chats/chat-state.js';
import { CustomEventName, PiToAgUiTranslator } from './pi-to-agui.js';

function translator(): PiToAgUiTranslator {
  return new PiToAgUiTranslator(createChatState());
}

function update(type: string, delta?: string): AgentSessionEvent {
  return {
    type: 'message_update',
    assistantMessageEvent: { type, contentIndex: 0, delta, content: '' },
  } as unknown as AgentSessionEvent;
}

function toolStart(toolCallId: string, toolName: string, args: object): AgentSessionEvent {
  return { type: 'tool_execution_start', toolCallId, toolName, args } as AgentSessionEvent;
}

function toolEnd(toolCallId: string, toolName: string, text: string, isError = false): AgentSessionEvent {
  return {
    type: 'tool_execution_end',
    toolCallId,
    toolName,
    result: { content: [{ type: 'text', text }] },
    isError,
  } as AgentSessionEvent;
}

const types = (events: AGUIEvent[]): string[] => events.map((e) => e.type);

test('text stream maps to one AG-UI message', () => {
  const t = translator();
  const events = [
    update('text_start'),
    update('text_delta', 'Hel'),
    update('text_delta', 'lo'),
    update('text_end'),
  ].flatMap((e) => t.translate(e));

  assert.deepEqual(types(events), [
    EventType.TEXT_MESSAGE_START,
    EventType.TEXT_MESSAGE_CONTENT,
    EventType.TEXT_MESSAGE_CONTENT,
    EventType.TEXT_MESSAGE_END,
  ]);
  const ids = new Set(events.map((e) => ('messageId' in e ? e.messageId : undefined)));
  assert.equal(ids.size, 1);
  assert.deepEqual(t.closeOpen(), []);
});

test('empty deltas are skipped and a delta without start opens a message', () => {
  const t = translator();
  assert.deepEqual(t.translate(update('text_delta', '')), []);
  assert.deepEqual(types(t.translate(update('text_delta', 'x'))), [
    EventType.TEXT_MESSAGE_START,
    EventType.TEXT_MESSAGE_CONTENT,
  ]);
});

test('closeOpen ends a message left open by an aborted run', () => {
  const t = translator();
  t.translate(update('text_start'));
  assert.deepEqual(types(t.closeOpen()), [EventType.TEXT_MESSAGE_END]);
  assert.deepEqual(t.closeOpen(), []);
});

test('thinking maps to a reasoning span that closes before text starts', () => {
  const t = translator();
  const events = [
    update('thinking_start'),
    update('thinking_delta', 'hmm'),
    update('text_start'),
  ].flatMap((e) => t.translate(e));
  assert.deepEqual(types(events), [
    EventType.REASONING_START,
    EventType.REASONING_MESSAGE_START,
    EventType.REASONING_MESSAGE_CONTENT,
    EventType.REASONING_MESSAGE_END,
    EventType.REASONING_END,
    EventType.TEXT_MESSAGE_START,
  ]);
  // Thinking after text closes the text message; closeOpen then ends only the reasoning.
  assert.deepEqual(types(t.translate(update('thinking_start'))), [
    EventType.TEXT_MESSAGE_END,
    EventType.REASONING_START,
    EventType.REASONING_MESSAGE_START,
  ]);
  assert.deepEqual(types(t.closeOpen()), [EventType.REASONING_MESSAGE_END, EventType.REASONING_END]);
});

test('tool execution maps to START, ARGS, END and RESULT with one toolCallId', () => {
  const t = translator();
  const start = t.translate(toolStart('call-1', 'read', { path: 'src/main.ts' }));
  const end = t.translate(toolEnd('call-1', 'read', 'file body'));

  assert.deepEqual(types([...start, ...end]), [
    EventType.TOOL_CALL_START,
    EventType.TOOL_CALL_ARGS,
    EventType.TOOL_CALL_END,
    EventType.TOOL_CALL_RESULT,
  ]);
  assert.ok([...start, ...end].every((e) => 'toolCallId' in e && e.toolCallId === 'call-1'));
  assert.deepEqual(start[1], {
    type: EventType.TOOL_CALL_ARGS,
    toolCallId: 'call-1',
    delta: '{"path":"src/main.ts"}',
  });
  assert.equal(end[0] && 'content' in end[0] ? end[0].content : undefined, 'file body');
});

test('a tool call closes the open text message first', () => {
  const t = translator();
  t.translate(update('text_start'));
  const events = t.translate(toolStart('call-2', 'bash', { command: 'ls' }));
  assert.equal(events[0]?.type, EventType.TEXT_MESSAGE_END);
});

test('live tool output and tool errors become CUSTOM events', () => {
  const t = translator();
  const [output] = t.translate({
    type: 'tool_execution_update',
    toolCallId: 'call-3',
    toolName: 'bash',
    args: {},
    partialResult: { content: [{ type: 'text', text: 'installing…' }] },
  } as AgentSessionEvent);
  assert.deepEqual(output, {
    type: EventType.CUSTOM,
    name: CustomEventName.ToolOutput,
    value: { toolCallId: 'call-3', text: 'installing…' },
  });

  const events = t.translate(toolEnd('call-3', 'bash', 'boom', true));
  assert.deepEqual(types(events), [EventType.CUSTOM, EventType.TOOL_CALL_RESULT]);
  assert.deepEqual(events[0], {
    type: EventType.CUSTOM,
    name: CustomEventName.ToolStatus,
    value: { toolCallId: 'call-3', isError: true },
  });
});

test('ask_user emits its questions and update_todo emits the new state', () => {
  const state = createChatState();
  const t = new PiToAgUiTranslator(state);
  const questions = [{ id: 'q1', text: 'Who is it for?', options: ['Me', 'Clients'] }];
  const ask = t.translate(toolStart('call-4', 'ask_user', { questions }));
  assert.deepEqual(ask.at(-1), {
    type: EventType.CUSTOM,
    name: CustomEventName.AskUser,
    value: { toolCallId: 'call-4', questions },
  });

  state.todo = [{ text: 'Create page', status: 'in_progress' }];
  const todo = t.translate(toolEnd('call-5', 'update_todo', 'ok'));
  assert.deepEqual(todo.at(-1), {
    type: EventType.STATE_SNAPSHOT,
    snapshot: { mode: 'plan', todo: [{ text: 'Create page', status: 'in_progress' }] },
  });
});

test('a finished compaction is reported, an aborted one is not', () => {
  const t = translator();
  const done = t.translate({
    type: 'compaction_end',
    reason: 'threshold',
    result: { summary: '...' },
    aborted: false,
    willRetry: false,
  } as unknown as AgentSessionEvent);
  assert.deepEqual(done, [
    { type: EventType.CUSTOM, name: CustomEventName.Compaction, value: { reason: 'threshold' } },
  ]);
  const aborted = t.translate({
    type: 'compaction_end',
    reason: 'threshold',
    result: undefined,
    aborted: true,
    willRetry: false,
  } as unknown as AgentSessionEvent);
  assert.deepEqual(aborted, []);
});

test('successful write/edit calls are recorded as written files', () => {
  const t = translator();
  t.translate(toolStart('w1', 'write', { path: 'docs/PLAN.md', content: '# Plan' }));
  t.translate(toolEnd('w1', 'write', 'ok'));
  t.translate(toolStart('w2', 'edit', { path: 'src/a.ts', edits: [] }));
  t.translate(toolEnd('w2', 'edit', 'blocked', true));
  assert.deepEqual([...t.writtenFiles], ['docs/PLAN.md']);
});

test('model errors are recorded from message_update and message_end', () => {
  const t = translator();
  t.translate({
    type: 'message_update',
    assistantMessageEvent: { type: 'error', reason: 'error', error: { errorMessage: '401' } },
  } as unknown as AgentSessionEvent);
  assert.equal(t.error, '401');

  const t2 = translator();
  t2.translate({ type: 'message_end', message: { role: 'user', content: 'hi' } } as unknown as AgentSessionEvent);
  assert.equal(t2.error, undefined);
  t2.translate({
    type: 'message_end',
    message: { role: 'assistant', stopReason: 'error', errorMessage: '404 status code (no body)' },
  } as unknown as AgentSessionEvent);
  assert.equal(t2.error, '404 status code (no body)');
});
