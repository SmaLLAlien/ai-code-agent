import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** The list of chats shown in the sidebar, plus create / rename / delete. */
@Injectable({ providedIn: 'root' })
export class ChatsService {
  private readonly http = inject(HttpClient);

  readonly chats = signal<readonly ChatSummary[]>([]);
  readonly loadError = signal(false);

  async refresh(): Promise<void> {
    try {
      this.chats.set(await firstValueFrom(this.http.get<ChatSummary[]>('/api/chats')));
      this.loadError.set(false);
    } catch {
      this.loadError.set(true);
    }
  }

  async create(): Promise<string> {
    const { id } = await firstValueFrom(this.http.post<{ id: string }>('/api/chats', {}));
    void this.refresh();
    return id;
  }

  async rename(id: string, title: string): Promise<void> {
    await firstValueFrom(this.http.patch(`/api/chats/${id}`, { title }));
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/chats/${id}`));
    await this.refresh();
  }
}
