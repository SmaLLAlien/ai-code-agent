import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatSidebar } from './chat/chat-sidebar';
import { LayoutService } from './layout.service';

/** App shell: chat list on the left (slides in on narrow screens), the open chat on the right. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatSidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { class: 'app' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly layout = inject(LayoutService);
}
