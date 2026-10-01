import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MemoryService } from './memory.service';

/** Editor of the team memory (Markdown). Changes apply to the next message in every chat. */
@Component({
  selector: 'app-memory-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Память команды</h2>
    <mat-dialog-content>
      <p class="hint">
        Договорённости, которые агент учитывает в каждом чате. Агент дописывает сюда факты по просьбе
        «запомни …».
      </p>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Загрузка памяти" />
      } @else {
        <mat-form-field appearance="outline" class="editor">
          <mat-label>Markdown</mat-label>
          <textarea
            matInput
            rows="18"
            [value]="content()"
            (input)="content.set($any($event.target).value)"
          ></textarea>
          <mat-hint align="end">{{ sizeKb() }} / {{ maxKb() }} КБ</mat-hint>
          @if (tooLarge()) {
            <mat-error>Слишком большой текст — сократите память.</mat-error>
          }
        </mat-form-field>
      }
      @if (error(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Отмена</button>
      <button mat-flat-button [disabled]="loading() || saving() || tooLarge()" (click)="save()">
        Сохранить
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .hint {
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .editor {
      width: 100%;
    }
    .editor textarea {
      font-family: var(--mono);
      font-size: 0.875rem;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoryDialog implements OnInit {
  private readonly memory = inject(MemoryService);
  private readonly ref = inject(MatDialogRef<MemoryDialog>);

  protected readonly content = signal('');
  protected readonly maxBytes = signal(16 * 1024);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly bytes = computed(() => new TextEncoder().encode(this.content()).length);
  protected readonly sizeKb = computed(() => (this.bytes() / 1024).toFixed(1));
  protected readonly maxKb = computed(() => this.maxBytes() / 1024);
  protected readonly tooLarge = computed(() => this.bytes() > this.maxBytes());

  async ngOnInit(): Promise<void> {
    try {
      const { content, maxBytes } = await this.memory.load();
      this.content.set(content);
      this.maxBytes.set(maxBytes);
    } catch {
      this.error.set('Не удалось загрузить память.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.memory.save(this.content());
      this.ref.close(true);
    } catch {
      this.error.set('Не удалось сохранить память.');
    } finally {
      this.saving.set(false);
    }
  }
}
