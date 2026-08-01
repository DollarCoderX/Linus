import type { ProviderId } from '../../shared/linus';
import type { LinusEnv } from '../config/env';
import type { AiProvider, ChatMessage, ChatRequest, ChatResponse, ProviderCapabilities } from './types';

const chatCapabilities: ProviderCapabilities = {
  chat: true,
  streaming: false,
  toolCalling: false,
  vision: false,
  structuredOutput: false,
  textToSpeech: false
};

// Per-provider round-robin counters (in-memory per session)
const keyCounters: Record<string, number> = { groq: 0, gemini: 0, openrouter: 0 };

/** Pick next key from up to 3 configured keys using round-robin. */
function pickKey(provider: string, keys: string[]): string {
  const available = keys.filter(Boolean);
  if (available.length === 0) return '';
  const index = keyCounters[provider] % available.length;
  keyCounters[provider] = (keyCounters[provider] + 1) % available.length;
  return available[index];
}

export function createProviders(env: LinusEnv): AiProvider[] {
  return [
    createGroqProvider(env),
    createGeminiProvider(env),
    createOpenRouterProvider(env),
    createOllamaProvider(env),
    createLla5Provider(env)
  ];
}

function createGroqProvider(env: LinusEnv): AiProvider {
  const allKeys = [env.groqTextApiKey, env.groqTextApiKey2, env.groqTextApiKey3];
  const availableKeys = allKeys.filter(Boolean);

  return {
    id: 'groq',
    displayName: 'Groq',
    capabilities: {
      ...chatCapabilities,
      streaming: true,
      toolCalling: true,
      textToSpeech: Boolean(env.groqTtsApiKey)
    },
    isAvailable: async () => availableKeys.length > 0,
    chat: async (request) => {
      if (availableKeys.length === 0) {
        throw new Error('Groq text is not configured. Add GROQ_TEXT_API_KEY to .env.');
      }

      const apiKey = pickKey('groq', availableKeys);
      console.info(`[Linus Router] Groq using key slot ${availableKeys.indexOf(apiKey) + 1}/${availableKeys.length}`);

      const content = await openAiCompatibleChat({
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey,
        model: request.model || env.groqTextModel,
        messages: request.messages,
        signal: request.signal
      });

      return chatResponse('groq', 'Groq', request.model || env.groqTextModel, content);
    }
  };
}

function createOpenRouterProvider(env: LinusEnv): AiProvider {
  const allKeys = [env.openRouterApiKey, env.openRouterApiKey2, env.openRouterApiKey3];
  const availableKeys = allKeys.filter(Boolean);

  return {
    id: 'openrouter',
    displayName: 'OpenRouter',
    capabilities: {
      ...chatCapabilities,
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true
    },
    isAvailable: async () => availableKeys.length > 0,
    chat: async (request) => {
      if (availableKeys.length === 0) {
        throw new Error('OpenRouter is not configured. Add OPENROUTER_API_KEY to .env.');
      }

      const apiKey = pickKey('openrouter', availableKeys);
      console.info(`[Linus Router] OpenRouter using key slot ${availableKeys.indexOf(apiKey) + 1}/${availableKeys.length}`);

      const content = await openAiCompatibleChat({
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey,
        model: request.model || env.openRouterModel,
        messages: request.messages,
        signal: request.signal,
        extraHeaders: {
          'HTTP-Referer': env.openRouterHttpReferer,
          'X-OpenRouter-Title': env.openRouterAppTitle
        }
      });

      return chatResponse('openrouter', 'OpenRouter', request.model || env.openRouterModel, content);
    }
  };
}

function createGeminiProvider(env: LinusEnv): AiProvider {
  const allKeys = [env.geminiApiKey, env.geminiApiKey2, env.geminiApiKey3];
  const availableKeys = allKeys.filter(Boolean);

  return {
    id: 'gemini',
    displayName: 'Gemini',
    capabilities: {
      ...chatCapabilities,
      vision: true,
      structuredOutput: true
    },
    isAvailable: async () => availableKeys.length > 0,
    chat: async (request) => {
      if (availableKeys.length === 0) {
        throw new Error('Gemini is not configured. Add GEMINI_API_KEY to .env.');
      }

      const apiKey = pickKey('gemini', availableKeys);
      console.info(`[Linus Router] Gemini using key slot ${availableKeys.indexOf(apiKey) + 1}/${availableKeys.length}`);

      const model = request.model || env.geminiModel;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: request.signal,
          body: JSON.stringify({
            contents: geminiContents(request.messages),
            generationConfig: {
              temperature: 0.7
            }
          })
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(readApiError(data, `Gemini request failed with HTTP ${response.status}.`));
      }

      const content = data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? '')
        .join('')
        .trim();

      if (!content) {
        throw new Error('Gemini returned an empty response.');
      }

      return chatResponse('gemini', 'Gemini', model, content);
    }
  };
}

function createOllamaProvider(env: LinusEnv): AiProvider {
  return {
    id: 'ollama',
    displayName: 'Ollama',
    capabilities: chatCapabilities,
    isAvailable: async () => Boolean(env.ollamaModel),
    chat: async (request) => {
      if (!env.ollamaModel) {
        throw new Error('Ollama is missing a model. Add OLLAMA_MODEL to .env.');
      }

      const response = await fetch(`${env.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          model: request.model || env.ollamaModel,
          messages: request.messages.map((message) => ({
            role: message.role === 'tool' ? 'assistant' : message.role,
            content: message.content
          })),
          stream: false
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(readApiError(data, `Ollama request failed with HTTP ${response.status}.`));
      }

      const content = data?.message?.content?.trim();
      if (!content) {
        throw new Error('Ollama returned an empty response.');
      }

      return chatResponse('ollama', 'Ollama', request.model || env.ollamaModel, content);
    }
  };
}

function createLla5Provider(env: LinusEnv): AiProvider {
  return {
    id: 'lla5',
    displayName: 'Lla-5',
    capabilities: {
      ...chatCapabilities,
      streaming: true
    },
    isAvailable: async () => true,
    chat: async (request) => {
      const content = await openAiCompatibleChat({
        endpoint: 'https://text.pollinations.ai/openai',
        apiKey: 'pollinations-free',
        model: request.model || env.lla5Model,
        messages: request.messages,
        signal: request.signal,
        omitAuthorization: true
      });

      return chatResponse('lla5', 'Lla-5', request.model || env.lla5Model, content);
    }
  };
}

async function openAiCompatibleChat({
  endpoint,
  apiKey,
  model,
  messages,
  signal,
  extraHeaders = {},
  omitAuthorization = false
}: {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  extraHeaders?: Record<string, string>;
  omitAuthorization?: boolean;
}): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...(omitAuthorization ? {} : { Authorization: `Bearer ${apiKey}` }),
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(readApiError(data, `Provider request failed with HTTP ${response.status}.`));
  }

  const content = normalizeContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('Provider returned an empty response.');
  }

  return content;
}

function geminiContents(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  const systemText = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n');

  return messages
    .filter((message) => message.role !== 'system' && message.role !== 'tool')
    .map((message, index) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text:
            index === 0 && systemText
              ? `${systemText}\n\nUser request:\n${message.content}`
              : message.content
        }
      ]
    }));
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (typeof part?.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function chatResponse(
  provider: ProviderId,
  providerName: string,
  model: string,
  content: string
): ChatResponse {
  return {
    provider,
    providerName,
    model,
    content,
    verified: true
  };
}

function readApiError(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data && 'error' in data) {
    const error = (data as { error?: { message?: string } | string }).error;
    if (typeof error === 'string') {
      return error;
    }

    if (typeof error?.message === 'string') {
      return error.message;
    }
  }

  return fallback;
}
