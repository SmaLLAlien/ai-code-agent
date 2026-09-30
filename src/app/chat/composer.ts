import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** Message input. Enter sends, Shift+Enter inserts a new line; the button turns into Stop while running. */
@Component({
  selector: 'app-composer',
  template: `
    <label class="visually-hidden" for="composer-input">Сообщение агенту</label>
    <textarea
      #field
      id="composer-input"
      rows="3"
      placeholder="Например: создай страницу «О нас» с контактами"
      [value]="text()"
      [disabled]="disabled()"
      (input)="text.set($any($event.target).value)"
      (keydown.enter)="onEnter($event)"
    ></textarea>
    @if (running()) {
      <button type="button" class="stop" (click)="stop.emit()">Стоп</button>
    } @else {
      <button type="button" [disabled]="disabled() || !text().trim()" (click)="submit()">
        Отправить
      </button>
    }
  `,
  styleUrl: './composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composer {
  readonly running = input(false);
  readonly disabled = input(false);
  readonly send = output<string>();
  readonly stop = output<void>();

  protected readonly text = signal('');
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

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
    const value = this.text().trim();
    if (!value || this.disabled()) {
      return;
    }
    this.send.emit(value);
    this.text.set('');
    // Clear the DOM directly: if Enter comes in the same frame as the last keystroke, the [value]
    // binding was never rendered with the typed text, so resetting it to '' is not seen as a change.
    this.field().nativeElement.value = '';
  }
}
