import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { RunAgentInput } from '@ag-ui/core';
import {
  AttachmentError,
  buildPrompt,
  ChatAttachments,
  MAX_ATTACHMENTS,
  parseUserMessage,
  requestSummary,
} from './attachments.js';

const b64 = (text: string): string => Buffer.from(text).toString('base64');

function run(content: unknown): Partial<RunAgentInput> {
  return { messages: [{ id: '1', role: 'user', content }] } as Partial<RunAgentInput>;
}

function image(mimeType = 'image/png', value = b64('png'), filename = 'shot.png'): unknown {
  return { type: 'image', source: { type: 'data', value, mimeType }, metadata: { filename } };
}

function document(text: string, mimeType = 'text/html', filename = 'proto.html'): unknown {
  return {
    type: 'document',
    source: { type: 'data', value: b64(text), mimeType },
    metadata: { filename },
  };
}

test('parseUserMessage keeps a plain string message as text', () => {
  assert.deepEqual(parseUserMessage(run('  hi  ')), { text: 'hi', images: [], documents: [] });
});

test('parseUserMessage splits text, images and documents', () => {
  const message = parseUserMessage(
    run([{ type: 'text', text: 'Сделай так' }, image(), document('<h1>Привет</h1>')]),
  );
  assert.equal(message.text, 'Сделай так');
  assert.deepEqual(message.images, [
    { type: 'image', data: b64('png'), mimeType: 'image/png', filename: 'shot.png' },
  ]);
  assert.deepEqual(message.documents, [
    { filename: 'proto.html', mimeType: 'text/html', text: '<h1>Привет</h1>' },
  ]);
});

test('parseUserMessage strips directories from file names', () => {
  const message = parseUserMessage(run([image('image/png', b64('x'), '../../etc/a.png')]));
  assert.equal(message.images[0]?.filename, 'a.png');
});

test('parseUserMessage rejects unsupported types, big files and too many files', () => {
  assert.throws(() => parseUserMessage(run([image('image/svg+xml')])), AttachmentError);
  assert.throws(() => parseUserMessage(run([document('x', 'application/pdf')])), AttachmentError);
  assert.throws(() => parseUserMessage(run([document('x'.repeat(300 * 1024))])), AttachmentError);
  const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, () => image());
  assert.throws(() => parseUserMessage(run(many)), AttachmentError);
});

test('buildPrompt appends documents inline after the text', () => {
  const message = parseUserMessage(
    run([{ type: 'text', text: 'ТЗ ниже' }, document('# Title', 'text/markdown', 'a "b".md')]),
  );
  assert.equal(
    buildPrompt(message),
    'ТЗ ниже\n\n<attached_file name="a &quot;b&quot;.md" type="text/markdown">\n# Title\n</attached_file>',
  );
});

test('requestSummary lists attachment names when there is no text', () => {
  const message = parseUserMessage(run([image(), document('x')]));
  assert.equal(requestSummary(message), 'Вложения: shot.png, proto.html');
  assert.equal(requestSummary({ ...message, text: 'hi' }), 'hi');
});

test('ChatAttachments stores images and resolves only its own file names', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'attachments-'));
  try {
    const store = new ChatAttachments(dir);
    const message = parseUserMessage(run([image(), document('x')]));
    const views = await store.save('chat', message);
    assert.equal(views.length, 2);
    assert.equal(views[1]?.kind, 'document');
    const url = views[0]?.url ?? '';
    assert.match(url, /^\/api\/chats\/chat\/attachments\/[0-9a-f-]{36}\.png$/);
    const file = url.split('/').pop() ?? '';
    const stored = store.filePath('chat', file);
    assert.ok(stored);
    assert.equal(await fs.readFile(stored, 'utf8'), 'png');
    assert.equal(store.filePath('chat', '../chats.json'), undefined);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
