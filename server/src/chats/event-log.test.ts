import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { type AGUIEvent, EventType } from '@ag-ui/core';
import { ChatEventLog, compactEvents, userMessageEvents } from './event-log.js';

test('compactEvents drops live-only events and merges text deltas', () => {
  const events: AGUIEvent[] = [
    { type: EventType.RUN_STARTED, threadId: 't', runId: 'r' },
    { type: EventType.STATE_SNAPSHOT, snapshot: {} },
    { type: EventType.TEXT_MESSAGE_START, messageId: 'm1', role: 'assistant' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'Hel' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'lo' },
    { type: EventType.TEXT_MESSAGE_END, messageId: 'm1' },
    { type: EventType.CUSTOM, name: 'tool_output', value: { toolCallId: 'x', text: '...' } },
    { type: EventType.CUSTOM, name: 'plan_ready', value: { content: '# Plan' } },
    { type: EventType.RUN_FINISHED, threadId: 't', runId: 'r' },
  ];
  assert.deepEqual(compactEvents(events), [
    { type: EventType.TEXT_MESSAGE_START, messageId: 'm1', role: 'assistant' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'Hello' },
    { type: EventType.TEXT_MESSAGE_END, messageId: 'm1' },
    { type: EventType.CUSTOM, name: 'plan_ready', value: { content: '# Plan' } },
  ]);
});

test('userMessageEvents describes the user message as an AG-UI text message', () => {
  const [start, content, end] = userMessageEvents('Hi');
  assert.equal(start?.type, EventType.TEXT_MESSAGE_START);
  assert.equal(start && 'role' in start ? start.role : undefined, 'user');
  assert.equal(content && 'delta' in content ? content.delta : undefined, 'Hi');
  assert.equal(end?.type, EventType.TEXT_MESSAGE_END);
});

test('appends runs and reads them back in order', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-log-'));
  try {
    const log = new ChatEventLog(dir);
    assert.deepEqual(await log.read('chat'), []);
    await log.append('chat', userMessageEvents('first'));
    await log.append('chat', userMessageEvents('second'));
    const deltas = (await log.read('chat')).flatMap((e) => ('delta' in e ? [e.delta] : []));
    assert.deepEqual(deltas, ['first', 'second']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
