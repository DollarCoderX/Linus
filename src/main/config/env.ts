import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderId } from '../../shared/linus';

export interface LinusEnv {
  defaultProvider: ProviderId;
  speakResponses: boolean;
  systemPrompt: string;
  // Groq — up to 3 keys for round-robin routing
  groqTextApiKey: string;
  groqTextApiKey2: string;
  groqTextApiKey3: string;
  groqTextModel: string;
  groqVisionApiKey: string;
  groqVisionModel: string;
  groqTtsApiKey: string;
  groqTtsModel: string;
  groqTtsVoice: string;
  groqTtsResponseFormat: 'wav';
  groqSttApiKey: string;
  groqSttModel: string;
  // Gemini — up to 3 keys
  geminiApiKey: string;
  geminiApiKey2: string;
  geminiApiKey3: string;
  geminiModel: string;
  geminiTtsProvider: TtsProviderChoice;
  // OpenRouter — up to 3 keys
  openRouterApiKey: string;
  openRouterApiKey2: string;
  openRouterApiKey3: string;
  openRouterModel: string;
  openRouterHttpReferer: string;
  openRouterAppTitle: string;
  openRouterTtsProvider: TtsProviderChoice;
  serperApiKey: string;
  googleCustomSearchApiKey: string;
  googleCustomSearchCx: string;
  lla5Model: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaTtsProvider: TtsProviderChoice;
  pollinationsImageModel: string;
  geminiImageModel: string;
  windowsTtsVoice: string;
  windowsTtsRate: number;
  windowsTtsVolume: number;
}

export type TtsProviderChoice = 'auto' | 'groq' | 'windows' | 'off';

const providerIds: ProviderId[] = ['auto', 'groq', 'gemini', 'openrouter', 'ollama', 'pollinations', 'lla5'];
const ttsProviderChoices: TtsProviderChoice[] = ['auto', 'groq', 'windows', 'off'];

export function loadDotEnv(cwd = process.cwd()): void {
  const envPath = join(cwd, '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const delimiter = line.indexOf('=');
    if (delimiter === -1) {
      continue;
    }

    const key = line.slice(0, delimiter).trim();
    const value = unquote(line.slice(delimiter + 1).trim());
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function readLinusEnv(): LinusEnv {
  return {
    defaultProvider: readProvider(
      'LINUS_DEFAULT_PROVIDER',
      readProvider(
        'DAY_DEFAULT_PROVIDER',
        readProvider('CORTEX_DEFAULT_PROVIDER', readProvider('LUNA_DEFAULT_PROVIDER', 'auto'))
      )
    ),
    speakResponses: readBoolean(
      'LINUS_SPEAK_RESPONSES',
      readBoolean(
        'DAY_SPEAK_RESPONSES',
        readBoolean('CORTEX_SPEAK_RESPONSES', readBoolean('LUNA_SPEAK_RESPONSES', false))
      )
    ),
    systemPrompt:
      readString('LINUS_SYSTEM_PROMPT') ||
      readString('DAY_SYSTEM_PROMPT') ||
      readString('CORTEX_SYSTEM_PROMPT') ||
      readString('LUNA_SYSTEM_PROMPT') ||
      defaultSystemPrompt(),
    // Groq — 3-key pool for round-robin routing
    groqTextApiKey: readString('GROQ_TEXT_API_KEY') || readString('GROQ_API_KEY'),
    groqTextApiKey2: readString('GROQ_TEXT_API_KEY_2') || readString('GROQ_API_KEY_2'),
    groqTextApiKey3: readString('GROQ_TEXT_API_KEY_3') || readString('GROQ_API_KEY_3'),
    groqTextModel: readString('GROQ_TEXT_MODEL') || 'llama-3.3-70b-versatile',
    groqVisionApiKey: readString('GROQ_VISION_API_KEY') || readString('GROQ_API_KEY'),
    groqVisionModel: readString('GROQ_VISION_MODEL') || 'meta-llama/llama-4-scout-17b-16e-instruct',
    groqTtsApiKey: readString('GROQ_TTS_API_KEY') || readString('GROQ_API_KEY'),
    groqTtsModel: readString('GROQ_TTS_MODEL') || 'canopylabs/orpheus-v1-english',
    groqTtsVoice: readString('GROQ_TTS_VOICE') || 'hannah',
    groqTtsResponseFormat: 'wav',
    groqSttApiKey: readString('GROQ_STT_API_KEY') || readString('GROQ_API_KEY'),
    groqSttModel: readString('GROQ_STT_MODEL') || 'whisper-large-v3-turbo',
    // Gemini — 3-key pool
    geminiApiKey: readString('GEMINI_API_KEY') || readString('GOOGLE_GEMINI_API_KEY'),
    geminiApiKey2: readString('GEMINI_API_KEY_2') || readString('GOOGLE_GEMINI_API_KEY_2'),
    geminiApiKey3: readString('GEMINI_API_KEY_3') || readString('GOOGLE_GEMINI_API_KEY_3'),
    geminiModel: readString('GEMINI_MODEL') || 'gemini-2.5-flash',
    geminiTtsProvider: readTtsProvider('GEMINI_TTS_PROVIDER', 'groq'),
    // OpenRouter — 3-key pool
    openRouterApiKey: readString('OPENROUTER_API_KEY'),
    openRouterApiKey2: readString('OPENROUTER_API_KEY_2'),
    openRouterApiKey3: readString('OPENROUTER_API_KEY_3'),
    openRouterModel: readString('OPENROUTER_MODEL') || 'openrouter/free',
    openRouterHttpReferer: readString('OPENROUTER_HTTP_REFERER') || 'http://localhost:5173',
    openRouterAppTitle: readString('OPENROUTER_APP_TITLE') || 'Linus Desktop Agent',
    openRouterTtsProvider: readTtsProvider('OPENROUTER_TTS_PROVIDER', 'groq'),
    serperApiKey: readString('SERPER_API_KEY'),
    googleCustomSearchApiKey: readString('GOOGLE_CUSTOM_SEARCH_API_KEY'),
    googleCustomSearchCx: readString('GOOGLE_CUSTOM_SEARCH_CX'),
    lla5Model: readString('LLA5_MODEL') || 'openai-large',
    ollamaBaseUrl: readString('OLLAMA_BASE_URL') || 'http://127.0.0.1:11434',
    ollamaModel: readString('OLLAMA_MODEL'),
    ollamaTtsProvider: readTtsProvider('OLLAMA_TTS_PROVIDER', 'groq'),
    pollinationsImageModel: readString('POLLINATIONS_IMAGE_MODEL') || 'flux',
    geminiImageModel: readString('GEMINI_IMAGE_MODEL') || 'imagen-4.0-fast-generate-001',
    windowsTtsVoice: readString('WINDOWS_TTS_VOICE') || 'Microsoft Zira Desktop',
    windowsTtsRate: readNumber('WINDOWS_TTS_RATE', 0),
    windowsTtsVolume: readNumber('WINDOWS_TTS_VOLUME', 90)
  };
}

function readString(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function readBoolean(key: string, fallback: boolean): boolean {
  const value = readString(key).toLowerCase();
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value);
}

function readNumber(key: string, fallback: number): number {
  const value = Number(readString(key));
  return Number.isFinite(value) ? value : fallback;
}

function readProvider(key: string, fallback: ProviderId): ProviderId {
  const value = readString(key) as ProviderId;
  return providerIds.includes(value) ? value : fallback;
}

function readTtsProvider(key: string, fallback: TtsProviderChoice): TtsProviderChoice {
  const value = readString(key) as TtsProviderChoice;
  return ttsProviderChoices.includes(value) ? value : fallback;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function defaultSystemPrompt(): string {
  return [
    'You are Linus, a Windows desktop AI agent created by Shapes.',
    'You are not a chatbot in a window; you are a command surface for the user\'s computer.',
    'Operate like a serious desktop operator for daily life, study, coding, research, files, browser work, documents, vision, voice, and Windows automation.',
    'Be concise, calm, technically accurate, practical, and action-oriented.',
    'Use tools when they are available and useful. Never claim a local action, browser action, file change, screenshot, or memory update happened unless the app reports a verified tool result.',
    'If a request needs an unimplemented or unsafe capability, say that clearly and suggest the nearest supported action.',
    'Protect privacy and security. Do not expose secrets, API keys, passwords, or private credentials.',
    'When planning, choose the smallest reliable set of steps and verify the result before saying it is done.',
    'The user wants to become a mechatronic engineer, is about to enter Bowen University, loves coding, building, and practical automation.'
  ].join(' ');
}
