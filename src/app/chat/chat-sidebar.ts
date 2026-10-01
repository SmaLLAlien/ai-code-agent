import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { LayoutService } from '../layout.service';
import { ConfirmService } from '../shared/confirm-dialog';
import { type ChatSummary, ChatsService } from './chats.service';

/** Chat list: open, rename and delete chats, start a new one. */
@Component({
  selector: 'app-chat-sidebar',
  imports: [RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  template: `
    <nav aria-label="Чаты">
      <a class="new" routerLink="/" (click)="layout.closeSidebar()">+ Новый чат</a>
      <button mat-stroked-button class="memory" type="button" (click)="openMemory()">
        <mat-icon>psychology</mat-icon>
        Память команды
      </button>
      @if (chats.loadError()) {
        <p class="hint" role="alert">Не удалось загрузить список чатов.</p>
      }
      <ul>
        @for (chat of chats.chats(); track chat.id) {
          <li>
            @if (editingId() === chat.id) {
              <label class="visually-hidden" [for]="'rename-' + chat.id">Название чата</label>
              <input
                class="rename"
                [id]="'rename-' + chat.id"
                maxlength="120"
                [value]="chat.title"
                (keydown.enter)="saveTitle(chat, $any($event.target).value)"
                (keydown.escape)="editingId.set(null)"
                (blur)="saveTitle(chat, $any($event.target).value)"
              />
            } @else {
              <a
                [routerLink]="['/chat', chat.id]"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                (click)="layout.closeSidebar()"
                >{{ chat.title }}</a
              >
              <button type="button" [attr.aria-label]="'Переименовать: ' + chat.title" (click)="editingId.set(chat.id)">
                ✎
              </button>
              <button type="button" [attr.aria-label]="'Удалить: ' + chat.title" (click)="remove(chat)">
                🗑
              </button>
            }
          </li>
        } @empty {
          @if (!chats.loadError()) {
            <li class="hint">Чатов пока нет</li>
          }
        }
      </ul>
    </nav>
  `,
  styleUrl: './chat-sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSidebar implements OnInit {
  protected readonly chats = inject(ChatsService);
  protected readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);

  protected readonly editingId = signal<string | null>(null);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  private readonly openChatId = computed(() => /^\/chat\/([^/?#]+)/.exec(this.url())?.[1] ?? null);

  ngOnInit(): void {
    void this.chats.refresh();
  }

  protected async openMemory(): Promise<void> {
    this.layout.closeSidebar();
    // Loaded on demand: the editor (form field, input, progress bar) stays out of the initial bundle.
    const { MemoryDialog } = await import('../memory/memory-dialog');
    this.dialog.open(MemoryDialog, { width: '48rem', maxWidth: '96vw' });
  }

  protected async saveTitle(chat: ChatSummary, value: string): Promise<void> {
    if (this.editingId() !== chat.id) {
      return;
    }
    this.editingId.set(null);
    const title = value.trim();
    if (title && title !== chat.title) {
      await this.chats.rename(chat.id, title);
    }
  }

  protected async remove(chat: ChatSummary): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Удалить чат?',
      message: `Чат «${chat.title}» будет удалён вместе с проектом и историей. Это действие необратимо.`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    const wasOpen = this.openChatId() === chat.id;
    // Leave the chat first so its page does not keep working on a deleted chat.
    if (wasOpen && !(await this.router.navigate(['/']))) {
      return;
    }
    await this.chats.remove(chat.id);
  }
}
