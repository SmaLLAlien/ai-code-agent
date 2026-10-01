import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { commitCheckpoint } from './checkpoint.js';

const run = promisify(execFile);

export const BUNDLE_NAME = 'repo.bundle';

export interface WorkspaceArchive {
  /** The zip as a stream; pipe it to the response. */
  stream: Readable;
  /** Resolves when git has finished writing the zip (rejects on failure). */
  done: Promise<void>;
}

/**
 * Zips a workspace for the team: the project files tracked by git (so `node_modules`, builds and
 * caches are left out by the starter's .gitignore) under `<folder>/`, plus `<folder>/repo.bundle`
 * with the full history of the agent's commits (`git clone repo.bundle <dir>` restores it).
 * Uncommitted changes, e.g. from a stopped run, are committed first so the archive matches the disk.
 */
export async function archiveWorkspace(cwd: string, folder: string): Promise<WorkspaceArchive> {
  await commitCheckpoint(cwd, 'Снимок для выгрузки');

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-export-'));
  const bundle = path.join(tmp, BUNDLE_NAME);
  try {
    await run('git', ['bundle', 'create', bundle, '--all'], { cwd });
  } catch (err) {
    await fs.rm(tmp, { recursive: true, force: true });
    throw err;
  }

  const git = spawn(
    'git',
    ['archive', '--format=zip', `--prefix=${folder}/`, `--add-file=${bundle}`, 'HEAD'],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderr = '';
  git.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

  const done = new Promise<void>((resolve, reject) => {
    git.on('error', reject);
    git.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`git archive failed (${code}): ${stderr.trim()}`)),
    );
  }).finally(() => fs.rm(tmp, { recursive: true, force: true, maxRetries: 5 }));

  return { stream: git.stdout, done };
}

/** ASCII folder/file name for the archive; falls back to `project-<id>` for non-Latin titles. */
export function archiveName(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || `project-${id.slice(0, 8)}`;
}
