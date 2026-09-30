import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { appConfig } from '../config.js';

const run = promisify(execFile);

function git(args: string[], cwd?: string): Promise<unknown> {
  return run('git', args, { cwd });
}

/**
 * Creates `<workspacesRoot>/<chatId>` as a fresh copy of the starter with its own git history.
 * The own `.git` matters: pi looks for `.agents/skills` up to the git root, and later layers
 * commit agent checkpoints there.
 */
export async function createWorkspace(chatId: string): Promise<string> {
  const { repo, ref } = appConfig.starter;
  const dir = path.join(appConfig.workspacesRoot, chatId);
  await fs.mkdir(appConfig.workspacesRoot, { recursive: true });

  try {
    await git(['clone', '--depth', '1', '--branch', ref, repo, dir]);
    await fs.rm(path.join(dir, '.git'), { recursive: true, force: true });
    await git(['init'], dir);
    await git(['add', '-A'], dir);
    await git(
      ['-c', 'user.name=ai-agent', '-c', 'user.email=agent@localhost', 'commit', '-m', 'starter'],
      dir,
    );
  } catch (err) {
    // Windows may briefly lock files git just touched; a failed cleanup must not hide the cause.
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 5 }).catch(() => undefined);
    throw new Error(`Failed to create workspace from ${repo}#${ref}`, { cause: err });
  }

  return dir;
}
