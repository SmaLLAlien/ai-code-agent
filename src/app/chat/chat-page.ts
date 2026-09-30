import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  type OnInit,
  viewChild,
} from '@angular/core';
import { AgentSessionService } from './agent-session.service';
import { Composer } from './composer';
import { MessageList } from './message-list';

@Component({
  selector: 'app-chat-page',
  imports: [MessageList, Composer],
  providers: [AgentSessionService],
  template: `
    <header>
      <h1>AI Code Agent</h1>
      @if (session.isRunning()) {
        <span class="status" role="status">Агент работает…</span>
      }
    </header>
    <main #feed class="feed" role="log" aria-live="polite" aria-label="Диалог с агентом">
      <app-message-list [items]="session.items()" />
    </main>
    <footer>
      @if (session.error(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      <app-composer
        [running]="session.isRunning()"
        [disabled]="!ready()"
        (send)="session.send($event)"
        (stop)="session.stop()"
      />
    </footer>
  `,
  styleUrl: './chat-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage implements OnInit {
  protected readonly session = inject(AgentSessionService);
  protected readonly ready = computed(() => this.session.chatId() !== null);
  private readonly feed = viewChild.required<ElementRef<HTMLElement>>('feed');

  constructor() {
    // Keep the newest message in view while the agent streams.
    afterRenderEffect(() => {
      this.session.items();
      const el = this.feed().nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }

  ngOnInit(): void {
    void this.session.init();
  }
}
