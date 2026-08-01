import { contextBridge, ipcRenderer } from 'electron';
import type {
  LinusTheme,
  LinusBridge,
  LinusAttachment,
  LinusUiState,
  LinusWindowMode,
  ProviderId,
  SkillId
} from '../shared/linus';

const bridge: LinusBridge = {
  getState: () => ipcRenderer.invoke('linus:get-state'),
  setWindowMode: (mode: LinusWindowMode) => ipcRenderer.invoke('linus:set-window-mode', mode),
  setSelectedProvider: (provider: ProviderId) =>
    ipcRenderer.invoke('linus:set-selected-provider', provider),
  setActiveSkill: (skill: SkillId) => ipcRenderer.invoke('linus:set-active-skill', skill),
  setTheme: (theme: LinusTheme) => ipcRenderer.invoke('linus:set-theme', theme),
  setUiState: (state: LinusUiState) => ipcRenderer.invoke('linus:set-ui-state', state),
  setSurfaceExpanded: (expanded: boolean) => ipcRenderer.invoke('linus:set-surface-expanded', expanded),
  transcribeAudio: (audio: ArrayBuffer, mimeType: string) =>
    ipcRenderer.invoke('linus:transcribe-audio', audio, mimeType),
  stopSpeech: () => ipcRenderer.invoke('linus:stop-speech'),
  submitPrompt: (prompt: string, attachments?: LinusAttachment[]) =>
    ipcRenderer.invoke('linus:submit-prompt', prompt, attachments),
  close: () => ipcRenderer.invoke('linus:close'),
  focusInputReady: () => ipcRenderer.invoke('linus:focus-input-ready')
};

contextBridge.exposeInMainWorld('linus', bridge);

ipcRenderer.on('linus:state-changed', (_event, state) => {
  window.dispatchEvent(new CustomEvent('linus-state-changed', { detail: state }));
});

ipcRenderer.on('linus:focus-input', () => {
  window.dispatchEvent(new CustomEvent('linus-focus-input'));
});

ipcRenderer.on('linus:speech-error', (_event, message) => {
  window.dispatchEvent(new CustomEvent('linus-speech-error', { detail: message }));
});
