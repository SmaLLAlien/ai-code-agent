import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await run('git', args, { cwd });
  return stdout.trim();
}

export interface Checkpoint {
  commit: string;
  files: string[];
}

/**
 * Commits everything the agent changed in the workspace. Returns undefined when nothing changed.
 * One commit per agent run gives the chat a history of what each request did.
 */
export async function commitCheckpoint(cwd: string, request: string): Promise<Checkpoint | undefined> {
  if (!(await git(['status', '--porcelain'], cwd))) {
    return undefined;
  }
  const message = request.split('\n')[0]!.slice(0, 72) || 'agent changes';
  await git(['add', '-A'], cwd);
  await git(
    ['-c', 'user.name=ai-agent', '-c', 'user.email=agent@localhost', 'commit', '-q', '-m', message],
    cwd,
  );
  const commit = await git(['rev-parse', '--short', 'HEAD'], cwd);
  const files = (await git(['diff', '--name-only', 'HEAD~1', 'HEAD'], cwd)).split('\n').filter(Boolean);
  return { commit, files };
}
