import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MarkdownView } from './markdown-view';

/** The plan the agent wrote in plan mode. Approving it switches the chat to agent mode. */
@Component({
  selector: 'app-plan-card',
  imports: [MarkdownView],
  templateUrl: './plan-card.html',
  styleUrl: './plan-card.scss',
  host: { class: 'plan-card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCard {
  readonly content = input.required<string>();
  readonly decided = input(false);
  readonly disabled = input(false);
  readonly approve = output<void>();
  readonly revise = output<void>();
}
