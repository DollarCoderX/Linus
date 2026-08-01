import type { ProviderId } from '../../shared/linus';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ProviderCapabilities {
  chat: boolean;
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  structuredOutput: boolean;
  textToSpeech: boolean;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
}

export interface ChatResponse {
  provider: ProviderId;
  providerName: string;
  model: string;
  content: string;
  verified: boolean;
}

export interface AiProvider {
  id: ProviderId;
  displayName: string;
  capabilities: ProviderCapabilities;
  isAvailable: () => Promise<boolean>;
  chat: (request: ChatRequest) => Promise<ChatResponse>;
}
