import type { LinusEnv } from '../config/env';

export class SttService {
  constructor(private readonly env: LinusEnv) {}

  async transcribe(audioBytes: ArrayBuffer, mimeType: string): Promise<string> {
    if (!this.env.groqSttApiKey) {
      throw new Error('Groq speech-to-text needs GROQ_STT_API_KEY or GROQ_API_KEY in .env.');
    }
    

    const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
    const file = new File([audioBytes], `linus-voice.${extension}`, { type: mimeType || 'audio/webm' });
    const form = new FormData();
    form.set('model', this.env.groqSttModel);
    form.set('file', file);
    form.set('response_format', 'json');

    console.info(`[Linus STT] Requesting Groq transcription with ${this.env.groqSttModel}.`);
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.groqSttApiKey}`
      },
      body: form
    });

    const payload = (await response.json().catch(() => null)) as GroqTranscriptionResponse | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Groq STT returned HTTP ${response.status}.`);
    }

    const text = payload?.text?.trim();
    if (!text) {
      throw new Error('Groq STT returned empty text.');
    }

    return text;
  }
}

interface GroqTranscriptionResponse {
  text?: string;
  error?: {
    message?: string;
  };
}
