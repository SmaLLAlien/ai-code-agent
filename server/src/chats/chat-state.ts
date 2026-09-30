/** `plan`: clarify and write the plan, no code changes. `agent`: implement the approved plan. */
export type ChatMode = 'plan' | 'agent';

export const CHAT_MODES: readonly ChatMode[] = ['plan', 'agent'];

export interface TodoItem {
  text: string;
  status: 'pending' | 'in_progress' | 'done';
}

/** Mutable per-chat state shared by the chat route, the agent's tools and the mode extension. */
export interface ChatState {
  mode: ChatMode;
  todo: TodoItem[];
}

/** The plan the agent writes in plan mode, relative to the workspace root. */
export const PLAN_FILE = 'docs/PLAN.md';

export function createChatState(): ChatState {
  return { mode: 'plan', todo: [] };
}
