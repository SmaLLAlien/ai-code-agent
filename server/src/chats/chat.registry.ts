import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { createSession } from '../agent/create-session.js';
import { appConfig } from '../config.js';
import { createWorkspace } from '../workspaces/workspace.service.js';
import { type ChatState, createChatState } from './chat-state.js';
import { type ChatRecord, type ChatStore, JsonFileChatStore } from './chat.store.js';
import { ChatEventLog } from './event-log.js';

export const DEFAULT_TITLE = 'Новый чат';
const TITLE_LENGTH = 60;

/** A chat loaded into memory: its record plus a live pi session. */
export interface Chat {
  id: string;
  title: string;
  workspacePath: string;
  session: AgentSession;
  state: ChatState;
  createdAt: Date;
  lastUsedAt: number;
}

/**
 * Chats are persisted (metadata in the store, model history in pi session files, the visible feed
 * in the event log) and loaded into memory on demand. Idle sessions are unloaded to free memory.
 */
class ChatRegistry {
  private readonly loaded = new Map<string, Chat>();
  private readonly loading = new Map<string, Promise<Chat | undefined>>();
  private readonly chatsDir = path.join(appConfig.dataDir, 'chats');
  readonly store: ChatStore = new JsonFileChatStore(path.join(appConfig.dataDir, 'chats.json'));
  readonly events = new ChatEventLog(this.chatsDir);
  private sweeper: NodeJS.Timeout | undefined;

  async create(): Promise<Chat> {
    const id = randomUUID();
    const workspacePath = await createWorkspace(id);
    const now = new Date();
    const record: ChatRecord = {
      id,
      title: DEFAULT_TITLE,
      workspacePath,
      mode: 'plan',
      todo: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.store.save(record);
    return this.open(record);
  }

  /** Returns the chat, restoring its session from disk if it is not in memory. */
  async get(id: string): Promise<Chat | undefined> {
    const chat = this.loaded.get(id);
    if (chat) {
      chat.lastUsedAt = Date.now();
      return chat;
    }
    let pending = this.loading.get(id);
    if (!pending) {
      pending = this.store
        .get(id)
        .then((record) => (record ? this.open(record) : undefined))
        .finally(() => this.loading.delete(id));
      this.loading.set(id, pending);
    }
    return pending;
  }

  /** Persists title, mode and progress; the first user message becomes the title. */
  async saveAfterRun(chat: Chat, request: string): Promise<void> {
    if (chat.title === DEFAULT_TITLE) {
      chat.title = toTitle(request);
    }
    await this.save(chat);
  }

  /** Renames without loading the pi session. Returns false for an unknown chat. */
  async rename(id: string, title: string): Promise<boolean> {
    const record = await this.store.get(id);
    if (!record) {
      return false;
    }
    const chat = this.loaded.get(id);
    if (chat) {
      chat.title = title;
    }
    await this.store.save({ ...record, title, updatedAt: new Date().toISOString() });
    return true;
  }

  /** Removes the chat and everything it produced: record, feed, pi session and workspace. */
  async delete(id: string): Promise<boolean> {
    const record = await this.store.get(id);
    if (!record) {
      return false;
    }
    const chat = this.loaded.get(id);
    if (chat) {
      await chat.session.abort();
      chat.session.dispose();
      this.loaded.delete(id);
    }
    await this.store.delete(id);
    const remove = (dir: string) => fs.rm(dir, { recursive: true, force: true, maxRetries: 5 });
    await Promise.all([remove(this.chatDir(id)), remove(record.workspacePath)]);
    return true;
  }

  /** Starts unloading sessions idle for longer than `agent.sessionIdleMinutes`. */
  startIdleSweep(): void {
    const idleMs = appConfig.agent.sessionIdleMinutes * 60_000;
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const chat of this.loaded.values()) {
        if (!chat.session.isStreaming && now - chat.lastUsedAt > idleMs) {
          chat.session.dispose();
          this.loaded.delete(chat.id);
        }
      }
    }, 60_000);
    this.sweeper.unref();
  }

  disposeAll(): void {
    clearInterval(this.sweeper);
    for (const chat of this.loaded.values()) {
      chat.session.dispose();
    }
    this.loaded.clear();
  }

  private async open(record: ChatRecord): Promise<Chat> {
    const state = { ...createChatState(), mode: record.mode, todo: [...record.todo] };
    const sessionDir = path.join(this.chatDir(record.id), 'session');
    const session = await createSession(record.workspacePath, state, sessionDir);
    const chat: Chat = {
      id: record.id,
      title: record.title,
      workspacePath: record.workspacePath,
      session,
      state,
      createdAt: new Date(record.createdAt),
      lastUsedAt: Date.now(),
    };
    this.loaded.set(chat.id, chat);
    return chat;
  }

  private async save(chat: Chat): Promise<void> {
    await this.store.save({
      id: chat.id,
      title: chat.title,
      workspacePath: chat.workspacePath,
      mode: chat.state.mode,
      todo: chat.state.todo,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private chatDir(id: string): string {
    return path.join(this.chatsDir, id);
  }
}

/** First line of the first message, shortened for the chat list. */
export function toTitle(request: string): string {
  const line = request.trim().split('\n')[0]!.trim();
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line || DEFAULT_TITLE;
}

export const chatRegistry = new ChatRegistry();
