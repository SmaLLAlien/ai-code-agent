import path from 'node:path';
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import {
  type ChatMode,
  type ChatState,
  DECISIONS_FILE,
  PLAN_FILE,
} from '../../chats/chat-state.js';

const MODE_PROMPTS: Record<ChatMode, string> = {
  plan: [
    'You are in PLAN mode. Do not change project code and do not run commands.',
    'Explore the project with read/ls/grep/find, clarify requirements with ask_user instead of guessing,',
    `then write the implementation plan to ${PLAN_FILE} and the key decisions to ${DECISIONS_FILE}`,
    '(the only files you may write in this mode).',
    'After writing the plan, summarize it briefly and ask the user to approve it.',
  ].join(' '),
  agent: [
    `You are in AGENT mode. Implement the approved plan from ${PLAN_FILE} if it exists, otherwise the user's request.`,
    'Track progress with update_todo. After changing code, verify it builds (npm run build) and fix errors.',
    `Record new key decisions in ${DECISIONS_FILE}. Finish with a short summary of what changed.`,
  ].join(' '),
};

/** Tools that change the workspace; in plan mode only the planning documents may be written. */
const WRITE_TOOLS = new Set(['write', 'edit']);
const PLAN_MODE_FILES = [PLAN_FILE, DECISIONS_FILE];

/**
 * Enforces the chat mode inside pi: adds the mode instructions to the system prompt and blocks
 * code changes and commands while planning. The prompt says what to do; this makes sure of it.
 */
export function modeExtension(state: ChatState, cwd: string): ExtensionFactory {
  const allowedInPlan = new Set(PLAN_MODE_FILES.map((file) => path.resolve(cwd, file)));

  return (pi) => {
    pi.on('before_agent_start', (event) => {
      event.systemPromptOptions.sections['mode'] = MODE_PROMPTS[state.mode];
      // Models do not know the current date; DECISIONS.md entries and texts need it.
      event.systemPromptOptions.sections['today'] = `Today is ${new Date().toISOString().slice(0, 10)}.`;
    });

    pi.on('tool_call', (event) => {
      if (state.mode !== 'plan') {
        return undefined;
      }
      if (event.toolName === 'bash' || event.toolName === 'powershell') {
        return { block: true, reason: 'Plan mode: running commands is not allowed.' };
      }
      if (WRITE_TOOLS.has(event.toolName)) {
        const target = (event.input as { path?: unknown }).path;
        if (typeof target !== 'string' || !allowedInPlan.has(path.resolve(cwd, target))) {
          return {
            block: true,
            reason: `Plan mode: only ${PLAN_MODE_FILES.join(' and ')} may be written. Ask the user to approve the plan first.`,
          };
        }
      }
      return undefined;
    });
  };
}
