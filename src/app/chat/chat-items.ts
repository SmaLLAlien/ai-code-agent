import { type AGUIEvent, type BaseEvent, EventType } from '@ag-ui/client';

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string }
  | {
      kind: 'tool';
      id: string;
      name: string;
      args: string;
      result?: string;
      status: 'running' | 'done' | 'stopped';
    };

/** Marks tool calls that never got a result (run stopped or failed) as stopped. */
export function stopRunningTools(items: readonly ChatItem[]): readonly ChatItem[] {
  return items.some((item) => item.kind === 'tool' && item.status === 'running')
    ? items.map((item) =>
        item.kind === 'tool' && item.status === 'running' ? { ...item, status: 'stopped' } : item,
      )
    : items;
}

/** Pure reducer: applies one AG-UI event to the chat feed. Unknown events leave it unchanged. */
export function applyAgUiEvent(
  items: readonly ChatItem[],
  baseEvent: BaseEvent,
): readonly ChatItem[] {
  const event = baseEvent as AGUIEvent;
  switch (event.type) {
    case EventType.TEXT_MESSAGE_START:
      return [...items, { kind: 'assistant', id: event.messageId, text: '' }];
    case EventType.TEXT_MESSAGE_CONTENT:
      return items.map((item) =>
        item.kind === 'assistant' && item.id === event.messageId
          ? { ...item, text: item.text + event.delta }
          : item,
      );
    case EventType.TOOL_CALL_START:
      return [
        ...items,
        { kind: 'tool', id: event.toolCallId, name: event.toolCallName, args: '', status: 'running' },
      ];
    case EventType.TOOL_CALL_ARGS:
      return items.map((item) =>
        item.kind === 'tool' && item.id === event.toolCallId
          ? { ...item, args: item.args + event.delta }
          : item,
      );
    case EventType.TOOL_CALL_RESULT:
      return items.map((item) =>
        item.kind === 'tool' && item.id === event.toolCallId
          ? { ...item, result: contentText(event.content), status: 'done' }
          : item,
      );
    default:
      return items;
  }
}

function contentText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'object' && part && 'text' in part ? String(part.text) : ''))
      .join('');
  }
  return '';
}
