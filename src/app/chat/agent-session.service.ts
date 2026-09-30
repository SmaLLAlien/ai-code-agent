import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { type AGUIEvent, EventType, HttpAgent } from '@ag-ui/client';
import { firstValueFrom } from 'rxjs';
import {
  applyAgUiEvent,
  type ChatItem,
  type ChatMode,
  markHandled,
  stopRunningTools,
  type TodoItem,
} from './chat-items';

const PLAN_APPROVED_MESSAGE = 'План утверждён, приступай к реализации.';

/**
 * State of one chat with the agent. Provided per chat page, not in root.
 * The server keeps the conversation history in the pi session; the client only renders events.
 */
@Injectable()
export class AgentSessionService {
  private readonly http = inject(HttpClient);
  private agent: HttpAgent | undefined;
  private stopped = false;

  readonly chatId = signal<string | null>(null);
  readonly items = signal<readonly ChatItem[]>([]);
  readonly isRunning = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<ChatMode>('plan');
  readonly todo = signal<readonly TodoItem[]>([]);

  async init(): Promise<void> {
    try {
      const { id } = await firstValueFrom(this.http.post<{ id: string }>('/api/chats', {}));
      this.agent = new HttpAgent({ url: `/api/chats/${id}/run`, threadId: id });
      this.chatId.set(id);
    } catch {
      this.error.set('Не удалось создать чат. Проверьте, что сервер запущен.');
    }
  }

  /** The mode applies to the next run; the server enforces it inside the agent. */
  setMode(mode: ChatMode): void {
    this.mode.set(mode);
  }

  answerQuestion(questionId: string, answer: string): void {
    this.items.update((items) => markHandled(items, questionId));
    void this.send(answer);
  }

  approvePlan(planId: string): void {
    this.items.update((items) => markHandled(items, planId));
    this.mode.set('agent');
    void this.send(PLAN_APPROVED_MESSAGE);
  }

  async send(text: string): Promise<void> {
    const agent = this.agent;
    const message = text.trim();
    if (!agent || !message || this.isRunning()) {
      return;
    }

    const id = crypto.randomUUID();
    this.items.update((items) => [...items, { kind: 'user', id, text: message }]);
    agent.addMessage({ id, role: 'user', content: message });
    this.error.set(null);
    this.stopped = false;
    this.isRunning.set(true);

    try {
      await agent.runAgent(
        { forwardedProps: { mode: this.mode() } },
        {
          onEvent: ({ event }) => {
            this.applyState(event as AGUIEvent);
            this.items.update((items) => applyAgUiEvent(items, event));
          },
          onRunErrorEvent: ({ event }) => {
            // Aborting the fetch makes the client report a RUN_ERROR too; a user stop is not an error.
            if (!this.stopped) {
              this.error.set(event.message);
            }
          },
        },
      );
    } catch (err) {
      // RUN_ERROR from the server already set a precise message; keep it.
      if (!this.stopped && !this.error()) {
        this.error.set(err instanceof Error ? err.message : 'Ошибка при выполнении запроса');
      }
    } finally {
      this.items.update(stopRunningTools);
      this.isRunning.set(false);
    }
  }

  stop(): void {
    const id = this.chatId();
    if (!this.agent || !id || !this.isRunning()) {
      return;
    }
    this.stopped = true;
    this.agent.abortRun();
    // Closing the stream already aborts the run on the server; this is a safety net.
    this.http.post(`/api/chats/${id}/abort`, {}).subscribe({ error: () => undefined });
  }

  private applyState(event: AGUIEvent): void {
    if (event.type !== EventType.STATE_SNAPSHOT) {
      return;
    }
    const snapshot = (event.snapshot ?? {}) as { mode?: ChatMode; todo?: TodoItem[] };
    if (snapshot.mode) {
      this.mode.set(snapshot.mode);
    }
    this.todo.set(snapshot.todo ?? []);
  }
}
