import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { TodoItem } from './chat-items';

const STATUS_ICON: Record<TodoItem['status'], string> = {
  pending: '○',
  in_progress: '◐',
  done: '●',
};

const STATUS_LABEL: Record<TodoItem['status'], string> = {
  pending: 'ожидает',
  in_progress: 'в работе',
  done: 'готово',
};

/** The agent's progress list (update_todo). Collapsible so it does not hide the chat. */
@Component({
  selector: 'app-todo-panel',
  template: `
    <button
      type="button"
      class="header"
      [attr.aria-expanded]="expanded()"
      (click)="expanded.set(!expanded())"
    >
      Прогресс: {{ doneCount() }} / {{ items().length }}
      @if (current(); as task) {
        <span class="current">— {{ task.text }}</span>
      }
    </button>
    @if (expanded()) {
      <ol>
        @for (item of items(); track $index) {
          <li [class]="item.status">
            <span aria-hidden="true">{{ icon[item.status] }}</span>
            {{ item.text }}
            <span class="visually-hidden">({{ label[item.status] }})</span>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-muted);
      font-size: 0.875rem;
    }
    .header {
      display: flex;
      gap: 0.4rem;
      width: 100%;
      padding: 0.4rem 0.6rem;
      border: none;
      background: none;
      color: var(--text);
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }
    .header:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .current {
      overflow: hidden;
      font-weight: 400;
      color: var(--text-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ol {
      margin: 0;
      padding: 0 0.6rem 0.5rem 0.6rem;
      list-style: none;
    }
    li {
      display: flex;
      gap: 0.4rem;
      padding: 0.1rem 0;
    }
    li.done {
      color: var(--text-muted);
      text-decoration: line-through;
    }
    li.in_progress {
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoPanel {
  readonly items = input.required<readonly TodoItem[]>();
  protected readonly expanded = signal(true);
  protected readonly icon = STATUS_ICON;
  protected readonly label = STATUS_LABEL;

  protected readonly doneCount = computed(() => this.items().filter((i) => i.status === 'done').length);
  protected readonly current = computed(() => this.items().find((i) => i.status === 'in_progress'));
}
