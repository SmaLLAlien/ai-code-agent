import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MarkdownView } from './markdown-view';

/** The plan the agent wrote in plan mode. Approving it switches the chat to agent mode. */
@Component({
  selector: 'app-plan-card',
  imports: [MarkdownView],
  template: `
    <section class="card" aria-label="План реализации">
      <h2>План реализации</h2>
      <app-markdown-view class="plan" [text]="content()" />
      @if (!decided()) {
        <div class="actions">
          <button type="button" class="approve" [disabled]="disabled()" (click)="approve.emit()">
            Утвердить и реализовать
          </button>
          <button type="button" class="revise" [disabled]="disabled()" (click)="revise.emit()">
            Доработать
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .card {
      max-width: min(46rem, 100%);
      padding: 0.75rem 1rem;
      border: 1px solid var(--accent);
      border-radius: 10px;
      background: var(--surface-muted);
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    .plan {
      display: block;
      max-height: 28rem;
      overflow-y: auto;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    button {
      padding: 0.45rem 1rem;
      border-radius: 8px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .approve {
      border: none;
      background: var(--accent);
      color: var(--on-accent);
    }
    .revise {
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCard {
  readonly content = input.required<string>();
  readonly decided = input(false);
  readonly disabled = input(false);
  readonly approve = output<void>();
  readonly revise = output<void>();
}
