import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import type { TeamMemory } from '../../memory/team-memory.js';

/**
 * Adds the team memory to the system prompt of every run. It is read fresh each time, so edits made
 * in the UI or by the `remember` tool in another chat apply to the next message.
 */
export function memoryExtension(memory: TeamMemory): ExtensionFactory {
  return (pi) => {
    pi.on('before_agent_start', async (event) => {
      event.systemPromptOptions.sections['team_memory'] = [
        'Team agreements that apply to every project. Follow them unless the user says otherwise.',
        '',
        await memory.read(),
      ].join('\n');
    });
  };
}
