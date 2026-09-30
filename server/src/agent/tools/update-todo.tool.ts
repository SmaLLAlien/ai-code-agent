import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { ChatState } from '../../chats/chat-state.js';

export const UPDATE_TODO = 'update_todo';

const UpdateTodoParams = Type.Object({
  items: Type.Array(
    Type.Object({
      text: Type.String(),
      status: Type.Union([
        Type.Literal('pending'),
        Type.Literal('in_progress'),
        Type.Literal('done'),
      ]),
    }),
  ),
});

/** Replaces the chat's progress list. The UI shows it as a checklist. */
export function createUpdateTodoTool(state: ChatState): ToolDefinition<typeof UpdateTodoParams> {
  return {
    name: UPDATE_TODO,
    label: 'Update todo',
    description:
      'Replace the whole progress list shown to the user. Send every item each time, with its status.',
    promptSnippet: 'update_todo: keep the user-visible progress list up to date',
    promptGuidelines: [
      'While implementing, keep exactly one todo item in_progress and mark items done as you finish them.',
    ],
    parameters: UpdateTodoParams,
    execute: async (_toolCallId, params) => {
      state.todo = params.items.map(({ text, status }) => ({ text, status }));
      return { content: [{ type: 'text', text: 'Progress list updated.' }], details: {} };
    },
  };
}
