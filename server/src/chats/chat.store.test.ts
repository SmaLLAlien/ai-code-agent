import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { type ChatRecord, JsonFileChatStore } from './chat.store.js';

function record(id: string, updatedAt: string): ChatRecord {
  return {
    id,
    title: id,
    workspacePath: `/ws/${id}`,
    mode: 'plan',
    todo: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

test('saves, lists newest first, survives a reload and deletes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-store-'));
  const file = path.join(dir, 'nested', 'chats.json');
  try {
    const store = new JsonFileChatStore(file);
    assert.deepEqual(await store.list(), []);

    await Promise.all([
      store.save(record('old', '2026-01-01T00:00:00.000Z')),
      store.save(record('new', '2026-02-01T00:00:00.000Z')),
    ]);
    assert.deepEqual((await store.list()).map((r) => r.id), ['new', 'old']);

    const reloaded = new JsonFileChatStore(file);
    assert.equal((await reloaded.get('old'))?.workspacePath, '/ws/old');

    await reloaded.delete('old');
    assert.deepEqual((await new JsonFileChatStore(file).list()).map((r) => r.id), ['new']);
    assert.equal(fs.existsSync(`${file}.tmp`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
