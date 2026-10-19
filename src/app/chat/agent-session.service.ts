import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  type AGUIEvent,
  type BaseEvent,
  type ContentPart,
  EventType,
  HttpAgent,
} from '@ag-ui/client';
import { firstValueFrom } from 'rxjs';
import { type Attachment, toContentParts } from './attachments';
import {
  applyAgUiEvent,
  type ChatItem,
  type ChatMode,
  markHandled,
  replayHistory,
  stopRunningTools,
  type TodoItem,
} from './chat-items';
import { ChatsService } from './chats.service';

const PLAN_APPROVED_MESSAGE = 'План утверждён, приступай к реализации.';

interface StoredChat {
  id: string;
  title: string;
  mode: ChatMode;
  todo: TodoItem[];
  events: BaseEvent[];
}

/**
 * State of one chat with the agent. Provided per chat page, not in root.
 * The server keeps the conversation history in the pi session; the client only renders events.
 */
@Injectable()
export class AgentSessionService {
  private readonly http = inject(HttpClient);
  private readonly chats = inject(ChatsService);
  private agent: HttpAgent | undefined;
  private stopped = false;

  readonly chatId = signal<string | null>(null);
  readonly items = signal<readonly ChatItem[]>([]);
  readonly isRunning = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<ChatMode>('plan');
  readonly todo = signal<readonly TodoItem[]>([]);

  readonly loading = signal(false);
  readonly notFound = signal(false);

  /** Opens an existing chat: replays its stored feed and restores mode and progress. */
  async load(id: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set(null);
    try {
      const chat = await firstValueFrom(this.http.get<StoredChat>(`/api/chats/${id}`));
      revokePreviews(this.items());
      this.items.set(replayHistory(chat.events));
      this.mode.set(chat.mode);
      this.todo.set(chat.todo);
      this.agent = new HttpAgent({ url: `/api/chats/${id}/run`, threadId: id });
      this.chatId.set(id);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.notFound.set(true);
      } else {
        this.error.set('Не удалось загрузить чат. Проверьте, что сервер запущен.');
      }
    } finally {
      this.loading.set(false);
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

  async send(text: string, files: readonly File[] = []): Promise<void> {
    const agent = this.agent;
    const message = text.trim();
    if (!agent || (!message && !files.length) || this.isRunning()) {
      return;
    }

    let parts: ContentPart[];
    try {
      parts = await toContentParts(files);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Не удалось прочитать файл');
      return;
    }
    const attachments = files.map((file): Attachment => {
      const kind = file.type.startsWith('image/') ? 'image' : 'document';
      return { name: file.name, kind, ...(kind === 'image' && { url: URL.createObjectURL(file) }) };
    });

    const id = crypto.randomUUID();
    this.items.update((items) => [
      ...items,
      { kind: 'user', id, text: message, ...(attachments.length && { attachments }) },
    ]);
    // The server reads only the last user message (pi keeps the history), so earlier messages are
    // dropped: otherwise every run would upload all previously attached files again.
    agent.setMessages([
      {
        id,
        role: 'user',
        content: parts.length
          ? [...(message ? [{ type: 'text' as const, text: message }] : []), ...parts]
          : message,
      },
    ]);
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
      // The server sets the title after the first run and bumps the chat to the top of the list.
      void this.chats.refresh();
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

/** Frees the object URLs of images previewed before they were stored on the server. */
function revokePreviews(items: readonly ChatItem[]): void {
  for (const item of items) {
    if (item.kind === 'user') {
      item.attachments?.forEach((a) => a.url?.startsWith('blob:') && URL.revokeObjectURL(a.url));
    }
  }
}
