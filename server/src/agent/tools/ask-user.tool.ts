import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { type Static, Type } from 'typebox';

export const ASK_USER = 'ask_user';

export const AskUserParams = Type.Object({
  questions: Type.Array(
    Type.Object({
      id: Type.String({ description: 'Short stable id, e.g. "audience"' }),
      text: Type.String({ description: 'The question, in the language of the user' }),
      options: Type.Array(Type.String(), {
        description: '2-5 suggested answers; the user can also type their own',
      }),
      multiSelect: Type.Optional(Type.Boolean()),
    }),
    { minItems: 1, maxItems: 5 },
  ),
});

export type AskUserInput = Static<typeof AskUserParams>;

/**
 * Shows questions to the user as a card with answer buttons and ends the turn. The answers arrive
 * as the next user message, so nothing waits in memory for them.
 */
export const askUserTool: ToolDefinition<typeof AskUserParams> = {
  name: ASK_USER,
  label: 'Ask user',
  description:
    'Ask the user clarifying questions instead of guessing. Each question gets suggested answer ' +
    'options. The turn ends after this call; the answers come in the next user message.',
  promptSnippet: 'ask_user: ask the user clarifying questions with suggested answers',
  promptGuidelines: [
    'When requirements are ambiguous, call ask_user instead of assuming. Ask at most 5 questions at once.',
    'Do not call other tools in the same turn as ask_user.',
  ],
  parameters: AskUserParams,
  execute: async () => ({
    content: [{ type: 'text', text: 'Questions are shown to the user. Stop and wait for the answers.' }],
    details: {},
    terminate: true,
  }),
};
