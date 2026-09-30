import type { ChatMode } from './chat-items';

export interface ChatCommand {
  name: string;
  mode: ChatMode;
  description: string;
}

export const CHAT_COMMANDS: readonly ChatCommand[] = [
  { name: '/plan', mode: 'plan', description: 'Режим плана: агент уточняет и пишет план, код не трогает' },
  { name: '/agent', mode: 'agent', description: 'Режим агента: агент пишет код' },
];

/**
 * Parses a composer input. `/plan fix the header` switches the mode and sends "fix the header";
 * a bare `/agent` only switches the mode. Unknown commands are sent as plain text.
 */
export function parseCommand(input: string): { mode?: ChatMode; message: string } {
  const text = input.trim();
  const match = /^(\/\w+)(?:\s+([\s\S]*))?$/.exec(text);
  const command = match && CHAT_COMMANDS.find((c) => c.name === match[1]!.toLowerCase());
  if (!command) {
    return { message: text };
  }
  return { mode: command.mode, message: (match[2] ?? '').trim() };
}
