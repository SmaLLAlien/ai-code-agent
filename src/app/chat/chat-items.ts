import { type AGUIEvent, type BaseEvent, EventType } from '@ag-ui/client';

export type ChatMode = 'plan' | 'agent';

export interface TodoItem {
  text: string;
  status: 'pending' | 'in_progress' | 'done';
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  multiSelect?: boolean;
}

export type ToolStatus = 'running' | 'done' | 'error' | 'stopped';

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'reasoning'; id: string; text: string }
  | { kind: 'tool'; id: string; name: string; args: string; output?: string; result?: string; status: ToolStatus }
  | { kind: 'question'; id: string; questions: Question[]; answered: boolean }
  | { kind: 'plan'; id: string; content: string; decided: boolean }
  | { kind: 'files'; id: string; files: string[] };

/** CUSTOM event names sent by the server (see server/src/agui/pi-to-agui.ts). */
const Custom = {
  ToolOutput: 'tool_output',
  ToolStatus: 'tool_status',
  AskUser: 'ask_user',
  PlanReady: 'plan_ready',
  FilesChanged: 'files_changed',
} as const;

/** Tools whose calls are shown by dedicated UI (question card, progress list), not as tool rows. */
const HIDDEN_TOOLS = new Set(['ask_user', 'update_todo']);

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
      return appendText(items, 'assistant', event.messageId, event.delta);
    case EventType.REASONING_MESSAGE_START:
      return [...items, { kind: 'reasoning', id: event.messageId, text: '' }];
    case EventType.REASONING_MESSAGE_CONTENT:
      return appendText(items, 'reasoning', event.messageId, event.delta);
    case EventType.TOOL_CALL_START:
      return HIDDEN_TOOLS.has(event.toolCallName)
        ? items
        : [
            ...items,
            { kind: 'tool', id: event.toolCallId, name: event.toolCallName, args: '', status: 'running' },
          ];
    case EventType.TOOL_CALL_ARGS:
      return updateTool(items, event.toolCallId, (tool) => ({ ...tool, args: tool.args + event.delta }));
    case EventType.TOOL_CALL_RESULT:
      return updateTool(items, event.toolCallId, (tool) => ({
        ...tool,
        result: contentText(event.content),
        status: tool.status === 'error' ? 'error' : 'done',
      }));
    case EventType.CUSTOM:
      return applyCustom(items, event.name, event.value);
    default:
      return items;
  }
}

function applyCustom(items: readonly ChatItem[], name: string, value: unknown): readonly ChatItem[] {
  const data = (value ?? {}) as Record<string, unknown>;
  switch (name) {
    case Custom.ToolOutput:
      return updateTool(items, String(data['toolCallId']), (tool) => ({
        ...tool,
        output: String(data['text'] ?? ''),
      }));
    case Custom.ToolStatus:
      return data['isError']
        ? updateTool(items, String(data['toolCallId']), (tool) => ({ ...tool, status: 'error' }))
        : items;
    case Custom.AskUser:
      return [
        ...items,
        {
          kind: 'question',
          id: String(data['toolCallId']),
          questions: (data['questions'] as Question[] | undefined) ?? [],
          answered: false,
        },
      ];
    case Custom.PlanReady:
      return [
        // Only the newest plan can be approved.
        ...items.map((item) => (item.kind === 'plan' ? { ...item, decided: true } : item)),
        { kind: 'plan', id: crypto.randomUUID(), content: String(data['content'] ?? ''), decided: false },
      ];
    case Custom.FilesChanged:
      return [
        ...items,
        {
          kind: 'files',
          id: String(data['commit'] ?? crypto.randomUUID()),
          files: (data['files'] as string[] | undefined) ?? [],
        },
      ];
    default:
      return items;
  }
}

/** Marks tool calls that never got a result (run stopped or failed) as stopped. */
export function stopRunningTools(items: readonly ChatItem[]): readonly ChatItem[] {
  return items.some((item) => item.kind === 'tool' && item.status === 'running')
    ? items.map((item) =>
        item.kind === 'tool' && item.status === 'running' ? { ...item, status: 'stopped' } : item,
      )
    : items;
}

/** Marks a question or plan card as handled so its buttons are disabled. */
export function markHandled(items: readonly ChatItem[], id: string): readonly ChatItem[] {
  return items.map((item) => {
    if (item.id !== id) {
      return item;
    }
    if (item.kind === 'question') {
      return { ...item, answered: true };
    }
    if (item.kind === 'plan') {
      return { ...item, decided: true };
    }
    return item;
  });
}

function appendText(
  items: readonly ChatItem[],
  kind: 'assistant' | 'reasoning',
  id: string,
  delta: string,
): readonly ChatItem[] {
  return items.map((item) =>
    item.kind === kind && item.id === id ? { ...item, text: item.text + delta } : item,
  );
}

type ToolItem = Extract<ChatItem, { kind: 'tool' }>;

function updateTool(
  items: readonly ChatItem[],
  id: string,
  change: (tool: ToolItem) => ToolItem,
): readonly ChatItem[] {
  return items.map((item) => (item.kind === 'tool' && item.id === id ? change(item) : item));
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
