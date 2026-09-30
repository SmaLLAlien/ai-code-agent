import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { ChatItem } from './chat-items';

type ToolItem = Extract<ChatItem, { kind: 'tool' }>;

const STATUS_VIEW: Record<ToolItem['status'], { icon: string; label: string }> = {
  running: { icon: '⏳', label: 'выполняется' },
  done: { icon: '✓', label: 'готово' },
  stopped: { icon: '⏹', label: 'остановлено' },
};

/** One agent action (read/write/bash...). Collapsed to a single line, expands to args and result. */
@Component({
  selector: 'app-tool-call-item',
  template: `
    <button
      type="button"
      class="summary"
      [attr.aria-expanded]="expanded()"
      (click)="expanded.set(!expanded())"
    >
      <span class="status" aria-hidden="true">{{ statusView().icon }}</span>
      <span class="name">{{ item().name }}</span>
      <span class="target">{{ target() }}</span>
      <span class="visually-hidden">{{ statusView().label }}</span>
    </button>
    @if (expanded()) {
      <div class="details">
        <pre>{{ item().args }}</pre>
        @if (item().result; as result) {
          <pre>{{ result }}</pre>
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

  /** Short hint of what the tool works on: a path, a command or a pattern. */
  protected readonly target = computed(() => {
    try {
      const args = JSON.parse(this.item().args) as Record<string, unknown>;
      const value = args['path'] ?? args['command'] ?? args['pattern'] ?? '';
      return String(value);
    } catch {
      return '';
    }
  });
}
