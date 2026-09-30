import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./chat/chat-page').then((m) => m.ChatPage) },
];
