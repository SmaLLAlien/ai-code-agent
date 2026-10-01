import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatSidebar } from './chat/chat-sidebar';
import { LayoutService } from './layout.service';

/** App shell: chat list on the left (slides in on narrow screens), the open chat on the right. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatSidebar],
  template: `
    <div class="shell" [class.sidebar-open]="layout.sidebarOpen()">
      <app-chat-sidebar class="sidebar" />
      <!-- <router-outlet> is an element itself: keep it and the routed page in one grid cell. -->
      <div class="content">
        <router-outlet />
      </div>
      @if (layout.sidebarOpen()) {
        <div class="backdrop" aria-hidden="true" (click)="layout.closeSidebar()"></div>
      }
    </div>
  `,
  styles: `
    .shell {
      display: grid;
      grid-template-columns: 16rem minmax(0, 1fr);
      height: 100dvh;
      overflow: hidden;
    }
    .content {
      display: flex;
      min-width: 0;
      height: 100dvh;
    }
    @media (max-width: 767px) {
      .shell {
        grid-template-columns: minmax(0, 1fr);
      }
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 2;
        width: min(18rem, 85vw);
        transform: translateX(-100%);
        transition: transform 0.2s ease;
      }
      .sidebar-open .sidebar {
        transform: none;
      }
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 1;
        background: rgb(0 0 0 / 0.4);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sidebar {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly layout = inject(LayoutService);
}
