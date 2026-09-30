import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { commitCheckpoint } from './checkpoint.js';

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  git('add', '-A');
  git('commit', '-q', '-m', 'starter');
  return dir;
}

test('commits the agent changes and lists the files', async () => {
  const dir = tempRepo();
  try {
    assert.equal(await commitCheckpoint(dir, 'nothing'), undefined);

    fs.writeFileSync(path.join(dir, 'a.txt'), 'changed');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'b.ts'), 'b');
    const checkpoint = await commitCheckpoint(dir, 'Add b\nwith details');

    assert.ok(checkpoint);
    assert.deepEqual(checkpoint.files.sort(), ['a.txt', 'src/b.ts']);
    const subject = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: dir }).toString().trim();
    assert.equal(subject, 'Add b');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
