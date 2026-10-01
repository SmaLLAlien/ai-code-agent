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
  template: `
    <header>
      <button
        type="button"
        class="menu"
        aria-label="Список чатов"
        [attr.aria-expanded]="layout.sidebarOpen()"
        (click)="layout.toggleSidebar()"
      >
        ☰
      </button>
      <h1>{{ title() }}</h1>
      <span class="mode">{{ session.mode() === 'plan' ? 'Режим плана' : 'Режим агента' }}</span>
      @if (session.isRunning()) {
        <span class="status" role="status">Агент работает…</span>
      }
      @if (session.chatId(); as chatId) {
        <span class="spacer"></span>
        @if (session.isRunning()) {
          <button
            mat-icon-button
            disabled
            aria-label="Скачать проект — доступно, когда агент закончит"
          >
            <mat-icon>download</mat-icon>
          </button>
        } @else {
          <a
            mat-icon-button
            [href]="'/api/chats/' + chatId + '/export.zip'"
            download
            aria-label="Скачать проект (zip с историей изменений)"
            matTooltip="Скачать проект (zip с историей изменений)"
          >
            <mat-icon>download</mat-icon>
          </a>
        }
      }
    </header>
    <main #feed class="feed" role="log" aria-live="polite" aria-label="Диалог с агентом">
      @if (session.notFound()) {
        <p class="empty">Чат не найден. <a routerLink="/">Начать новый</a></p>
      } @else if (session.loading()) {
        <p class="empty">Загрузка…</p>
      } @else {
        <app-message-list
          [items]="session.items()"
          [busy]="session.isRunning()"
          (answer)="session.answerQuestion($event.id, $event.text)"
          (approvePlan)="session.approvePlan($event)"
          (revisePlan)="composer().focus()"
        />
      }
    </main>
    <footer>
      @if (session.todo().length) {
        <app-todo-panel [items]="session.todo()" />
      }
      @if (session.error(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      <app-composer
        [running]="session.isRunning()"
        [disabled]="!ready()"
        [mode]="session.mode()"
        (send)="onSend($event)"
        (stop)="session.stop()"
        (modeChange)="session.setMode($event)"
      />
    </footer>
  `,
  styleUrl: './chat-page.css',
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
