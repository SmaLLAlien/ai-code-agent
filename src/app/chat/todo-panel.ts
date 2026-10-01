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
  templateUrl: './todo-panel.html',
  styleUrl: './todo-panel.scss',
  host: { class: 'todo-panel' },
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
