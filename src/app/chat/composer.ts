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
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ACCEPTED_FILES, checkFile, MAX_ATTACHMENTS } from './attachments';
import { CHAT_COMMANDS, parseCommand } from './chat-commands';
import type { ChatMode } from './chat-items';

export interface ComposerMessage {
  text: string;
  files: File[];
}

interface PickedFile {
  id: string;
  file: File;
  /** Object URL of an image thumbnail; revoked when the file leaves the composer. */
  preview?: string;
}

/**
 * Message input with the mode switch. Enter sends, Shift+Enter inserts a new line; `/plan` and
 * `/agent` switch the mode. The send button turns into Stop while the agent runs.
 * Images, .md and .html files can be attached with the button, by drag and drop or by pasting.
 */
@Component({
  selector: 'app-composer',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, MatTooltipModule],
  templateUrl: './composer.html',
  styleUrl: './composer.scss',
  host: {
    class: 'composer',
    '[class.composer--dragging]': 'dragging()',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'dragging.set(false)',
    '(drop)': 'onDrop($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composer {
  readonly running = input(false);
  readonly disabled = input(false);
  readonly mode = input<ChatMode>('plan');
  readonly send = output<ComposerMessage>();
  readonly stop = output<void>();
  readonly modeChange = output<ChatMode>();

  protected readonly modes: readonly { mode: ChatMode; label: string; description: string }[] =
    CHAT_COMMANDS.map((c) => ({
      mode: c.mode,
      label: c.mode === 'plan' ? 'План' : 'Агент',
      description: c.description,
    }));

  protected readonly accept = ACCEPTED_FILES;
  protected readonly text = signal('');
  protected readonly files = signal<readonly PickedFile[]>([]);
  protected readonly fileError = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly canSend = computed(
    () => !this.disabled() && (!!this.text().trim() || this.files().length > 0),
  );
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
    if (!this.canSend()) {
      return;
    }
    const { mode, message } = parseCommand(this.text());
    if (mode) {
      this.modeChange.emit(mode);
    }
    const files = this.files().map((f) => f.file);
    if (message || files.length) {
      this.send.emit({ text: message, files });
      this.clearFiles();
    }
    this.setText('');
  }

  protected onPick(event: Event): void {
    const picker = event.target as HTMLInputElement;
    this.addFiles([...(picker.files ?? [])]);
    // Reset so picking the same file again fires `change`.
    picker.value = '';
  }

  protected onPaste(event: ClipboardEvent): void {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length) {
      event.preventDefault();
      this.addFiles(files);
    }
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled() || !event.dataTransfer?.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    this.dragging.set(false);
    if (this.disabled() || !event.dataTransfer?.files.length) {
      return;
    }
    event.preventDefault();
    this.addFiles([...event.dataTransfer.files]);
  }

  protected removeFile(id: string): void {
    const removed = this.files().find((f) => f.id === id);
    if (removed?.preview) {
      URL.revokeObjectURL(removed.preview);
    }
    this.files.update((files) => files.filter((f) => f.id !== id));
    this.fileError.set(null);
  }

  private addFiles(candidates: readonly File[]): void {
    const errors: string[] = [];
    const added: PickedFile[] = [];
    for (const file of candidates) {
      const check = checkFile(file);
      if (!check.ok) {
        errors.push(check.error);
      } else if (this.files().length + added.length >= MAX_ATTACHMENTS) {
        errors.push(`Не больше ${MAX_ATTACHMENTS} файлов в одном сообщении`);
        break;
      } else {
        const preview = check.kind === 'image' ? URL.createObjectURL(file) : undefined;
        added.push({ id: crypto.randomUUID(), file, ...(preview && { preview }) });
      }
    }
    this.files.update((files) => [...files, ...added]);
    this.fileError.set(errors.length ? errors.join('; ') : null);
  }

  private clearFiles(): void {
    this.files().forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    this.files.set([]);
    this.fileError.set(null);
  }

  private setText(value: string): void {
    this.text.set(value);
    // Write the DOM directly: if Enter comes in the same frame as the last keystroke, the [value]
    // binding was never rendered with the typed text, so resetting it is not seen as a change.
    this.field().nativeElement.value = value;
  }
}
