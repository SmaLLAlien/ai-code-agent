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
  templateUrl: './memory-dialog.html',
  styleUrl: './memory-dialog.scss',
  host: { class: 'memory-dialog' },
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
