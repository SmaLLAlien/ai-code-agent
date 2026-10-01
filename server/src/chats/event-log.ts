import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { type AGUIEvent, EventType } from '@ag-ui/core';
import { CustomEventName } from '../agui/pi-to-agui.js';

/**
 * The chat feed as it was shown, stored as AG-UI events (one JSON per line). Replaying them through
 * the client's reducer restores the feed exactly: messages, tool cards, questions, plans, files.
 * The model's own history is kept separately by pi in its session files.
 */
export class ChatEventLog {
  constructor(private readonly chatsDir: string) {}

  async append(chatId: string, events: readonly AGUIEvent[]): Promise<void> {
    const kept = compactEvents(events);
    if (!kept.length) {
      return;
    }
    const file = this.file(chatId);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, kept.map((e) => JSON.stringify(e)).join('\n') + '\n');
  }

  async read(chatId: string): Promise<AGUIEvent[]> {
    try {
      const text = await fs.readFile(this.file(chatId), 'utf8');
      return text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AGUIEvent);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  private file(chatId: string): string {
    return path.join(this.chatsDir, chatId, 'events.jsonl');
  }
}

/** The user's message in the same AG-UI shape as assistant messages, so the log replays it too. */
export function userMessageEvents(text: string): AGUIEvent[] {
  const messageId = randomUUID();
  return [
    { type: EventType.TEXT_MESSAGE_START, messageId, role: 'user' },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: text },
    { type: EventType.TEXT_MESSAGE_END, messageId },
  ];
}

/** Events that matter only while the run is live. */
const TRANSIENT = new Set<string>([
  EventType.RUN_STARTED,
  EventType.RUN_FINISHED,
  EventType.RUN_ERROR,
  EventType.STATE_SNAPSHOT,
]);

/**
 * Shrinks a run's events for storage: drops live-only events and live tool output (the final
 * TOOL_CALL_RESULT has it all), and merges consecutive text deltas of the same message.
 */
export function compactEvents(events: readonly AGUIEvent[]): AGUIEvent[] {
  const result: AGUIEvent[] = [];
  for (const event of events) {
    if (TRANSIENT.has(event.type)) {
      continue;
    }
    if (event.type === EventType.CUSTOM && event.name === CustomEventName.ToolOutput) {
      continue;
    }
    const last = result.at(-1);
    if (
      last &&
      (event.type === EventType.TEXT_MESSAGE_CONTENT ||
        event.type === EventType.REASONING_MESSAGE_CONTENT) &&
      last.type === event.type &&
      last.messageId === event.messageId
    ) {
      result[result.length - 1] = { ...last, delta: last.delta + event.delta };
      continue;
    }
    result.push(event);
  }
  return result;
}
