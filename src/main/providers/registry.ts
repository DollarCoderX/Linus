import type { ProviderOption } from '../../shared/linus';
import type { LinusEnv } from '../config/env';

export const providerRegistry: ProviderOption[] = [
  {
    id: 'auto',
    name: 'Auto',
    model: 'Linus choice',
    status: 'ready',
    locality: 'mixed',
    capabilities: ['routing', 'fallbacks']
  },
  {
    id: 'groq',
    name: 'Groq',
    model: 'Fast remote models',
    status: 'needs-key',
    locality: 'remote',
    capabilities: ['chat', 'streaming', 'tools', 'tts-todo']
  },
  {
    id: 'gemini',
    name: 'Gemini',
    model: 'Reasoning + vision',
    status: 'needs-key',
    locality: 'remote',
    capabilities: ['chat', 'streaming', 'vision', 'structured-output']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    model: 'Model marketplace',
    status: 'needs-key',
    locality: 'remote',
    capabilities: ['chat', 'streaming', 'model-routing']
  },
  {
    id: 'ollama',
    name: 'Ollama Local',
    model: 'Local models',
    status: 'offline',
    locality: 'local',
    capabilities: ['chat', 'privacy', 'local-first']
  },
  {
    id: 'lla5',
    name: 'Lla-5',
    model: 'Pollinations text',
    status: 'ready',
    locality: 'remote',
    capabilities: ['chat', 'free-text', 'pollinations']
  }
];

export function buildProviderRegistry(env: LinusEnv): ProviderOption[] {
  return [
    {
      id: 'auto',
      name: 'Auto',
      model: 'Best available',
      status: hasAnyProvider(env) ? 'ready' : 'needs-key',
      locality: 'mixed',
      capabilities: ['routing', 'fallbacks']
    },
    {
      id: 'groq',
      name: 'Groq',
      model: env.groqTextModel,
      status: env.groqTextApiKey ? 'ready' : 'needs-key',
      locality: 'remote',
      capabilities: ['chat', 'streaming-ready', 'vision-configured', 'groq-tts']
    },
    {
      id: 'gemini',
      name: 'Gemini',
      model: env.geminiModel,
      status: env.geminiApiKey ? 'ready' : 'needs-key',
      locality: 'remote',
      capabilities: ['chat', 'vision-capable', 'windows-tts']
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      model: env.openRouterModel,
      status: env.openRouterApiKey ? 'ready' : 'needs-key',
      locality: 'remote',
      capabilities: ['chat', 'free-router', 'windows-tts']
    },
    {
      id: 'ollama',
      name: 'Ollama Local',
      model: env.ollamaModel || 'Set OLLAMA_MODEL',
      status: env.ollamaModel ? 'ready' : 'needs-model',
      locality: 'local',
      capabilities: ['chat', 'privacy', 'local-first', 'windows-tts']
    },
    {
      id: 'lla5',
      name: 'Lla-5',
      model: env.lla5Model,
      status: 'ready',
      locality: 'remote',
      capabilities: ['chat', 'free-text', 'pollinations']
    },
    {
      id: 'pollinations',
      name: 'Pollinations',
      model: env.pollinationsImageModel,
      status: 'ready',
      locality: 'remote',
      capabilities: ['image-generation', 'no-key']
    }
  ];
}

function hasAnyProvider(env: LinusEnv): boolean {
  return Boolean(
    env.groqTextApiKey || env.geminiApiKey || env.openRouterApiKey || env.ollamaModel
  );
}
