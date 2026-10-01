import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from './app.js';

let server: Server;
let baseUrl: string;
let clientDist: string;

before(async () => {
  clientDist = fs.mkdtempSync(path.join(os.tmpdir(), 'client-dist-'));
  fs.writeFileSync(path.join(clientDist, 'index.html'), '<!doctype html><title>app</title>');
  fs.writeFileSync(path.join(clientDist, 'main-ABCD1234.js'), 'console.log(1)');
  server = createApp(clientDist).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  fs.rmSync(clientDist, { recursive: true, force: true });
});

const get = (url: string, accept = 'text/html') => fetch(baseUrl + url, { headers: { accept } });

test('client routes fall back to index.html without caching', async () => {
  const res = await get('/chat/123');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<title>app<\/title>/);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
});

test('hashed bundles are cached forever', async () => {
  const res = await get('/main-ABCD1234.js', '*/*');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') ?? '', /immutable/);
});

test('missing files and unknown API routes stay 404', async () => {
  assert.equal((await get('/missing.js', '*/*')).status, 404);
  const api = await get('/api/nope', 'application/json');
  assert.equal(api.status, 404);
  assert.deepEqual(await api.json(), { error: 'Not Found' });
});

test('non-HTML requests do not get the fallback', async () => {
  assert.equal((await get('/chat/123', 'application/json')).status, 404);
});
