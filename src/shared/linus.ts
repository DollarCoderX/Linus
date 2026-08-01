export type LinusWindowMode = 'input' | 'orb';

export type LinusUiState =
  | 'idle'
  | 'hover'
  | 'focused'
  | 'thinking'
  | 'tool'
  | 'listening'
  | 'speaking'
  | 'success'
  | 'error';

export type ProviderId = 'auto' | 'groq' | 'gemini' | 'openrouter' | 'ollama' | 'pollinations' | 'lla5';
export type LinusTheme = 'mist' | 'dark';
export type SkillId = string;

export interface SkillOption {
  id: SkillId;
  name: string;
  description: string;
}

export interface ProviderOption {
  id: ProviderId;
  name: string;
  model: string;
  status: 'ready' | 'needs-key' | 'needs-model' | 'offline' | 'todo';
  locality: 'remote' | 'local' | 'mixed';
  capabilities: string[];
}

export interface LinusAppState {
  mode: LinusWindowMode;
  uiState: LinusUiState;
  selectedProvider: ProviderId;
  activeSkill: SkillId;
  theme: LinusTheme;
  hotkey: string;
  appDataPath: string;
  providers: ProviderOption[];
  skills: SkillOption[];
}

export interface ActivityStep {
  id: string;
  label: string;
  status: 'done' | 'active' | 'pending' | 'error';
}

export interface LinusTaskPreview {
  statusText: string;
  responseText?: string;
  imageUrl?: string;
  mediaItems?: LinusMediaItem[];
  providerName?: string;
  model?: string;
  error?: string;
  kind?: 'chat' | 'tool' | 'image';
  steps: ActivityStep[];
}

export interface LinusMediaItem {
  type: 'image' | 'news' | 'video' | 'web';
  title: string;
  url: string;
  thumbnailUrl?: string;
  source?: string;
  snippet?: string;
}

export interface LinusAttachment {
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface LinusBridge {
  getState: () => Promise<LinusAppState>;
  setWindowMode: (mode: LinusWindowMode) => Promise<LinusAppState>;
  setSelectedProvider: (provider: ProviderId) => Promise<LinusAppState>;
  setActiveSkill: (skill: SkillId) => Promise<LinusAppState>;
  setTheme: (theme: LinusTheme) => Promise<LinusAppState>;
  setUiState: (state: LinusUiState) => Promise<LinusAppState>;
  setSurfaceExpanded: (expanded: boolean) => Promise<LinusAppState>;
  transcribeAudio: (audio: ArrayBuffer, mimeType: string) => Promise<string>;
  stopSpeech: () => Promise<void>;
  submitPrompt: (prompt: string, attachments?: LinusAttachment[]) => Promise<LinusTaskPreview>;
  close: () => Promise<void>;
  focusInputReady: () => Promise<void>;
}
