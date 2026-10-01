import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Question } from './chat-items';

/**
 * The agent's clarifying questions. Each question has suggested options and a free-text answer;
 * all answers are sent back as one user message.
 */
@Component({
  selector: 'app-question-card',
  templateUrl: './question-card.html',
  styleUrl: './question-card.scss',
  host: { class: 'question-card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionCard {
  readonly questions = input.required<Question[]>();
  readonly disabled = input(false);
  readonly answer = output<string>();

  protected readonly selected = signal<Partial<Record<string, readonly string[]>>>({});
  protected readonly custom = signal<Partial<Record<string, string>>>({});

  protected readonly complete = computed(() =>
    this.questions().every((q) => this.answerFor(q.id).length > 0),
  );

  protected isSelected(questionId: string, option: string): boolean {
    return this.selected()[questionId]?.includes(option) ?? false;
  }

  protected toggle(question: Question, option: string): void {
    this.selected.update((all) => {
      const current = all[question.id] ?? [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : question.multiSelect
          ? [...current, option]
          : [option];
      return { ...all, [question.id]: next };
    });
  }

  protected setCustom(questionId: string, value: string): void {
    this.custom.update((all) => ({ ...all, [questionId]: value }));
  }

  protected submit(): void {
    const lines = this.questions().map((q) => `- ${q.text}: ${this.answerFor(q.id).join(', ')}`);
    this.answer.emit(`Ответы:\n${lines.join('\n')}`);
  }

  private answerFor(questionId: string): string[] {
    const custom = this.custom()[questionId]?.trim();
    return [...(this.selected()[questionId] ?? []), ...(custom ? [custom] : [])];
  }
}
