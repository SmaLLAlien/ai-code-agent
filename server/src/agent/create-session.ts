import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type { ChatState } from '../chats/chat-state.js';
import { appConfig } from '../config.js';
import { teamMemory } from '../memory/index.js';
import { memoryExtension } from './extensions/memory.extension.js';
import { modeExtension } from './extensions/mode.extension.js';
import { getAgentModel, getModelRuntime } from './llm.js';
import { ASK_USER, askUserTool } from './tools/ask-user.tool.js';
import { createRememberTool, REMEMBER } from './tools/remember.tool.js';
import { createUpdateTodoTool, UPDATE_TODO } from './tools/update-todo.tool.js';

const BUILTIN_TOOLS = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'];

/**
 * Creates or restores the pi agent session of a chat. The model's history is persisted by pi as
 * JSONL in `sessionDir`; reopening the same directory continues the conversation.
 * `state` is the chat's mutable state: the mode extension and the tools read and update it.
 */
export async function createSession(
  cwd: string,
  state: ChatState,
  sessionDir: string,
): Promise<AgentSession> {
  const { dir: agentDir, thinkingLevel } = appConfig.agent;

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    extensionFactories: [modeExtension(state, cwd), memoryExtension(teamMemory)],
  });
  await resourceLoader.reload();

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: await getModelRuntime(),
    model: await getAgentModel(),
    thinkingLevel,
    // An explicit allowlist enables only the listed tools, custom ones included.
    tools: [...BUILTIN_TOOLS, ASK_USER, UPDATE_TODO, REMEMBER],
    customTools: [askUserTool, createUpdateTodoTool(state), createRememberTool(teamMemory)],
    resourceLoader,
    sessionManager: SessionManager.continueRecent(cwd, sessionDir),
  });
  if (modelFallbackMessage) {
    console.warn(modelFallbackMessage);
  }
  return session;
}
