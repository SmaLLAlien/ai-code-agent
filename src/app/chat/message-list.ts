import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ChatItem } from './chat-items';
import { ToolCallItem } from './tool-call-item';

@Component({
  selector: 'app-message-list',
  imports: [ToolCallItem],
  template: `
    @for (item of items(); track item.id) {
      @switch (item.kind) {
        @case ('user') {
          <p class="bubble user">{{ item.text }}</p>
        }
        @case ('assistant') {
          <p class="bubble assistant">{{ item.text }}</p>
        }
        @case ('tool') {
          <app-tool-call-item [item]="item" />
        }
      }
    } @empty {
      <p class="empty">Опишите, что нужно сделать в проекте.</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.5rem;
    }
    .bubble {
      max-width: min(42rem, 90%);
      margin: 0;
      padding: 0.5rem 0.75rem;
      border-radius: 10px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .user {
      align-self: flex-end;
      background: var(--accent);
      color: var(--on-accent);
    }
    .assistant {
      align-self: flex-start;
      background: var(--surface-muted);
    }
    .empty {
      margin: auto;
      color: var(--text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageList {
  readonly items = input.required<readonly ChatItem[]>();
}
