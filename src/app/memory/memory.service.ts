import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface TeamMemory {
  content: string;
  maxBytes: number;
}

/** Team memory: agreements the agent applies in every chat. */
@Injectable({ providedIn: 'root' })
export class MemoryService {
  private readonly http = inject(HttpClient);

  load(): Promise<TeamMemory> {
    return firstValueFrom(this.http.get<TeamMemory>('/api/memory'));
  }

  async save(content: string): Promise<void> {
    await firstValueFrom(this.http.put('/api/memory', { content }));
  }
}
