import path from 'node:path';
import config from 'config';
import type { CreateAgentSessionOptions } from '@earendil-works/pi-coding-agent';

export type ThinkingLevel = NonNullable<CreateAgentSessionOptions['thinkingLevel']>;

/** OpenAI-compatible endpoint that pi does not know out of the box (written to pi's models.json). */
export interface CustomProviderConfig {
  baseUrl: string;
  api: 'openai-completions' | 'openai-responses';
  contextWindow: number;
  maxTokens: number;
}

export interface LlmProviderConfig {
  /** Provider id inside pi: a built-in one (`google`) or a custom one described by `custom`. */
  piProvider: string;
  model: string;
  /** Name of the environment variable holding the API key. */
  apiKeyEnv: string;
  custom?: CustomProviderConfig;
}

export interface AppConfig {
  port: number;
  /** Absolute path to the compiled Angular app (the `browser` output folder). */
  clientDist: string;
  /** Absolute path to platform data: chat list, event logs, pi sessions. Not in git. */
  dataDir: string;
  /** Absolute path to the folder holding one workspace per chat. Must live outside this repo. */
  workspacesRoot: string;
  starter: { repo: string; ref: string };
  agent: {
    /** Absolute path to pi's agentDir: platform-level AGENTS.md and skills. */
    dir: string;
    /** Absolute path to pi's runtime state (models.json, auth.json). Not in git. */
    stateDir: string;
    thinkingLevel: ThinkingLevel;
    /** Idle chats unload their pi session from memory after this many minutes. */
    sessionIdleMinutes: number;
    llm: { active: string; providers: Record<string, LlmProviderConfig> };
  };
}

function readProviders(): Record<string, LlmProviderConfig> {
  const raw = config.get<Record<string, LlmProviderConfig>>('agent.llm.providers');
  // Values from `config` are immutable - copy them into plain objects.
  return Object.fromEntries(
    Object.entries(raw).map(([name, p]) => [
      name,
      {
        piProvider: p.piProvider,
        model: p.model,
        apiKeyEnv: p.apiKeyEnv,
        ...(p.custom && { custom: { ...p.custom } }),
      },
    ]),
  );
}

function readLlm(): AppConfig['agent']['llm'] {
  const active = config.get<string>('agent.llm.active');
  const providers = readProviders();
  if (!providers[active]) {
    throw new Error(`agent.llm.active "${active}" is not listed in agent.llm.providers`);
  }
  return { active, providers };
}

/**
 * Typed view over `config/<NODE_CONFIG_ENV>.json`.
 * Relative paths in the JSON are resolved against the server's working directory (`server/`).
 */
export const appConfig: AppConfig = {
  port: config.get<number>('port'),
  clientDist: path.resolve(config.get<string>('clientDist')),
  dataDir: path.resolve(config.get<string>('data.dir')),
  workspacesRoot: path.resolve(config.get<string>('workspaces.root')),
  starter: {
    repo: config.get<string>('starter.repo'),
    ref: config.get<string>('starter.ref'),
  },
  agent: {
    dir: path.resolve(config.get<string>('agent.dir')),
    stateDir: path.resolve(config.get<string>('agent.stateDir')),
    thinkingLevel: config.get<ThinkingLevel>('agent.thinkingLevel'),
    sessionIdleMinutes: config.get<number>('agent.sessionIdleMinutes'),
    llm: readLlm(),
  },
};
