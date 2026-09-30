import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCustomModels } from './llm.js';

test('buildCustomModels writes only custom providers, without keys', () => {
  const result = buildCustomModels({
    juapi: {
      piProvider: 'juapi',
      model: 'some-model',
      apiKeyEnv: 'JUAPI_API_KEY',
      custom: {
        baseUrl: 'https://example.test/v1',
        api: 'openai-completions',
        contextWindow: 1000,
        maxTokens: 100,
      },
    },
    gemini: { piProvider: 'google', model: 'gemini-2.5-pro', apiKeyEnv: 'GEMINI_API_KEY' },
  });

  assert.deepEqual(result, {
    providers: {
      juapi: {
        baseUrl: 'https://example.test/v1',
        api: 'openai-completions',
        models: [
          { id: 'some-model', name: 'some-model', contextWindow: 1000, maxTokens: 100, input: ['text'] },
        ],
      },
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /apiKey|JUAPI_API_KEY/);
});
