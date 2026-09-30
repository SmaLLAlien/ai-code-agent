import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type { ChatState } from '../chats/chat-state.js';
import { appConfig } from '../config.js';
import { modeExtension } from './extensions/mode.extension.js';
import { getAgentModel, getModelRuntime } from './llm.js';
import { ASK_USER, askUserTool } from './tools/ask-user.tool.js';
import { createUpdateTodoTool, UPDATE_TODO } from './tools/update-todo.tool.js';

const BUILTIN_TOOLS = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'];

/**
 * Creates a pi agent session working inside the given workspace. History lives in memory.
 * `state` is the chat's mutable state: the mode extension and the tools read and update it.
 */
export async function createSession(cwd: string, state: ChatState): Promise<AgentSession> {
  const { dir: agentDir, thinkingLevel } = appConfig.agent;

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    extensionFactories: [modeExtension(state, cwd)],
  });
  await resourceLoader.reload();

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: await getModelRuntime(),
    model: await getAgentModel(),
    thinkingLevel,
    // An explicit allowlist enables only the listed tools, custom ones included.
    tools: [...BUILTIN_TOOLS, ASK_USER, UPDATE_TODO],
    customTools: [askUserTool, createUpdateTodoTool(state)],
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
  });
  if (modelFallbackMessage) {
    console.warn(modelFallbackMessage);
  }
  return session;
}
