import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { ChatItem, ToolStatus } from './chat-items';

type ToolItem = Extract<ChatItem, { kind: 'tool' }>;

const STATUS_VIEW: Record<ToolStatus, { icon: string; label: string }> = {
  running: { icon: '⏳', label: 'выполняется' },
  done: { icon: '✓', label: 'готово' },
  error: { icon: '✕', label: 'ошибка' },
  stopped: { icon: '⏹', label: 'остановлено' },
};

/** Human-readable verb per built-in pi tool; unknown tools show their name. */
const TOOL_VERBS: Record<string, string> = {
  read: 'Читает',
  write: 'Создаёт',
  edit: 'Правит',
  bash: '$',
  grep: 'Ищет',
  find: 'Ищет файлы',
  ls: 'Смотрит папку',
  remember: 'Запоминает',
};

/** One agent action. Collapsed to a single line; expands to args, live output and result. */
@Component({
  selector: 'app-tool-call-item',
  template: `
    <button
      type="button"
      class="summary"
      [class.error]="item().status === 'error'"
      [attr.aria-expanded]="expanded()"
      (click)="expanded.set(!expanded())"
    >
      <span class="status" aria-hidden="true">{{ statusView().icon }}</span>
      <span class="verb">{{ verb() }}</span>
      <span class="target">{{ target() }}</span>
      <span class="visually-hidden">{{ statusView().label }}</span>
    </button>
    @if (expanded() || (item().status === 'running' && item().output)) {
      <div class="details">
        @if (expanded()) {
          <pre>{{ item().args }}</pre>
        }
        @if (item().result ?? item().output; as text) {
          <pre class="output">{{ text }}</pre>
        }
      </div>
    }
  `,
  styleUrl: './tool-call-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolCallItem {
  readonly item = input.required<ToolItem>();
  protected readonly expanded = signal(false);

  protected readonly statusView = computed(() => STATUS_VIEW[this.item().status]);
  protected readonly verb = computed(() => TOOL_VERBS[this.item().name] ?? this.item().name);

  /** Short hint of what the tool works on: a path, a command or a pattern. */
  protected readonly target = computed(() => {
    try {
      const args = JSON.parse(this.item().args) as Record<string, unknown>;
      return String(args['path'] ?? args['command'] ?? args['pattern'] ?? args['fact'] ?? '');
    } catch {
      return '';
    }
  });
}
