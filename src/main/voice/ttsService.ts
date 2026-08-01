import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderId } from '../../shared/linus';
import type { LinusEnv, TtsProviderChoice } from '../config/env';

// Maximum characters Groq TTS can handle per request
const GROQ_TTS_MAX_CHARS = 4000;
// Maximum characters for a single Windows TTS call
const WINDOWS_TTS_MAX_CHARS = 8000;

export class TtsService {
  constructor(
    private readonly env: LinusEnv,
    private readonly cacheRoot: string
  ) {}

  async speak(text: string, provider: ProviderId): Promise<void> {
    this.stop();
    if (!this.env.speakResponses) {
      return;
    }

    const choice = this.resolveProvider(provider);
    if (choice === 'off') {
      return;
    }

    if (choice === 'groq' && this.env.groqTtsApiKey) {
      try {
        await this.speakWithGroq(text);
        return;
      } catch (error) {
        console.warn(
          '[Linus TTS] Groq TTS failed; falling back to Windows TTS:',
          error instanceof Error ? error.message : error
        );
        try {
          await this.speakWithWindows(text);
          return;
        } catch (fallbackError) {
          console.error(
            '[Linus TTS] Windows TTS fallback also failed:',
            fallbackError instanceof Error ? fallbackError.message : fallbackError
          );
          return;
        }
      }
    }

    try {
      await this.speakWithWindows(text);
    } catch (error) {
      console.error(
        '[Linus TTS] Windows TTS failed:',
        error instanceof Error ? error.message : error
      );
    }
  }

  private resolveProvider(provider: ProviderId): TtsProviderChoice {
    if (provider === 'gemini') {
      return this.normalizeAuto(this.env.geminiTtsProvider);
    }

    if (provider === 'openrouter') {
      return this.normalizeAuto(this.env.openRouterTtsProvider);
    }

    if (provider === 'ollama') {
      return this.normalizeAuto(this.env.ollamaTtsProvider);
    }

    return this.env.groqTtsApiKey ? 'groq' : 'windows';
  }

  private normalizeAuto(choice: TtsProviderChoice): TtsProviderChoice {
    if (choice !== 'auto') {
      return choice;
    }

    return this.env.groqTtsApiKey ? 'groq' : 'windows';
  }

  private async speakWithGroq(text: string): Promise<void> {
    // Clean the text but do NOT truncate to 200 chars — that caused half-speech cutoff
    const chunks = buildGroqSpeechChunks(text);
    if (chunks.length === 0) {
      return;
    }

    const voices = Array.from(new Set([this.env.groqTtsVoice, 'troy', 'hannah', 'austin'].filter(Boolean)));

    for (const chunk of chunks) {
      // Stop if speech was cancelled between chunks
      if (!activeSpeechAllowed) {
        return;
      }

      let lastError: string | null = null;
      let succeeded = false;

      for (const voice of voices) {
        const requestBody = {
          model: this.env.groqTtsModel,
          voice,
          input: chunk,
          response_format: this.env.groqTtsResponseFormat
        };
        console.info(
          `[Linus TTS] Groq TTS chunk (${chunk.length} chars): model=${requestBody.model}, voice=${voice}`
        );
        const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.groqTtsApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          const errorMsg = detail
            ? `Groq TTS failed for voice ${voice} with HTTP ${response.status}: ${detail}`
            : `Groq TTS failed for voice ${voice} with HTTP ${response.status}.`;
          console.warn(`[Linus TTS] ${errorMsg}`);
          lastError = errorMsg;
          continue;
        }

        const audio = Buffer.from(await response.arrayBuffer());
        const directory = join(this.cacheRoot, 'System', 'Cache', 'Voice');
        mkdirSync(directory, { recursive: true });
        const audioPath = join(directory, `linus-${Date.now()}.wav`);
        writeFileSync(audioPath, audio);
        await playAudioFile(audioPath);
        succeeded = true;
        break;
      }

      if (!succeeded) {
        throw new Error(lastError ?? 'Groq TTS failed for all configured voices.');
      }
    }
  }

  private async speakWithWindows(text: string): Promise<void> {
    const input = text.replace(/\s+/g, ' ').trim().slice(0, WINDOWS_TTS_MAX_CHARS);
    if (!input) {
      return;
    }

    const preferredVoice = escapePowerShell(this.env.windowsTtsVoice || 'Microsoft Zira Desktop');

    await runPowerShell(`
      try {
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $preferred = '${preferredVoice}';
        $voice = $synth.GetInstalledVoices() |
          ForEach-Object { $_.VoiceInfo.Name } |
          Where-Object { $_ -eq $preferred -or $_ -like "*$preferred*" } |
          Select-Object -First 1;
        if (-not $voice) {
          $voice = $synth.GetInstalledVoices() |
            ForEach-Object { $_.VoiceInfo.Name } |
            Where-Object { $_ -like '*Zira*' } |
            Select-Object -First 1;
        }
        if ($voice) {
          $synth.SelectVoice($voice);
        } else {
          $availableVoices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name };
          Write-Warning "No preferred voice found. Available voices: $($availableVoices -join ', ')";
        }
        $synth.Rate = ${this.env.windowsTtsRate};
        $synth.Volume = ${Math.max(0, Math.min(100, this.env.windowsTtsVolume))};
        $synth.Speak('${escapePowerShell(input)}');
        $synth.Dispose();
      } catch {
        $availableVoices = try { (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name } } catch { @() };
        Write-Error "Windows TTS failed. Available voices: $($availableVoices -join ', ')";
        exit 1;
      }
    `);
  }

  stop(): void {
    stopActiveSpeechProcess();
  }
}

let activeSpeechProcess: ChildProcess | null = null;
let activeSpeechAllowed = true;
const interruptedSpeechProcesses = new WeakSet<ChildProcess>();

function stopActiveSpeechProcess(): void {
  activeSpeechAllowed = false;
  if (activeSpeechProcess && !activeSpeechProcess.killed) {
    interruptedSpeechProcesses.add(activeSpeechProcess);
    activeSpeechProcess.kill();
  }
  activeSpeechProcess = null;
  // Re-allow speech for next invocation after a short tick
  setTimeout(() => { activeSpeechAllowed = true; }, 50);
}

function runPowerShell(script: string): Promise<void> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        windowsHide: true,
        stdio: 'ignore'
      }
    );

    activeSpeechProcess = child;
    child.on('error', reject);
    child.on('exit', (code) => {
      if (activeSpeechProcess === child) {
        activeSpeechProcess = null;
      }

      if (code === 0 || interruptedSpeechProcesses.has(child)) {
        resolve();
        return;
      }

      reject(new Error(`Windows speech exited with code ${code ?? 'unknown'}.`));
    });
  });
}

async function playAudioFile(audioPath: string): Promise<void> {
  const escapedPath = escapePowerShell(audioPath);
  // Use a robust dispatcher loop to wait for audio completion
  // Increase timeout to 300s to handle long responses
  await runPowerShell(`
    try {
      Add-Type -AssemblyName PresentationCore;
      $player = New-Object System.Windows.Media.MediaPlayer;
      $script:done = $false;
      $script:failed = $false;
      $player.add_MediaEnded({ $script:done = $true });
      $player.add_MediaFailed({ param($s,$e); $script:failed = $true; $script:done = $true });
      $uri = New-Object System.Uri('${escapedPath}');
      $player.Open($uri);
      # Wait for media to be opened and natural duration to become available
      $openDeadline = (Get-Date).AddSeconds(10);
      while ($player.NaturalDuration.HasTimeSpan -eq $false -and (Get-Date) -lt $openDeadline) {
        Start-Sleep -Milliseconds 50;
      }
      $player.Play();
      # Calculate expected duration in seconds + 5s buffer, capped at 300s
      $expectedDuration = 15;
      if ($player.NaturalDuration.HasTimeSpan) {
        $expectedDuration = [Math]::Min(300, [Math]::Ceiling($player.NaturalDuration.TimeSpan.TotalSeconds) + 5);
      }
      $limit = (Get-Date).AddSeconds($expectedDuration);
      while (-not $script:done -and (Get-Date) -lt $limit) {
        Start-Sleep -Milliseconds 80;
      }
      $player.Stop();
      $player.Close();
      if ($script:failed) {
        throw "MediaPlayer reported MediaFailed.";
      }
    } catch {
      Write-Error "Could not play generated Groq audio: $($_.Exception.Message)";
      exit 1;
    }
  `);
}

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Split text into chunks ≤ GROQ_TTS_MAX_CHARS, breaking on sentence boundaries.
 * This replaces the old 200-char truncation that caused speech to cut off halfway.
 */
function buildGroqSpeechChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return [];
  }

  if (clean.length <= GROQ_TTS_MAX_CHARS) {
    return [clean];
  }

  // Split on sentence endings, then reassemble into chunks
  const sentences = clean.match(/[^.!?\n]+[.!?\n]*/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > GROQ_TTS_MAX_CHARS) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      // If a single sentence is longer than max, hard-split it
      if (sentence.length > GROQ_TTS_MAX_CHARS) {
        const words = sentence.split(' ');
        for (const word of words) {
          if (current.length + word.length + 1 > GROQ_TTS_MAX_CHARS) {
            if (current) chunks.push(current.trim());
            current = word;
          } else {
            current = current ? `${current} ${word}` : word;
          }
        }
      } else {
        current = sentence;
      }
    } else {
      current = current ? `${current}${sentence}` : sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
