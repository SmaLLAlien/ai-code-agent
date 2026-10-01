import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { archiveName, archiveWorkspace } from './export.js';

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
  git('init', '-q');
  fs.writeFileSync(path.join(dir, '.gitignore'), '/node_modules\n');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export {};');
  git('add', '-A');
  git('commit', '-q', '-m', 'starter');
  return dir;
}

test('zips tracked files with the git history and leaves ignored files out', async () => {
  const dir = tempRepo();
  try {
    fs.mkdirSync(path.join(dir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'pkg', 'index.js'), 'ignored');
    // An uncommitted change (e.g. from a stopped run) must be in the archive too.
    fs.writeFileSync(path.join(dir, 'src', 'new.ts'), 'export const x = 1;');

    const archive = await archiveWorkspace(dir, 'my-project');
    const chunks: Buffer[] = [];
    for await (const chunk of archive.stream) {
      chunks.push(chunk as Buffer);
    }
    await archive.done;
    const zip = Buffer.concat(chunks);

    assert.equal(zip.subarray(0, 2).toString(), 'PK');
    // Zip entries keep their names in plain text in the headers.
    for (const name of ['my-project/src/app.ts', 'my-project/src/new.ts', 'my-project/repo.bundle']) {
      assert.ok(zip.includes(name), `${name} is in the archive`);
    }
    assert.ok(!zip.includes('node_modules/pkg'), 'ignored files are left out');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('archiveName makes an ASCII slug or falls back to the chat id', () => {
  assert.equal(archiveName('Coffee Shop: landing page!', 'abcdef123456'), 'coffee-shop-landing-page');
  assert.equal(archiveName('Сайт кофейни', 'abcdef123456'), 'project-abcdef12');
});
