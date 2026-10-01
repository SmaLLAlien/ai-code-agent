import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createChatState } from '../../chats/chat-state.js';
import { modeExtension } from './mode.extension.js';

type Handler = (event: Record<string, unknown>) => unknown;

/** Runs the extension factory against a fake pi API and returns the registered handlers. */
function setup(mode: 'plan' | 'agent') {
  const state = createChatState();
  state.mode = mode;
  const handlers = new Map<string, Handler>();
  const pi = { on: (name: string, handler: Handler) => handlers.set(name, handler) };
  const cwd = path.resolve('workspace');
  void modeExtension(state, cwd)(pi as unknown as ExtensionAPI);
  const toolCall = (toolName: string, input: object) =>
    handlers.get('tool_call')!({ type: 'tool_call', toolName, input });
  return { state, handlers, toolCall, cwd };
}

test('plan mode blocks commands and code changes but allows the plan file', () => {
  const { toolCall, cwd } = setup('plan');
  assert.equal((toolCall('bash', { command: 'ls' }) as { block?: boolean }).block, true);
  assert.equal((toolCall('write', { path: 'src/app.ts' }) as { block?: boolean }).block, true);
  assert.equal((toolCall('edit', { path: '../docs/PLAN.md' }) as { block?: boolean }).block, true);
  assert.equal(toolCall('write', { path: 'docs/PLAN.md' }), undefined);
  assert.equal(toolCall('write', { path: 'docs/DECISIONS.md' }), undefined);
  assert.equal(toolCall('edit', { path: path.join(cwd, 'docs', 'PLAN.md') }), undefined);
  assert.equal(toolCall('read', { path: 'src/app.ts' }), undefined);
  assert.equal(toolCall('ask_user', { questions: [] }), undefined);
});

test('agent mode allows every tool', () => {
  const { toolCall } = setup('agent');
  assert.equal(toolCall('bash', { command: 'npm run build' }), undefined);
  assert.equal(toolCall('write', { path: 'src/app.ts' }), undefined);
});

test('the current mode is added to the system prompt on every run', () => {
  const { state, handlers } = setup('plan');
  const event = { systemPromptOptions: { sections: {} as Record<string, string> } };
  handlers.get('before_agent_start')!(event);
  assert.match(event.systemPromptOptions.sections['mode']!, /PLAN mode/);
  assert.match(event.systemPromptOptions.sections['today']!, /^Today is \d{4}-\d{2}-\d{2}\.$/);

  state.mode = 'agent';
  handlers.get('before_agent_start')!(event);
  assert.match(event.systemPromptOptions.sections['mode']!, /AGENT mode/);
});
