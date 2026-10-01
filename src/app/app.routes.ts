import type { CanDeactivateFn, Routes } from '@angular/router';
import type { ChatPage } from './chat/chat-page';

/** Leaving a chat while the agent runs stops the agent, so the page asks first. */
const confirmLeaveChat: CanDeactivateFn<ChatPage> = (page) => page.confirmLeave();

const loadChatPage = () => import('./chat/chat-page').then((m) => m.ChatPage);

export const routes: Routes = [
  { path: '', title: 'Новый чат', loadComponent: loadChatPage, canDeactivate: [confirmLeaveChat] },
  {
    path: 'chat/:id',
    title: 'Чат',
    loadComponent: loadChatPage,
    canDeactivate: [confirmLeaveChat],
  },
  { path: '**', redirectTo: '' },
];
