import { randomUUID } from 'node:crypto';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { createSession } from '../agent/create-session.js';
import { createWorkspace } from '../workspaces/workspace.service.js';
import { type ChatState, createChatState } from './chat-state.js';

export interface Chat {
  id: string;
  workspacePath: string;
  session: AgentSession;
  state: ChatState;
  createdAt: Date;
}

/** In-memory chats (layer 1). Persisted storage arrives in layer 3. */
class ChatRegistry {
  private readonly chats = new Map<string, Chat>();

  async create(): Promise<Chat> {
    const id = randomUUID();
    const workspacePath = await createWorkspace(id);
    const state = createChatState();
    const session = await createSession(workspacePath, state);
    const chat: Chat = { id, workspacePath, session, state, createdAt: new Date() };
    this.chats.set(id, chat);
    return chat;
  }

  get(id: string): Chat | undefined {
    return this.chats.get(id);
  }

  disposeAll(): void {
    for (const chat of this.chats.values()) {
      chat.session.dispose();
    }
    this.chats.clear();
  }
}

export const chatRegistry = new ChatRegistry();
