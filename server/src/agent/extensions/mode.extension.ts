import path from 'node:path';
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { type ChatMode, type ChatState, PLAN_FILE } from '../../chats/chat-state.js';

const MODE_PROMPTS: Record<ChatMode, string> = {
  plan: [
    'You are in PLAN mode. Do not change project code and do not run commands.',
    'Explore the project with read/ls/grep/find, clarify requirements with ask_user instead of guessing,',
    `then write the implementation plan to ${PLAN_FILE} (the only file you may write in this mode).`,
    'After writing the plan, summarize it briefly and ask the user to approve it.',
  ].join(' '),
  agent: [
    `You are in AGENT mode. Implement the approved plan from ${PLAN_FILE} if it exists, otherwise the user's request.`,
    'Track progress with update_todo. After changing code, verify it builds (npm run build) and fix errors.',
    'Finish with a short summary of what changed.',
  ].join(' '),
};

/** Tools that change the workspace; in plan mode only writing the plan file is allowed. */
const WRITE_TOOLS = new Set(['write', 'edit']);

/**
 * Enforces the chat mode inside pi: adds the mode instructions to the system prompt and blocks
 * code changes and commands while planning. The prompt says what to do; this makes sure of it.
 */
export function modeExtension(state: ChatState, cwd: string): ExtensionFactory {
  const planFile = path.resolve(cwd, PLAN_FILE);

  return (pi) => {
    pi.on('before_agent_start', (event) => {
      event.systemPromptOptions.sections['mode'] = MODE_PROMPTS[state.mode];
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
        if (typeof target !== 'string' || path.resolve(cwd, target) !== planFile) {
          return {
            block: true,
            reason: `Plan mode: only ${PLAN_FILE} may be written. Ask the user to approve the plan first.`,
          };
        }
      }
      return undefined;
    });
  };
}
