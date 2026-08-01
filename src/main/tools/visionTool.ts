import { desktopCapturer, shell } from 'electron';
import type { LinusEnv } from '../config/env';

export interface VisionIntent {
  prompt: string;
  url?: string;
  label: string;
}

export interface VisionResult {
  providerName: string;
  model: string;
  analysis: string;
  openedUrl?: string;
}

export interface AttachedVisionImage {
  name: string;
  mimeType: string;
  dataUrl: string;
}

export function detectVisionIntent(prompt: string): VisionIntent | null {
  const text = prompt.trim();
  const wantsVision =
    /\b(?:screenshot|screen|background|what\s+(?:do\s+you\s+)?see|analy[sz]e\s+(?:this\s+)?(?:screen|page|screenshot))\b/i.test(
      text
    ) && /\b(?:see|look|analy[sz]e|tell\s+me|describe)\b/i.test(text);

  if (!wantsVision) {
    return null;
  }

  return {
    prompt: text,
    url: extractUrl(text),
    label: 'Capturing and analyzing the screen'
  };
}

export async function runVisionIntent(intent: VisionIntent, env: LinusEnv): Promise<VisionResult> {
  if (!env.groqVisionApiKey) {
    throw new Error('Groq vision needs GROQ_VISION_API_KEY in .env.');
  }

  if (intent.url) {
    await shell.openExternal(intent.url);
    await delay(2800);
  }

  const dataUrl = await capturePrimaryScreen();
  const analysis = await analyzeWithGroqVision(intent.prompt, dataUrl, env);

  return {
    providerName: 'Groq Vision',
    model: env.groqVisionModel,
    analysis,
    openedUrl: intent.url
  };
}

export async function analyzeAttachedImages(
  prompt: string,
  images: AttachedVisionImage[],
  env: LinusEnv
): Promise<VisionResult> {
  if (!env.groqVisionApiKey) {
    throw new Error('Groq vision needs GROQ_VISION_API_KEY in .env.');
  }

  if (images.length < 1) {
    throw new Error('No images were attached.');
  }

  const analysis = await analyzeImagesWithGroqVision(prompt, images.slice(0, 3), env);

  return {
    providerName: 'Groq Vision',
    model: env.groqVisionModel,
    analysis
  };
}

async function capturePrimaryScreen(): Promise<string> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1440, height: 900 }
  });

  const firstScreen = sources[0];
  if (!firstScreen || firstScreen.thumbnail.isEmpty()) {
    throw new Error('Could not capture the Windows screen.');
  }

  return firstScreen.thumbnail.toDataURL();
}

async function analyzeWithGroqVision(prompt: string, dataUrl: string, env: LinusEnv): Promise<string> {
  return analyzeImagesWithGroqVision(prompt, [{ name: 'screenshot', mimeType: 'image/png', dataUrl }], env);
}

async function analyzeImagesWithGroqVision(
  prompt: string,
  images: AttachedVisionImage[],
  env: LinusEnv
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.groqVisionApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.groqVisionModel,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are Linus vision. Analyze only the real attached image content. Be concise, specific, and honest. Do not invent visual details that are not visible.'
        },
        {
          role: 'user',
          content: buildVisionContent(prompt, images)
        }
      ]
    })
  });

  const payload = (await response.json().catch(() => null)) as GroqVisionResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Groq vision returned HTTP ${response.status}`);
  }

  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Groq vision returned an empty analysis.');
  }

  return content;
}

function buildVisionContent(prompt: string, images: AttachedVisionImage[]): VisionContentPart[] {
  return [
    {
      type: 'text',
      text: `${prompt || 'Describe these images clearly.'}\n\nAttached images: ${images
        .map((image, index) => `${index + 1}. ${image.name || 'image'}`)
        .join(', ')}`
    },
    ...images.map((image) => ({
      type: 'image_url' as const,
      image_url: { url: image.dataUrl }
    }))
  ];
}

function extractUrl(text: string): string | undefined {
  const match = text.match(/\bhttps?:\/\/[^\s]+/i);
  return match?.[0]?.replace(/[),.]+$/g, '');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface GroqVisionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

type VisionContentPart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      image_url: {
        url: string;
      };
    };
