import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ChatItem } from './chat-items';
import { MarkdownView } from './markdown-view';
import { PlanCard } from './plan-card';
import { QuestionCard } from './question-card';
import { ToolCallItem } from './tool-call-item';

@Component({
  selector: 'app-message-list',
  imports: [MarkdownView, PlanCard, QuestionCard, ToolCallItem],
  template: `
    @for (item of items(); track item.id) {
      @switch (item.kind) {
        @case ('user') {
          <p class="bubble user">{{ item.text }}</p>
        }
        @case ('assistant') {
          <app-markdown-view class="bubble assistant" [text]="item.text" />
        }
        @case ('reasoning') {
          <details class="reasoning">
            <summary>Размышления</summary>
            <p>{{ item.text }}</p>
          </details>
        }
        @case ('tool') {
          <app-tool-call-item [item]="item" />
        }
        @case ('question') {
          <app-question-card
            [questions]="item.questions"
            [disabled]="item.answered || busy()"
            (answer)="answer.emit({ id: item.id, text: $event })"
          />
        }
        @case ('plan') {
          <app-plan-card
            [content]="item.content"
            [decided]="item.decided"
            [disabled]="busy()"
            (approve)="approvePlan.emit(item.id)"
            (revise)="revisePlan.emit()"
          />
        }
        @case ('files') {
          <details class="files">
            <summary>Изменено файлов: {{ item.files.length }}</summary>
            <ul>
              @for (file of item.files; track file) {
                <li>{{ file }}</li>
              }
            </ul>
          </details>
        }
      }
    } @empty {
      <p class="empty">Опишите идею или задачу — агент уточнит детали и предложит план.</p>
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
      word-break: break-word;
    }
    .user {
      align-self: flex-end;
      background: var(--accent);
      color: var(--on-accent);
      white-space: pre-wrap;
    }
    .assistant {
      display: block;
      align-self: flex-start;
      background: var(--surface-muted);
    }
    .reasoning,
    .files {
      align-self: flex-start;
      max-width: min(42rem, 90%);
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .reasoning p {
      margin: 0.25rem 0 0;
      white-space: pre-wrap;
    }
    .files ul {
      margin: 0.25rem 0 0;
      padding-left: 1.2rem;
      font-family: var(--mono);
    }
    summary {
      cursor: pointer;
    }
    .empty {
      margin: auto;
      color: var(--text-muted);
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageList {
  readonly items = input.required<readonly ChatItem[]>();
  /** A run is in progress: cards cannot be acted on. */
  readonly busy = input(false);
  readonly answer = output<{ id: string; text: string }>();
  readonly approvePlan = output<string>();
  readonly revisePlan = output<void>();
}
