import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { appendUnderHeading, MemoryTooLargeError, TeamMemory } from './team-memory.js';

test('appendUnderHeading adds to the section, keeping following sections intact', () => {
  const content = '# M\n\n## Запомнено агентом\n\n- a\n\n## Other\n\ntext\n';
  assert.equal(
    appendUnderHeading(content, '## Запомнено агентом', '- b'),
    '# M\n\n## Запомнено агентом\n\n- a\n- b\n\n## Other\n\ntext\n',
  );
  assert.equal(
    appendUnderHeading('# M\n\n## Запомнено агентом\n', '## Запомнено агентом', '- a'),
    '# M\n\n## Запомнено агентом\n\n- a\n',
  );
  assert.equal(appendUnderHeading('# M\n', '## X', '- a'), '# M\n\n## X\n\n- a\n');
});

test('creates memory from the default, remembers facts once and limits the size', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-'));
  try {
    const defaultFile = path.join(dir, 'default.md');
    fs.writeFileSync(defaultFile, '# Память\n\n## Запомнено агентом\n');
    const memory = new TeamMemory(path.join(dir, 'data', 'memory.md'), defaultFile);

    assert.match(await memory.read(), /# Память/);
    assert.equal(await memory.remember('Основной цвет  #4ea524'), true);
    assert.equal(await memory.remember('Основной цвет #4ea524'), false);
    assert.match(await memory.read(), /- Основной цвет #4ea524\n$/);

    await assert.rejects(memory.write('x'.repeat(17 * 1024)), MemoryTooLargeError);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
