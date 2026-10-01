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

/** Key decisions of the project (style, structure, data), kept in the project for the team. */
export const DECISIONS_FILE = 'docs/DECISIONS.md';

export function createChatState(): ChatState {
  return { mode: 'plan', todo: [] };
}
