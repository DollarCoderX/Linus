import type { ProviderId } from '../../shared/linus';
import type { AiProvider, ChatRequest, ChatResponse } from '../providers/types';

export type RoutingPreference = 'auto' | 'fast' | 'smart' | 'local' | 'private';

export interface RouteRequest extends ChatRequest {
  preference: RoutingPreference;
  selectedProvider?: ProviderId;
  requires?: {
    vision?: boolean;
    toolCalling?: boolean;
    localOnly?: boolean;
  };
}

export class AiRouter {
  private readonly providers = new Map<ProviderId, AiProvider>();

  register(provider: AiProvider): void {
    this.providers.set(provider.id, provider);
  }

  async route(request: RouteRequest): Promise<ChatResponse> {
    const candidates = this.candidateProviders(request);

    for (const provider of candidates) {
      if (await provider.isAvailable()) {
        return provider.chat(request);
      }
    }

    throw new Error('No configured provider is available. Add an API key or OLLAMA_MODEL to .env.');
  }

  private candidateProviders(request: RouteRequest): AiProvider[] {
    if (request.selectedProvider && request.selectedProvider !== 'auto' && request.selectedProvider !== 'pollinations') {
      return this.pick([request.selectedProvider]);
    }

    if (request.requires?.localOnly || request.preference === 'private' || request.preference === 'local') {
      return this.pick(['ollama']);
    }

    if (request.preference !== 'auto') {
      return this.pick([preferenceToProvider(request.preference), 'groq', 'openrouter', 'gemini', 'ollama', 'lla5']);
    }

    return this.pick(['groq', 'openrouter', 'gemini', 'ollama', 'lla5']);
  }

  private pick(ids: ProviderId[]): AiProvider[] {
    const providers: AiProvider[] = [];
    const seen = new Set<ProviderId>();

    for (const id of ids) {
      if (seen.has(id)) {
        continue;
      }

      const provider = this.providers.get(id);
      if (provider) {
        providers.push(provider);
        seen.add(id);
      }
    }

    return providers;
  }
}

function preferenceToProvider(preference: RoutingPreference): ProviderId {
  if (preference === 'smart') {
    return 'gemini';
  }

  if (preference === 'fast') {
    return 'groq';
  }

  return 'auto';
}
