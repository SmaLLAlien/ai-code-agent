import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ChatItem } from './chat-items';
import { MarkdownView } from './markdown-view';
import { PlanCard } from './plan-card';
import { QuestionCard } from './question-card';
import { ToolCallItem } from './tool-call-item';

@Component({
  selector: 'app-message-list',
  imports: [MarkdownView, PlanCard, QuestionCard, ToolCallItem],
  templateUrl: './message-list.html',
  styleUrl: './message-list.scss',
  host: { class: 'message-list' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageList {
  readonly items = input.required<readonly ChatItem[]>();
  /** A run is in progress: cards cannot be acted on. */
  readonly busy = input(false);
  readonly answer = output<{ id: string; text: string }>();
  readonly approvePlan = output<string>();
  readonly revisePlan = output<void>();
}
