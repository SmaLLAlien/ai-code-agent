import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { LayoutService } from '../layout.service';
import { ConfirmService } from '../shared/confirm-dialog';
import { AgentSessionService } from './agent-session.service';
import type { ChatMode } from './chat-items';
import { ChatsService } from './chats.service';
import { Composer } from './composer';
import { MessageList } from './message-list';
import { TodoPanel } from './todo-panel';

/** What the "new chat" page hands over to the created chat through the navigation state. */
interface PendingStart {
  pendingMessage?: string;
  pendingMode?: ChatMode;
}

/**
 * One chat. Without an `id` it is the "new chat" page: the chat (and its workspace) is created
 * only when the first message is sent, then the page navigates to `/chat/:id`.
 */
@Component({
  selector: 'app-chat-page',
  imports: [
    MessageList,
    Composer,
    TodoPanel,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  providers: [AgentSessionService],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  host: { class: 'chat-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  /** Route param `/chat/:id` (component input binding). */
  readonly id = input<string>();

  protected readonly session = inject(AgentSessionService);
  protected readonly layout = inject(LayoutService);
  private readonly chats = inject(ChatsService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly creating = signal(false);

  protected readonly composer = viewChild.required(Composer);
  private readonly feed = viewChild.required<ElementRef<HTMLElement>>('feed');

  protected readonly ready = computed(
    () => !this.session.loading() && !this.session.notFound() && !this.creating(),
  );
  protected readonly title = computed(() => {
    const id = this.session.chatId();
    return (id && this.chats.chats().find((c) => c.id === id)?.title) || 'Новый чат';
  });

  constructor() {
    // The same component instance is reused when switching between chats.
    effect(() => {
      const id = this.id();
      if (id) {
        untracked(() => void this.open(id));
      }
    });
    // Keep the newest message in view while the agent streams.
    afterRenderEffect(() => {
      this.session.items();
      const el = this.feed().nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }

  /** Used by the route guard: leaving a running chat stops the agent, so ask first. */
  async confirmLeave(): Promise<boolean> {
    if (!this.session.isRunning()) {
      return true;
    }
    const leave = await this.confirm.confirm({
      title: 'Агент ещё работает',
      message: 'Если уйти из чата, агент остановится. Остановить его и перейти?',
      confirmText: 'Остановить и перейти',
    });
    if (leave) {
      this.session.stop();
    }
    return leave;
  }

  protected async onSend(text: string): Promise<void> {
    if (this.session.chatId()) {
      await this.session.send(text);
      return;
    }
    this.creating.set(true);
    try {
      const id = await this.chats.create();
      const state: PendingStart = { pendingMessage: text, pendingMode: this.session.mode() };
      await this.router.navigate(['/chat', id], { state });
    } catch {
      this.session.error.set('Не удалось создать чат. Проверьте, что сервер запущен.');
    } finally {
      this.creating.set(false);
    }
  }

  private async open(id: string): Promise<void> {
    await this.session.load(id);
    // The first message typed on the "new chat" page is sent once the chat is open.
    const { pendingMessage, pendingMode } = (history.state ?? {}) as PendingStart;
    if (pendingMessage && this.session.chatId() === id) {
      history.replaceState({ ...history.state, pendingMessage: undefined }, '');
      if (pendingMode) {
        this.session.setMode(pendingMode);
      }
      void this.session.send(pendingMessage);
    }
  }
}
