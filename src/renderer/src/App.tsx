import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CircleSlash,
  Loader2,
  Mic,
  Plus,
  SendHorizontal,
  Square,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActivityStep,
  LinusAppState,
  LinusAttachment,
  LinusTaskPreview,
  LinusUiState,
  ProviderId,
  ProviderOption,
  SkillOption
} from '../../shared/linus';

const statusByState: Record<LinusUiState, string> = {
  idle: '',
  hover: '',
  focused: '',
  thinking: 'Thinking...',
  tool: 'Working...',
  listening: 'Listening...',
  speaking: 'Speaking...',
  success: 'Done',
  error: 'Something went wrong'
};

const fallbackState: LinusAppState = {
  mode: 'input',
  uiState: 'idle',
  selectedProvider: 'auto',
  activeSkill: 'assistant',
  theme: 'mist',
  hotkey: 'CommandOrControl+Space',
  appDataPath: '',
  providers: [],
  skills: [],
  sidebarPanel: '',
  sidebarOpen: false,
  rightSidebarOpen: false
};

const commandItems = [
  {
    id: 'skills',
    label: 'Pick Skill',
    detail: 'Switch Linus mode for this period'
  },
  {
    id: 'dark',
    label: 'Dark Theme',
    detail: 'Switch to the darker glass style'
  },
  {
    id: 'light',
    label: 'Light Theme',
    detail: 'Switch to the soft mist style'
  },
  {
    id: 'settings',
    label: 'Settings',
    detail: 'Provider, voice, memory, app data'
  },
  {
    id: 'voice',
    label: 'Voice',
    detail: 'Zira-first Windows speech fallback'
  },
  {
    id: 'providers',
    label: 'Providers',
    detail: 'Groq, Gemini, OpenRouter, Ollama'
  }
];

export function App(): JSX.Element {
  const [appState, setAppState] = useState<LinusAppState>(fallbackState);
  const [prompt, setPrompt] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [taskPreview, setTaskPreview] = useState<LinusTaskPreview | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Thinking...');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [attachments, setAttachments] = useState<LinusAttachment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    window.linus.getState().then(setAppState);

    const handleState = (event: Event): void => {
      setAppState((event as CustomEvent<LinusAppState>).detail);
    };
    const handleFocus = (): void => {
      inputRef.current?.focus();
    };
    const handleSpeechError = (event: Event): void => {
      setSpeechError((event as CustomEvent<string>).detail);
    };

    window.addEventListener('linus-state-changed', handleState);
    window.addEventListener('linus-focus-input', handleFocus);
    window.addEventListener('linus-speech-error', handleSpeechError);

    return () => {
      window.removeEventListener('linus-state-changed', handleState);
      window.removeEventListener('linus-focus-input', handleFocus);
      window.removeEventListener('linus-speech-error', handleSpeechError);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (appState.mode === 'input') {
          window.linus.setWindowMode('orb').catch(() => undefined);
        } else {
          window.linus.close().catch(() => undefined);
        }
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setTaskPreview(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState.mode]);

  useEffect(() => {
    const expanded = selectorOpen || prompt.trim().startsWith('/') || Boolean(taskPreview?.responseText || taskPreview?.error || taskPreview?.imageUrl);
    window.linus.setSurfaceExpanded(expanded).catch(() => undefined);
  }, [selectorOpen, prompt, taskPreview]);

  useEffect(() => {
    if (appState.uiState !== 'thinking') {
      setThinkingStatus('Thinking...');
      return;
    }

    setThinkingStatus('Thinking...');
    const firstTimer = window.setTimeout(() => setThinkingStatus('Finding solution'), 7000);
    const secondTimer = window.setTimeout(() => setThinkingStatus('Talking to dinosaurs'), 14000);
    const thirdTimer = window.setTimeout(() => setThinkingStatus('Bribing Shapes...'), 21000);
    const fourthTimer = window.setTimeout(() => setThinkingStatus('Considering...'), 28000);
    const fifthTimer = window.setTimeout(() => setThinkingStatus('Presenting coffee to the server...'), 35000);

    return () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
      window.clearTimeout(thirdTimer);
      window.clearTimeout(fourthTimer);
      window.clearTimeout(fifthTimer);
    };
  }, [appState.uiState]);

  function expandSurface(): void {
    window.linus.setSurfaceExpanded(true).catch(() => undefined);
  }

  function collapseSurface(): void {
    window.linus.setSurfaceExpanded(false).catch(() => undefined);
  }

  const selectedProvider = useMemo(
    () => appState.providers.find((provider) => provider.id === appState.selectedProvider),
    [appState.providers, appState.selectedProvider]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (prompt.trim().startsWith('/') && attachments.length === 0) {
      await handleSlashSubmit(prompt.trim());
      return;
    }

    setTaskPreview(null);
    setSpeechError(null);
    const preview = await window.linus.submitPrompt(prompt, attachments);
    setTaskPreview(preview);
    setAttachments([]);
  }
  

  async function selectCommand(command: (typeof commandItems)[number]): Promise<void> {
    if (command.id === 'dark' || command.id === 'light') {
      const nextState = await window.linus.setTheme(command.id === 'dark' ? 'dark' : 'mist');
      setAppState(nextState);
      setPrompt('');
      return;
    }

    if (command.id === 'providers') {
      expandSurface();
      setSelectorOpen(true);
      setPrompt('');
      return;
    }

    if (command.id === 'skills') {
      expandSurface();
      setPrompt('/skill ');
      return;
    }

    setTaskPreview({
      statusText: command.label,
      responseText: command.id === 'settings'
        ? `Linus settings are active. Provider: ${selectedProvider?.name ?? 'Auto'}. Skill: ${activeSkillName(appState)}. Theme: ${appState.theme}. Memory folder: ${appState.appDataPath}`
        : 'Voice uses Groq TTS when configured, then Windows TTS. Windows voice preference is Microsoft Zira when available.',
      providerName: 'Linus',
      model: `/${command.id}`,
      kind: 'tool',
      steps: [
        { id: 'open', label: `Opened ${command.label}`, status: 'done' },
        { id: 'ready', label: 'Ready for your next move', status: 'done' }
      ]
    });
    setPrompt('');
  }

  const slashOpen = prompt.trim().startsWith('/');
  const skillOpen = /^\/skill\s*/i.test(prompt.trim());

  async function chooseProvider(provider: ProviderOption): Promise<void> {
    setSelectorOpen(false);
    const nextState = await window.linus.setSelectedProvider(provider.id);
    setAppState(nextState);
  }

  async function chooseSkill(skill: SkillOption): Promise<void> {
    const nextState = await window.linus.setActiveSkill(skill.id);
    setAppState(nextState);
    setPrompt('');
    setTaskPreview({
      statusText: `${skill.name} selected`,
      responseText: `Linus is now using the ${skill.name} skill. ${skill.description}`,
      providerName: 'Linus',
      model: `/skill ${skill.id}`,
      kind: 'tool',
      steps: [
        { id: 'skill', label: `Selected ${skill.name}`, status: 'done' },
        { id: 'ready', label: 'Mode will be included in future prompts', status: 'done' }
      ]
    });
  }

  async function handleSlashSubmit(value: string): Promise<void> {
    if (/^\/dark$/i.test(value) || /^\/light$/i.test(value)) {
      const nextState = await window.linus.setTheme(/^\/dark$/i.test(value) ? 'dark' : 'mist');
      setAppState(nextState);
      setPrompt('');
      return;
    }
  }

  async function toggleRecording(): Promise<void> {
    if (recording) {
      stopRecording();
      return;
    }

    setSpeechError(null);
    setRecording(true);
    await window.linus.stopSpeech();
    await window.linus.setUiState('listening');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        await window.linus.setUiState('thinking');
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const text = await window.linus.transcribeAudio(await blob.arrayBuffer(), blob.type);
          setPrompt(text);
          inputRef.current?.focus();
        } catch (error) {
          setSpeechError(error instanceof Error ? error.message : 'Voice transcription failed.');
        } finally {
          await window.linus.setUiState('idle');
        }
      };

      recorder.start();
      silenceTimerRef.current = window.setTimeout(stopRecording, 5500);
    } catch (error) {
      setRecording(false);
      await window.linus.setUiState('idle');
      setSpeechError(error instanceof Error ? error.message : 'Microphone permission failed.');
    }
  }

  function stopRecording(): void {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  async function chooseAttachments(files: FileList | null): Promise<void> {
    if (!files?.length) {
      return;
    }

    const currentImages = attachments.filter((attachment) => attachment.mimeType.startsWith('image/')).length;
    const currentDocs = attachments.length - currentImages;
    const selected: File[] = [];

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const imageCount = selected.filter((item) => item.type.startsWith('image/')).length;
      const docCount = selected.length - imageCount;
      if (isImage && currentImages + imageCount < 7) {
        selected.push(file);
      }
      if (!isImage && currentDocs + docCount < 6) {
        selected.push(file);
      }
    }

    const nextAttachments = await Promise.all(selected.map(readAttachment));
    setAttachments((current) => [...current, ...nextAttachments].slice(0, 13));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeAttachment(index: number): void {
    setAttachments((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  if (appState.mode === 'orb') {
    return (
      <Orb
        state={appState.uiState}
        provider={selectedProvider}
        onExpand={() => window.linus.setWindowMode('input').then(setAppState)}
      />
    );
  }

  const workspaceMode = appState.mode === 'workspace';

  return (
    <main className={`linus-stage ${workspaceMode ? 'workspace-stage' : ''}`} data-theme={appState.theme}>
      <motion.section
        className="linus-stack drag-region"
        initial={{ opacity: 0, y: -8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <form
          className="linus-shell"
          data-state={isInputFocused ? 'focused' : appState.uiState}
          onSubmit={handleSubmit}
        >
          <button
            type="button"
            className="attach-button no-drag"
            title="Add images or documents"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={20} strokeWidth={2} />
          </button>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="image/*,.txt,.md,.markdown,.json,.jsonc,.csv,.tsv,.log,.pdf,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml,.toml,.ini,.env,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.rb,.sql"
            multiple
            onChange={(event) => chooseAttachments(event.currentTarget.files)}
          />
          <button
            type="button"
            className="skill-chip no-drag"
            title="Pick active skill"
            onClick={() => {
              expandSurface();
              setPrompt('/skill ');
            }}
          >
            {activeSkillName(appState)}
          </button>
          <button
            type="button"
            className="provider-button no-drag"
            title="Choose model provider"
            onClick={() => {
              expandSurface();
              setSelectorOpen((open) => !open);
            }}
          >
            <ProviderIcon providerId={selectedProvider?.id ?? 'auto'} />
          </button>

          <input
            ref={inputRef}
            className="linus-input no-drag"
            value={prompt}
            placeholder={attachments.length ? 'Ask about these files...' : 'Describe what you want...'}
            spellCheck={false}
            onChange={(event) => setPrompt(event.target.value)}
            onFocus={() => {
              setIsInputFocused(true);
              if (appState.uiState !== 'thinking' && appState.uiState !== 'speaking') {
                window.linus.setUiState('focused').catch(() => undefined);
              }
            }}
            onBlur={() => {
              setIsInputFocused(false);
              if (appState.uiState === 'focused') {
                window.linus.setUiState('idle').catch(() => undefined);
              }
            }}
          />

          <button
            type={appState.uiState === 'thinking' || appState.uiState === 'speaking' ? 'button' : 'submit'}
            className="send-button no-drag"
            title={appState.uiState === 'thinking' || appState.uiState === 'speaking' ? 'Stop' : 'Send'}
            disabled={!prompt.trim() && attachments.length === 0 && appState.uiState !== 'speaking'}
            onClick={() => {
              if (appState.uiState === 'thinking' || appState.uiState === 'speaking') {
                window.linus.stopSpeech();
                window.linus.setUiState('idle');
              }
            }}
          >
            {appState.uiState === 'thinking' || appState.uiState === 'speaking' ? (
              <Square size={15} fill="currentColor" strokeWidth={2} />
            ) : (
              <SendHorizontal size={17} strokeWidth={2} />
            )}
          </button>

          <button
            type="button"
            className="icon-button no-drag"
            title={recording ? 'Stop listening' : 'Speak to Linus'}
            onClick={toggleRecording}
          >
            {recording ? <Loader2 className="status-spin" size={18} /> : <Mic size={18} strokeWidth={1.9} />}
          </button>

          <button
            type="button"
            className="icon-button no-drag"
            title="Collapse Linus"
            onClick={() => {
              if (appState.mode === 'input') {
                window.linus.setWindowMode('orb').catch(() => undefined);
              } else {
        window.linus.setWindowMode('orb').catch(() => undefined);
              }
            }}
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </form>

        <AnimatePresence>
          {attachments.length > 0 ? (
            <motion.div
              className="attachment-strip no-drag"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {attachments.map((attachment, index) => (
                <button
                  type="button"
                  className="attachment-thumb"
                  data-kind={attachment.mimeType.startsWith('image/') ? 'image' : 'document'}
                  data-loading={appState.uiState === 'thinking' || appState.uiState === 'tool'}
                  key={`${attachment.name}-${index}`}
                  title={`Remove ${attachment.name}`}
                  onClick={() => removeAttachment(index)}
                >
                  {attachment.mimeType.startsWith('image/') ? (
                    <img src={attachment.dataUrl} alt={attachment.name} />
                  ) : (
                    <strong>{fileBadge(attachment.name)}</strong>
                  )}
                  <span>{index + 1}</span>
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {skillOpen || slashOpen || selectorOpen ? (
            <motion.button
              className="menu-dismiss no-drag"
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectorOpen(false);
                if (prompt.trim().startsWith('/')) {
                  setPrompt('');
                }
                collapseSurface();
              }}
            />
          ) : null}
          {skillOpen ? (
            <SkillPalette skills={appState.skills} activeSkill={appState.activeSkill} onSelect={chooseSkill} />
          ) : slashOpen ? (
            <CommandPalette onSelect={selectCommand} />
          ) : selectorOpen ? (
            <ProviderSelector
              selected={appState.selectedProvider}
              providers={appState.providers}
              onSelect={chooseProvider}
            />
          ) : null}
        </AnimatePresence>

        <StatusLine
          appState={appState}
          taskPreview={taskPreview}
          hasPrompt={prompt.trim().length > 0}
          thinkingStatus={thinkingStatus}
        />

        <AnimatePresence>
          {taskPreview?.responseText || taskPreview?.error || taskPreview?.imageUrl ? (
            <ResponsePanel preview={taskPreview} speechError={speechError} />
          ) : null}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}

function activeSkillName(appState: LinusAppState): string {
  return appState.skills.find((skill) => skill.id === appState.activeSkill)?.name ?? 'Assistant';
}

function Orb({
  state,
  provider,
  onExpand
}: {
  state: LinusUiState;
  provider?: ProviderOption;
  onExpand: () => void;
}): JSX.Element {
  return (
    <main className="orb-stage drag-region">
      <motion.button
        className="linus-orb drag"
        data-state={state}
        title="Open Linus"
        onClick={onExpand}
        onDoubleClick={onExpand}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <ProviderIcon providerId={provider?.id ?? 'auto'} />
      </motion.button>
    </main>
  );
}





function ProviderSelector({
  selected,
  providers,
  onSelect
}: {
  selected: ProviderId;
  providers: ProviderOption[];
  onSelect: (provider: ProviderOption) => void;
}): JSX.Element {
  return (
    <motion.div
      className="provider-menu no-drag"
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      {providers.map((provider) => (
        <button
          className="provider-option"
          type="button"
          key={provider.id}
          data-selected={provider.id === selected}
          onClick={() => onSelect(provider)}
        >
          <span className="provider-mark">
            <ProviderIcon providerId={provider.id} />
          </span>
          <span className="provider-copy">
            <span>{provider.name}</span>
            <small>{provider.model}</small>
          </span>
          <span className="provider-status" data-status={provider.status}>
            {provider.id === selected ? <Check size={14} /> : statusLabel(provider)}
          </span>
        </button>
      ))}
    </motion.div>
  );
}

function CommandPalette({
  onSelect
}: {
  onSelect: (command: (typeof commandItems)[number]) => void;
}): JSX.Element {
  return (
    <motion.div
      className="command-menu no-drag"
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      {commandItems.map((command) => (
        <button
          className="command-option"
          type="button"
          key={command.id}
          onClick={() => onSelect(command)}
        >
          <span className="command-slash">/{command.id}</span>
          <span>
            <strong>{command.label}</strong>
            <small>{command.detail}</small>
          </span>
        </button>
      ))}
    </motion.div>
  );
}

function SkillPalette({
  skills,
  activeSkill,
  onSelect
}: {
  skills: SkillOption[];
  activeSkill: string;
  onSelect: (skill: SkillOption) => void;
}): JSX.Element {
  return (
    <motion.div
      className="command-menu skill-menu no-drag"
      initial={{ opacity: 0, y: -4, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.99 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      {skills.map((skill) => (
        <button
          className="command-option"
          type="button"
          key={skill.id}
          data-selected={skill.id === activeSkill}
          onClick={() => onSelect(skill)}
        >
          <span className="command-slash">/{skill.id}</span>
          <span>
            <strong>{skill.name}</strong>
            <small>{skill.description}</small>
          </span>
        </button>
      ))}
    </motion.div>
  );
}

function StatusLine({
  appState,
  taskPreview,
  hasPrompt,
  thinkingStatus
}: {
  appState: LinusAppState;
  taskPreview: LinusTaskPreview | null;
  hasPrompt: boolean;
  thinkingStatus: string;
}): JSX.Element {
  const text = appState.uiState === 'thinking'
    ? thinkingStatus
    : statusByState[appState.uiState] || taskPreview?.statusText || 'AI can make mistakes.';
  const showActivity = taskPreview && (appState.uiState === 'thinking' || appState.uiState === 'success');

  return (
    <div className="status-row no-drag">
      <span className="status-text">
        {appState.uiState === 'thinking' ? <Loader2 className="status-spin" size={13} /> : null}
        {hasPrompt && appState.uiState === 'focused' ? 'Enter to send' : text}
      </span>
      <AnimatePresence>
        {showActivity && taskPreview ? <ActivityStrip steps={taskPreview.steps} /> : null}
      </AnimatePresence>
    </div>
  );
}

function ResponsePanel({
  preview,
  speechError
}: {
  preview: LinusTaskPreview;
  speechError: string | null;
}): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const mediaItems = preview.mediaItems ?? [];
  const selectedMedia = mediaItems[selectedIndex];
  const [artifactOpen, setArtifactOpen] = useState(Boolean(selectedMedia || preview.imageUrl));
  const artifactUrl = selectedMedia?.thumbnailUrl || selectedMedia?.url || preview.imageUrl;

  async function shareArtifact(): Promise<void> {
    const shareData = {
      title: selectedMedia?.title ?? 'Linus result',
      text: selectedMedia?.snippet ?? preview.responseText ?? '',
      url: selectedMedia?.url?.startsWith('http') ? selectedMedia.url : undefined
    };

    if (navigator.share && (shareData.url || shareData.text)) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }

    await navigator.clipboard?.writeText(selectedMedia?.url ?? preview.responseText ?? '').catch(() => undefined);
  }

  return (
    <motion.article
      className="response-panel no-drag"
      data-artifact={artifactOpen && artifactUrl ? 'true' : 'false'}
      data-kind={preview.kind ?? 'chat'}
      initial={{ opacity: 0, y: 8, scale: 0.985, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 6, scale: 0.985, filter: 'blur(4px)' }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="response-meta">
        <span>{preview.providerName ?? 'Linus'}</span>
        {preview.model ? <small>{preview.model}</small> : null}
      </div>
      {artifactOpen && artifactUrl ? (
        <div className="artifact-view">
          <div className="artifact-toolbar">
            <strong>{selectedMedia?.title ?? 'Generated image'}</strong>
            <span>
              <a href={selectedMedia?.url ?? preview.imageUrl} download title="Download">
                Download
              </a>
              <button type="button" onClick={shareArtifact}>Share</button>
              <button type="button" onClick={() => setArtifactOpen(false)}>X</button>
            </span>
          </div>
          {selectedMedia?.type === 'news' || selectedMedia?.type === 'video' || selectedMedia?.type === 'web' ? (
            <a className="artifact-link" href={selectedMedia.url} target="_blank" rel="noreferrer">
              {selectedMedia.thumbnailUrl ? <img src={selectedMedia.thumbnailUrl} alt="" /> : null}
              <span>{selectedMedia.snippet ?? selectedMedia.url}</span>
            </a>
          ) : (
            <img className="artifact-image" src={artifactUrl} alt={selectedMedia?.title ?? 'Linus artifact'} />
          )}
          {mediaItems.length > 1 ? (
            <div className="artifact-grid">
              {mediaItems.map((item, index) => (
                <button
                  type="button"
                  key={`${item.url}-${index}`}
                  data-selected={index === selectedIndex}
                  onClick={() => {
                    setSelectedIndex(index);
                    setArtifactOpen(true);
                  }}
                >
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span>{item.type}</span>}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <p className={preview.error ? 'response-error' : undefined}>
        {preview.error ?? preview.responseText}
      </p>
      {speechError ? <div className="speech-warning">Speech failed: {speechError}</div> : null}
    </motion.article>
  );
}

function ActivityStrip({ steps }: { steps: ActivityStep[] }): JSX.Element {
  return (
    <motion.div
      className="activity-strip"
      initial={{ opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -3 }}
      transition={{ duration: 0.16 }}
    >
      {steps.map((step) => (
        <span className="activity-dot" data-status={step.status} key={step.id} title={step.label} />
      ))}
    </motion.div>
  );
}

function ProviderIcon({ providerId }: { providerId: ProviderId }): JSX.Element {
  return <span className="provider-logo" data-provider={providerId}>{providerLogoText(providerId)}</span>;
}

function providerLogoText(providerId: ProviderId): string {
  if (providerId === 'groq') {
    return 'Groq';
  }

  if (providerId === 'gemini') {
    return 'Gemini';
  }

  if (providerId === 'openrouter') {
    return 'OR';
  }

  if (providerId === 'ollama') {
    return 'Ollama';
  }

  if (providerId === 'pollinations') {
    return 'Poll';
  }

  if (providerId === 'lla5') {
    return 'L5';
  }

  return 'A';
}

function readAttachment(file: File): Promise<LinusAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result)
      });
    };
    reader.readAsDataURL(file);
  });
}

function fileBadge(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? 'DOC' : name.slice(dot + 1, dot + 4).toUpperCase();
}

function statusLabel(provider: ProviderOption): JSX.Element | string {
  if (provider.status === 'needs-key') {
    return 'Key';
  }

  if (provider.status === 'offline') {
    return <CircleSlash size={13} />;
  }

  if (provider.status === 'needs-model') {
    return 'Model';
  }

  if (provider.status === 'todo') {
    return 'TODO';
  }

  return '';
}
