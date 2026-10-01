import fs from 'node:fs/promises';
import path from 'node:path';

/** Upper bound so the memory cannot crowd out the model's context. */
export const MEMORY_MAX_BYTES = 16 * 1024;

const REMEMBERED_HEADING = '## Запомнено агентом';

/**
 * Team-wide memory: a Markdown file added to the system prompt of every chat. Created from the
 * committed default on first use, edited in the UI and extended by the agent's `remember` tool.
 */
export class TeamMemory {
  private writing: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly defaultFile: string,
  ) {}

  async read(): Promise<string> {
    try {
      return await fs.readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      const initial = await fs.readFile(this.defaultFile, 'utf8');
      await this.write(initial);
      return initial;
    }
  }

  /** Replaces the memory. Throws when it is larger than {@link MEMORY_MAX_BYTES}. */
  write(content: string): Promise<void> {
    if (Buffer.byteLength(content) > MEMORY_MAX_BYTES) {
      return Promise.reject(new MemoryTooLargeError());
    }
    return this.serialize(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(`${this.file}.tmp`, content);
      await fs.rename(`${this.file}.tmp`, this.file);
    });
  }

  /** Adds a fact under the "remembered" heading. Returns false if it is already there. */
  async remember(fact: string): Promise<boolean> {
    const line = `- ${fact.trim().replace(/\s+/g, ' ')}`;
    const content = await this.read();
    if (content.split('\n').some((existing) => existing.trim() === line)) {
      return false;
    }
    await this.write(appendUnderHeading(content, REMEMBERED_HEADING, line));
    return true;
  }

  private serialize(task: () => Promise<void>): Promise<void> {
    const next = this.writing.then(task, task);
    this.writing = next.catch(() => undefined);
    return next;
  }
}

export class MemoryTooLargeError extends Error {
  constructor() {
    super(`Team memory is limited to ${MEMORY_MAX_BYTES / 1024} KB`);
  }
}

/** Appends a line at the end of a section, creating the section at the end if it is missing. */
export function appendUnderHeading(content: string, heading: string, line: string): string {
  const lines = content.replace(/\s+$/, '').split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) {
    return `${lines.join('\n')}\n\n${heading}\n\n${line}\n`;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2} /.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  // Insert after the last non-empty line of the section.
  let insertAt = end;
  while (insertAt > start + 1 && !lines[insertAt - 1]!.trim()) {
    insertAt--;
  }
  const separator = insertAt === start + 1 ? [''] : [];
  lines.splice(insertAt, 0, ...separator, line);
  return `${lines.join('\n')}\n`;
}
