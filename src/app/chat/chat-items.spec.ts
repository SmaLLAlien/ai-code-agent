import { type BaseEvent, EventType } from '@ag-ui/client';
import { applyAgUiEvent, type ChatItem, stopRunningTools } from './chat-items';

function reduce(events: object[], initial: readonly ChatItem[] = []): readonly ChatItem[] {
  return events.reduce<readonly ChatItem[]>(
    (items, event) => applyAgUiEvent(items, event as BaseEvent),
    initial,
  );
}

describe('applyAgUiEvent', () => {
  it('builds an assistant message from streamed text', () => {
    const items = reduce([
      { type: EventType.TEXT_MESSAGE_START, messageId: 'm1', role: 'assistant' },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'Hel' },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'lo' },
      { type: EventType.TEXT_MESSAGE_END, messageId: 'm1' },
    ]);
    expect(items).toEqual([{ kind: 'assistant', id: 'm1', text: 'Hello' }]);
  });

  it('tracks a tool call from start to result', () => {
    const running = reduce([
      { type: EventType.TOOL_CALL_START, toolCallId: 't1', toolCallName: 'read' },
      { type: EventType.TOOL_CALL_ARGS, toolCallId: 't1', delta: '{"path":' },
      { type: EventType.TOOL_CALL_ARGS, toolCallId: 't1', delta: '"a.ts"}' },
      { type: EventType.TOOL_CALL_END, toolCallId: 't1' },
    ]);
    expect(running).toEqual([
      { kind: 'tool', id: 't1', name: 'read', args: '{"path":"a.ts"}', status: 'running' },
    ]);

    const done = reduce(
      [{ type: EventType.TOOL_CALL_RESULT, messageId: 'r1', toolCallId: 't1', content: 'body' }],
      running,
    );
    expect(done[0]).toMatchObject({ status: 'done', result: 'body' });
  });

  it('marks unfinished tool calls as stopped and leaves finished ones alone', () => {
    const items: ChatItem[] = [
      { kind: 'tool', id: 't1', name: 'read', args: '{}', result: 'x', status: 'done' },
      { kind: 'tool', id: 't2', name: 'bash', args: '{}', status: 'running' },
    ];
    expect(stopRunningTools(items).map((i) => i.kind === 'tool' && i.status)).toEqual([
      'done',
      'stopped',
    ]);
    const finished = [items[0]!];
    expect(stopRunningTools(finished)).toBe(finished);
  });

  it('keeps the feed order and leaves unknown events untouched', () => {
    const initial: ChatItem[] = [{ kind: 'user', id: 'u1', text: 'hi' }];
    const same = applyAgUiEvent(initial, { type: EventType.RUN_STARTED } as BaseEvent);
    expect(same).toBe(initial);

    const items = reduce(
      [
        { type: EventType.TEXT_MESSAGE_START, messageId: 'm1', role: 'assistant' },
        { type: EventType.TOOL_CALL_START, toolCallId: 't1', toolCallName: 'ls' },
      ],
      initial,
    );
    expect(items.map((i) => i.kind)).toEqual(['user', 'assistant', 'tool']);
  });
});
