import fs from 'node:fs/promises';
import path from 'node:path';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import type { Api, Model } from '@earendil-works/pi-ai';
import { appConfig, type LlmProviderConfig } from '../config.js';

/** API keys by provider name. Kept in memory only: never logged, never written to disk. */
const keys = new Map<string, string>();

/**
 * Reads LLM API keys from the environment once at startup and removes them from `process.env`.
 * pi's `bash` tool runs as a child process of this server and would otherwise inherit the keys,
 * letting any chat user print them with `env`.
 */
export function loadLlmKeys(): void {
  const { active, providers } = appConfig.agent.llm;
  for (const [name, provider] of Object.entries(providers)) {
    const key = process.env[provider.apiKeyEnv];
    if (key) {
      keys.set(name, key);
    }
    delete process.env[provider.apiKeyEnv];
  }

  const activeProvider = providers[active];
  if (activeProvider && !keys.has(active)) {
    throw new Error(`${activeProvider.apiKeyEnv} is not set (active LLM provider: ${active})`);
  }
}

/** Content of pi's models.json for providers pi does not know out of the box. Holds no keys. */
export function buildCustomModels(providers: Record<string, LlmProviderConfig>): {
  providers: Record<string, unknown>;
} {
  const custom = Object.values(providers).flatMap(({ piProvider, model, custom }) =>
    custom
      ? [
          [
            piProvider,
            {
              baseUrl: custom.baseUrl,
              api: custom.api,
              models: [
                {
                  id: model,
                  name: model,
                  contextWindow: custom.contextWindow,
                  maxTokens: custom.maxTokens,
                  input: ['text'],
                },
              ],
            },
          ] as const,
        ]
      : [],
  );
  return { providers: Object.fromEntries(custom) };
}

let runtime: Promise<ModelRuntime> | undefined;

export function getModelRuntime(): Promise<ModelRuntime> {
  runtime ??= createModelRuntime();
  return runtime;
}

async function createModelRuntime(): Promise<ModelRuntime> {
  const { stateDir, llm } = appConfig.agent;
  const modelsPath = path.join(stateDir, 'models.json');
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(modelsPath, JSON.stringify(buildCustomModels(llm.providers), null, 2));

  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(stateDir, 'auth.json'),
    modelsPath,
  });
  // Runtime keys live in an in-memory override map inside pi; they are not persisted to auth.json.
  for (const [name, key] of keys) {
    const provider = llm.providers[name];
    if (provider) {
      await modelRuntime.setRuntimeApiKey(provider.piProvider, key);
    }
  }
  return modelRuntime;
}

export async function getAgentModel(): Promise<Model<Api>> {
  const { active, providers } = appConfig.agent.llm;
  const { piProvider, model } = providers[active]!;
  const found = (await getModelRuntime()).getModel(piProvider, model);
  if (!found) {
    throw new Error(`Unknown model ${piProvider}/${model}`);
  }
  return found;
}
