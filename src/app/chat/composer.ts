import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CHAT_COMMANDS, parseCommand } from './chat-commands';
import type { ChatMode } from './chat-items';

/**
 * Message input with the mode switch. Enter sends, Shift+Enter inserts a new line; `/plan` and
 * `/agent` switch the mode. The send button turns into Stop while the agent runs.
 */
@Component({
  selector: 'app-composer',
  template: `
    <div class="toolbar">
      <div class="modes" role="radiogroup" aria-label="Режим агента">
        @for (option of modes; track option.mode) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="mode() === option.mode"
            [title]="option.description"
            (click)="modeChange.emit(option.mode)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </div>
    @if (suggestions().length) {
      <ul class="commands" aria-label="Команды">
        @for (command of suggestions(); track command.name) {
          <li>
            <button type="button" (click)="applySuggestion(command.name)">
              <code>{{ command.name }}</code> {{ command.description }}
            </button>
          </li>
        }
      </ul>
    }
    <div class="row">
      <label class="visually-hidden" for="composer-input">Сообщение агенту</label>
      <textarea
        #field
        id="composer-input"
        rows="3"
        placeholder="Опишите идею или задачу. /plan или /agent — сменить режим"
        [value]="text()"
        [disabled]="disabled()"
        (input)="text.set($any($event.target).value)"
        (keydown.enter)="onEnter($event)"
      ></textarea>
      @if (running()) {
        <button type="button" class="send stop" (click)="stop.emit()">Стоп</button>
      } @else {
        <button type="button" class="send" [disabled]="disabled() || !text().trim()" (click)="submit()">
          Отправить
        </button>
      }
    </div>
  `,
  styleUrl: './composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composer {
  readonly running = input(false);
  readonly disabled = input(false);
  readonly mode = input<ChatMode>('plan');
  readonly send = output<string>();
  readonly stop = output<void>();
  readonly modeChange = output<ChatMode>();

  protected readonly modes: readonly { mode: ChatMode; label: string; description: string }[] =
    CHAT_COMMANDS.map((c) => ({
      mode: c.mode,
      label: c.mode === 'plan' ? 'План' : 'Агент',
      description: c.description,
    }));

  protected readonly text = signal('');
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  /** Commands matching what the user started typing after "/". */
  protected readonly suggestions = computed(() => {
    const value = this.text();
    return /^\/\w*$/.test(value) ? CHAT_COMMANDS.filter((c) => c.name.startsWith(value)) : [];
  });

  focus(): void {
    this.field().nativeElement.focus();
  }

  protected applySuggestion(name: string): void {
    this.setText(`${name} `);
    this.focus();
  }

  protected onEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) {
      return;
    }
    event.preventDefault();
    if (!this.running()) {
      this.submit();
    }
  }

  protected submit(): void {
    if (this.disabled() || !this.text().trim()) {
      return;
    }
    const { mode, message } = parseCommand(this.text());
    if (mode) {
      this.modeChange.emit(mode);
    }
    if (message) {
      this.send.emit(message);
    }
    this.setText('');
  }

  private setText(value: string): void {
    this.text.set(value);
    // Write the DOM directly: if Enter comes in the same frame as the last keystroke, the [value]
    // binding was never rendered with the typed text, so resetting it is not seen as a change.
    this.field().nativeElement.value = value;
  }
}
