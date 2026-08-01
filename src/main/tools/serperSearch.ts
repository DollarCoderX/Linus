import type { LinusMediaItem } from '../../shared/linus';
import type { LinusEnv } from '../config/env';

export interface SerperIntent {
  type: 'images' | 'news' | 'videos' | 'web';
  query: string;
  count: number;
  label: string;
}

export interface SerperResult {
  providerName: string;
  model: string;
  message: string;
  items: LinusMediaItem[];
}

export function detectSerperIntent(prompt: string): SerperIntent | null {
  const text = prompt.trim();
  const match = text.match(
    /\b(?:search|find|show|get)\s+(?:me\s+)?(?:for\s+)?(?:(\d{1,2})\s+)?(images?|pictures?|photos?|news|videos?|youtube\s+videos?|web\s+results?|results)\s+(?:of|about|for|on)?\s+(.+)$/i
  );

  if (!match?.[3]) {
    return null;
  }

  const kind = normalizeKind(match[2]);
  const count = Math.max(1, Math.min(10, Number(match[1] ?? 2)));
  const query = match[3].trim().replace(/[.!?]+$/, '');

  return {
    type: kind,
    query,
    count,
    label: `Searching ${kind} for "${query}"`
  };
}

export function detectProviderSearchToolCall(content: string, originalPrompt: string): SerperIntent | null {
  if (!/<tool_call>\s*search\s*<\/tool_call>/i.test(content) && !/<tool_call>\s*search/i.test(content)) {
    return null;
  }

  const query =
    content.match(/<arg_key>query<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/i)?.[1]?.trim() ??
    content.match(/<arg_value>([\s\S]*?)<\/arg_value>/i)?.[1]?.trim();

  if (!query) {
    return null;
  }

  const hintedIntent = detectSerperIntent(originalPrompt);
  return {
    type: hintedIntent?.type ?? 'web',
    count: hintedIntent?.count ?? 2,
    query,
    label: `Searching ${hintedIntent?.type ?? 'web'} for "${query}"`
  };
}

export async function runSerperSearch(intent: SerperIntent, env: LinusEnv): Promise<SerperResult> {
  if (!env.serperApiKey) {
    throw new Error('Serper search needs SERPER_API_KEY in .env.');
  }

  const endpoint = `https://google.serper.dev/${endpointFor(intent.type)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': env.serperApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: intent.query,
      num: intent.count
    })
  });

  const data = (await response.json().catch(() => null)) as SerperPayload | null;
  if (!response.ok) {
    throw new Error(data?.message ?? `Serper returned HTTP ${response.status}.`);
  }

  const items = normalizeItems(intent.type, data).slice(0, intent.count);
  return {
    providerName: 'Serper',
    model: endpointFor(intent.type),
    message: `Found ${items.length} ${intent.type} result(s) for "${intent.query}".`,
    items
  };
}

function normalizeKind(value: string): SerperIntent['type'] {
  const lower = value.toLowerCase();
  if (/image|picture|photo/.test(lower)) {
    return 'images';
  }
  if (/video|youtube/.test(lower)) {
    return 'videos';
  }
  if (/news/.test(lower)) {
    return 'news';
  }
  return 'web';
}

function endpointFor(type: SerperIntent['type']): string {
  if (type === 'images') {
    return 'images';
  }
  if (type === 'videos') {
    return 'videos';
  }
  if (type === 'news') {
    return 'news';
  }
  return 'search';
}

function normalizeItems(type: SerperIntent['type'], data: SerperPayload | null): LinusMediaItem[] {
  if (type === 'images') {
    return (data?.images ?? []).map((item) => ({
      type: 'image',
      title: item.title ?? item.source ?? 'Image result',
      url: item.imageUrl ?? item.link ?? '',
      thumbnailUrl: item.thumbnailUrl ?? item.imageUrl,
      source: item.source,
      snippet: item.title
    }));
  }

  if (type === 'videos') {
    return (data?.videos ?? []).map((item) => ({
      type: 'video',
      title: item.title ?? 'Video result',
      url: item.link ?? '',
      thumbnailUrl: item.imageUrl,
      source: item.source,
      snippet: item.snippet
    }));
  }

  if (type === 'news') {
    return (data?.news ?? []).map((item) => ({
      type: 'news',
      title: item.title ?? 'News result',
      url: item.link ?? '',
      thumbnailUrl: item.imageUrl,
      source: item.source,
      snippet: item.snippet
    }));
  }

  return (data?.organic ?? []).map((item) => ({
    type: 'web',
    title: item.title ?? 'Web result',
    url: item.link ?? '',
    source: item.source,
    snippet: item.snippet
  }));
}

interface SerperPayload {
  message?: string;
  images?: Array<{
    title?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    link?: string;
    source?: string;
  }>;
  videos?: Array<{
    title?: string;
    link?: string;
    imageUrl?: string;
    source?: string;
    snippet?: string;
  }>;
  news?: Array<{
    title?: string;
    link?: string;
    imageUrl?: string;
    source?: string;
    snippet?: string;
  }>;
  organic?: Array<{
    title?: string;
    link?: string;
    source?: string;
    snippet?: string;
  }>;
}
