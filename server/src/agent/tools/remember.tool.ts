import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { TeamMemory } from '../../memory/team-memory.js';

export const REMEMBER = 'remember';

const RememberParams = Type.Object({
  fact: Type.String({
    description: 'One short, self-contained statement, e.g. "Forms use Reactive Forms with mat-form-field"',
    minLength: 3,
    maxLength: 300,
  }),
});

/** Saves a team-wide agreement to the team memory, which every chat sees. */
export function createRememberTool(memory: TeamMemory): ToolDefinition<typeof RememberParams> {
  return {
    name: REMEMBER,
    label: 'Remember',
    description:
      'Save a lasting team-wide agreement or preference to the team memory shared by all chats.',
    promptSnippet: 'remember: save a lasting team-wide agreement to the shared team memory',
    promptGuidelines: [
      'Call remember when the user explicitly asks to remember something or states a lasting team preference.',
      'Do not use remember for decisions about the current project only: write those to docs/DECISIONS.md.',
    ],
    parameters: RememberParams,
    execute: async (_toolCallId, params) => {
      const added = await memory.remember(params.fact);
      const text = added ? `Remembered: ${params.fact}` : 'Already in the team memory.';
      return { content: [{ type: 'text', text }], details: {} };
    },
  };
}
