import { type BaseEvent, EventType } from '@ag-ui/client';
import { applyAgUiEvent, type ChatItem, markHandled, stopRunningTools } from './chat-items';

function reduce(events: object[], initial: readonly ChatItem[] = []): readonly ChatItem[] {
  return events.reduce<readonly ChatItem[]>(
    (items, event) => applyAgUiEvent(items, event as BaseEvent),
    initial,
  );
}

const custom = (name: string, value: unknown) => ({ type: EventType.CUSTOM, name, value });

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

  it('builds a reasoning block', () => {
    const items = reduce([
      { type: EventType.REASONING_START, messageId: 's1' },
      { type: EventType.REASONING_MESSAGE_START, messageId: 'r1', role: 'reasoning' },
      { type: EventType.REASONING_MESSAGE_CONTENT, messageId: 'r1', delta: 'thinking' },
    ]);
    expect(items).toEqual([{ kind: 'reasoning', id: 'r1', text: 'thinking' }]);
  });

  it('tracks a tool call with live output, error status and result', () => {
    const running = reduce([
      { type: EventType.TOOL_CALL_START, toolCallId: 't1', toolCallName: 'bash' },
      { type: EventType.TOOL_CALL_ARGS, toolCallId: 't1', delta: '{"command":"npm i"}' },
      custom('tool_output', { toolCallId: 't1', text: 'added 10 packages' }),
    ]);
    expect(running).toEqual([
      {
        kind: 'tool',
        id: 't1',
        name: 'bash',
        args: '{"command":"npm i"}',
        output: 'added 10 packages',
        status: 'running',
      },
    ]);

    const failed = reduce(
      [
        custom('tool_status', { toolCallId: 't1', isError: true }),
        { type: EventType.TOOL_CALL_RESULT, messageId: 'r1', toolCallId: 't1', content: 'boom' },
      ],
      running,
    );
    expect(failed[0]).toMatchObject({ status: 'error', result: 'boom' });
  });

  it('hides ask_user and update_todo tool rows and shows the question card instead', () => {
    const questions = [{ id: 'q1', text: 'Who?', options: ['A', 'B'] }];
    const items = reduce([
      { type: EventType.TOOL_CALL_START, toolCallId: 'a1', toolCallName: 'ask_user' },
      { type: EventType.TOOL_CALL_START, toolCallId: 'u1', toolCallName: 'update_todo' },
      custom('ask_user', { toolCallId: 'a1', questions }),
    ]);
    expect(items).toEqual([{ kind: 'question', id: 'a1', questions, answered: false }]);
    expect(markHandled(items, 'a1')[0]).toMatchObject({ answered: true });
  });

  it('keeps only the newest plan actionable', () => {
    const items = reduce([
      custom('plan_ready', { content: '# v1' }),
      custom('plan_ready', { content: '# v2' }),
    ]);
    expect(items.map((i) => i.kind === 'plan' && [i.content, i.decided])).toEqual([
      ['# v1', true],
      ['# v2', false],
    ]);
  });

  it('adds the list of changed files', () => {
    const items = reduce([custom('files_changed', { commit: 'abc123', files: ['src/a.ts'] })]);
    expect(items).toEqual([{ kind: 'files', id: 'abc123', files: ['src/a.ts'] }]);
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
