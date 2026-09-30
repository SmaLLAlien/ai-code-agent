import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import { appConfig } from '../config.js';
import { getAgentModel, getModelRuntime } from './llm.js';

const TOOLS = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'];

/** Creates a pi agent session working inside the given workspace. History lives in memory. */
export async function createSession(cwd: string): Promise<AgentSession> {
  const { dir: agentDir, thinkingLevel } = appConfig.agent;

  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir });
  await resourceLoader.reload();

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: await getModelRuntime(),
    model: await getAgentModel(),
    thinkingLevel,
    tools: TOOLS,
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
  });
  if (modelFallbackMessage) {
    console.warn(modelFallbackMessage);
  }
  return session;
}
