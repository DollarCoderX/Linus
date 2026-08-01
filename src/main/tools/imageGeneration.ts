import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LinusEnv } from '../config/env';

export interface ImageIntent {
  prompt: string;
  provider: 'pollinations' | 'gemini' | 'auto';
  label: string;
}

export interface ImageGenerationResult {
  providerName: string;
  model: string;
  prompt: string;
  message: string;
  url?: string;
  dataUrl?: string;
  filePath?: string;
}

export function detectImageIntent(prompt: string): ImageIntent | null {
  const text = prompt.trim();
  const provider = /\bgemini\b/i.test(text)
    ? 'gemini'
    : /\bpollinations?\b/i.test(text)
      ? 'pollinations'
      : 'auto';

  const match =
    text.match(/\b(?:generate|create|make|draw)\s+(?:an?\s+)?image\s+(?:of|about|showing)?\s*(.+)$/i) ??
    text.match(/\bimage\s+generation\s+(?:of|for)?\s*(.+)$/i);

  if (!match?.[1]) {
    return null;
  }

  return {
    prompt: cleanupImagePrompt(match[1]),
    provider,
    label: 'Generating image'
  };
}

export async function generateImage(
  intent: ImageIntent,
  env: LinusEnv,
  appDataRoot: string
): Promise<ImageGenerationResult> {
  const provider = intent.provider === 'auto' ? chooseImageProvider(intent.prompt, env) : intent.provider;
  if (provider === 'gemini' && env.geminiApiKey) {
    try {
      return await generateWithGemini(intent.prompt, env, appDataRoot);
    } catch (error) {
      const fallback = await generateWithPollinations(intent.prompt, env);
      fallback.message = `${fallback.message}\n\nGemini image generation failed, so Linus used Pollinations instead: ${
        error instanceof Error ? error.message : 'Unknown Gemini error'
      }`;
      return fallback;
    }
  }

  return generateWithPollinations(intent.prompt, env);
}

async function generateWithPollinations(prompt: string, env: LinusEnv): Promise<ImageGenerationResult> {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set('model', env.pollinationsImageModel);
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('enhance', 'true');

  return {
    providerName: 'Pollinations',
    model: env.pollinationsImageModel,
    prompt,
    url: url.toString(),
    message: `Generated an in-app image with Pollinations. Prompt: ${prompt}`
  };
}

async function generateWithGemini(
  prompt: string,
  env: LinusEnv,
  appDataRoot: string
): Promise<ImageGenerationResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.geminiImageModel
  )}:predict?key=${encodeURIComponent(env.geminiApiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 }
    })
  });

  const payload = (await response.json().catch(() => null)) as GeminiImageResponse | null;
  if (!response.ok) {
    throw new Error(extractGeminiError(payload) || `Gemini returned HTTP ${response.status}`);
  }

  const imageBase64 =
    payload?.predictions?.[0]?.bytesBase64Encoded ??
    payload?.predictions?.[0]?.image?.bytesBase64Encoded;

  if (!imageBase64) {
    throw new Error('Gemini did not return image bytes.');
  }

  const imageDir = join(appDataRoot, 'System', 'Exports', 'Images');
  mkdirSync(imageDir, { recursive: true });
  const filePath = join(imageDir, `linus-image-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  writeFileSync(filePath, Buffer.from(imageBase64, 'base64'));

  return {
    providerName: 'Gemini',
    model: env.geminiImageModel,
    prompt,
    dataUrl: `data:image/png;base64,${imageBase64}`,
    filePath,
    message: `Generated an in-app image with Gemini: ${filePath}`
  };
}

function chooseImageProvider(prompt: string, env: LinusEnv): ImageIntent['provider'] {
  const heavyPrompt =
    /\b(?:ultra|highly detailed|cinematic|photorealistic|realistic|8k|complex|detailed|professional|concept art|blueprint|render|mecha|engineering)\b/i.test(
      prompt
    );

  if (heavyPrompt && env.geminiApiKey) {
    return 'gemini';
  }

  return 'pollinations';
}

function cleanupImagePrompt(value: string): string {
  return value
    .replace(/\b(?:using|with)\s+(?:pollinations?|gemini)\b/gi, '')
    .trim();
}

function extractGeminiError(payload: GeminiImageResponse | null): string {
  return payload?.error?.message ?? '';
}

interface GeminiImageResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string;
    image?: {
      bytesBase64Encoded?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}
