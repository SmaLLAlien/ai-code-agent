import fs from 'node:fs/promises';
import path from 'node:path';
import type { ChatMode, TodoItem } from './chat-state.js';

/** What is persisted about a chat. The pi session and the UI event log live in their own files. */
export interface ChatRecord {
  id: string;
  title: string;
  workspacePath: string;
  mode: ChatMode;
  todo: TodoItem[];
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Storage of chat metadata. An interface so the JSON file can later be replaced by a database. */
export interface ChatStore {
  list(): Promise<ChatRecord[]>;
  get(id: string): Promise<ChatRecord | undefined>;
  save(record: ChatRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * All chats in one JSON file, cached in memory. Writes are serialized and atomic (temp file +
 * rename), so a crash never leaves a half-written file.
 */
export class JsonFileChatStore implements ChatStore {
  private records: Promise<Map<string, ChatRecord>> | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async list(): Promise<ChatRecord[]> {
    const records = await this.load();
    return [...records.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<ChatRecord | undefined> {
    return (await this.load()).get(id);
  }

  async save(record: ChatRecord): Promise<void> {
    (await this.load()).set(record.id, { ...record, todo: [...record.todo] });
    await this.persist();
  }

  async delete(id: string): Promise<void> {
    if ((await this.load()).delete(id)) {
      await this.persist();
    }
  }

  private load(): Promise<Map<string, ChatRecord>> {
    this.records ??= fs
      .readFile(this.file, 'utf8')
      .then((text) => JSON.parse(text) as ChatRecord[])
      .catch((err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          return [];
        }
        throw err;
      })
      .then((list) => new Map(list.map((record) => [record.id, record])));
    return this.records;
  }

  private persist(): Promise<void> {
    this.writing = this.writing.then(async () => {
      const records = [...(await this.load()).values()];
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(records, null, 2));
      await fs.rename(tmp, this.file);
    });
    return this.writing;
  }
}
