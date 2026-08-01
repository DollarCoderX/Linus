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
  skills: []
};

const commandItems = [
  { id: 'skills', label: 'Pick Skill', detail: 'Switch Linus mode for this period' },
  { id: 'dark', label: 'Dark Theme', detail: 'Switch to the darker glass style' },
  { id: 'light', label: 'Light Theme', detail: 'Switch to the soft mist style' },
  { id: 'settings', label: 'Settings', detail: 'Provider, voice, memory, app data' },
  { id: 'voice', label: 'Voice', detail: 'Zira-first Windows speech fallback' },
  { id: 'providers', label: 'Providers', detail: 'Groq, Gemini, OpenRouter, Ollama' }
];

// iOS spring config
const spring = { type: 'spring', stiffness: 400, damping: 30 };
const softSpring = { type: 'spring', stiffness: 280, damping: 26 };

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
    const expanded =
      selectorOpen ||
      prompt.trim().startsWith('/') ||
      attachments.length > 0 ||
      Boolean(taskPreview?.responseText || taskPreview?.error || taskPreview?.imageUrl);
    window.linus.setSurfaceExpanded(expanded).catch(() => undefined);
  }, [selectorOpen, prompt, taskPreview, attachments.length]);

  useEffect(() => {
    if (appState.uiState !== 'thinking') {
      setThinkingStatus('Thinking...');
      return;
    }
    setThinkingStatus('Thinking...');
    const t1 = window.setTimeout(() => setThinkingStatus('Planning...'), 7000);
    const t2 = window.setTimeout(() => setThinkingStatus('Using tools...'), 14000);
    const t3 = window.setTimeout(() => setThinkingStatus('Verifying...'), 21000);
    const t4 = window.setTimeout(() => setThinkingStatus('Preparing response...'), 28000);
    const t5 = window.setTimeout(() => setThinkingStatus('Still working...'), 35000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); window.clearTimeout(t4); window.clearTimeout(t5); };
  }, [appState.uiState]);

  function expandSurface(): void { window.linus.setSurfaceExpanded(true).catch(() => undefined); }
  function collapseSurface(): void { window.linus.setSurfaceExpanded(false).catch(() => undefined); }

  const selectedProvider = useMemo(
    () => appState.providers.find((p) => p.id === appState.selectedProvider),
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
    setPrompt('');
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
        ? `Linus settings active. Provider: ${selectedProvider?.name ?? 'Auto'}. Skill: ${activeSkillName(appState)}. Theme: ${appState.theme}. Memory: ${appState.appDataPath}`
        : 'Voice uses Groq TTS when configured, then Windows TTS. Windows preference is Microsoft Zira.',
      providerName: 'Linus',
      model: `/${command.id}`,
      kind: 'tool',
      steps: [
        { id: 'open', label: `Opened ${command.label}`, status: 'done' },
        { id: 'ready', label: 'Ready', status: 'done' }
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
        { id: 'ready', label: 'Mode active for future prompts', status: 'done' }
      ]
    });
  }

  async function handleSlashSubmit(value: string): Promise<void> {
    if (/^\/dark$/i.test(value) || /^\/light$/i.test(value)) {
      const nextState = await window.linus.setTheme(/^\/dark$/i.test(value) ? 'dark' : 'mist');
      setAppState(nextState);
      setPrompt('');
    }
  }

  async function toggleRecording(): Promise<void> {
    if (recording) { stopRecording(); return; }
    setSpeechError(null);
    setRecording(true);
    await window.linus.stopSpeech();
    await window.linus.setUiState('listening');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        await window.linus.setUiState('thinking');
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const text = await window.linus.transcribeAudio(await blob.arrayBuffer(), blob.type);
          setPrompt(text);
          inputRef.current?.focus();
        } catch (err) {
          setSpeechError(err instanceof Error ? err.message : 'Voice transcription failed.');
        } finally {
          await window.linus.setUiState('idle');
        }
      };
      recorder.start();
      silenceTimerRef.current = window.setTimeout(stopRecording, 5500);
    } catch (err) {
      setRecording(false);
      await window.linus.setUiState('idle');
      setSpeechError(err instanceof Error ? err.message : 'Microphone permission failed.');
    }
  }

  function stopRecording(): void {
    if (silenceTimerRef.current) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }

  async function chooseAttachments(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    const currentImages = attachments.filter((a) => a.mimeType.startsWith('image/')).length;
    const currentDocs = attachments.length - currentImages;
    const selected: File[] = [];
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const imageCount = selected.filter((i) => i.type.startsWith('image/')).length;
      const docCount = selected.length - imageCount;
      if (isImage && currentImages + imageCount < 7) selected.push(file);
      if (!isImage && currentDocs + docCount < 6) selected.push(file);
    }
    const next = await Promise.all(selected.map(readAttachment));
    setAttachments((cur) => [...cur, ...next].slice(0, 13));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(index: number): void {
    setAttachments((cur) => cur.filter((_, i) => i !== index));
  }

  const isBusy = appState.uiState === 'thinking' || appState.uiState === 'speaking';

  if (appState.mode === 'orb') {
    return (
      <Orb
        state={appState.uiState}
        provider={selectedProvider}
        onExpand={() => window.linus.setWindowMode('input').then(setAppState)}
      />
    );
  }

  return (
    <main className="linus-stage" data-theme={appState.theme}>
      <motion.section
        className="linus-stack drag-region"
        initial={{ opacity: 0, y: -10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={softSpring}
      >
        {/* Main input bar */}
        <form
          className="linus-shell"
          data-state={isInputFocused ? 'focused' : appState.uiState}
          onSubmit={handleSubmit}
        >
          {/* Attach */}
          <button
            type="button"
            className="attach-button no-drag"
            title="Attach files or images"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={18} strokeWidth={2.2} />
          </button>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="image/*,.txt,.md,.markdown,.json,.jsonc,.csv,.tsv,.log,.pdf,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml,.toml,.ini,.env,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.rb,.sql"
            multiple
            onChange={(e) => chooseAttachments(e.currentTarget.files)}
          />

          {/* Skill chip */}
          <button
            type="button"
            className="skill-chip no-drag"
            title="Switch skill"
            onClick={() => { expandSurface(); setPrompt('/skill '); }}
          >
            {activeSkillName(appState)}
          </button>

          {/* Provider logo button */}
          <button
            type="button"
            className="provider-button no-drag"
            title="Choose AI provider"
            onClick={() => { expandSurface(); setSelectorOpen((o) => !o); }}
          >
            <ProviderLogo providerId={selectedProvider?.id ?? 'auto'} size={22} />
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            className="linus-input no-drag"
            value={prompt}
            placeholder={attachments.length ? 'Ask about these files...' : 'Describe what you want...'}
            spellCheck={false}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => {
              setIsInputFocused(true);
              if (!isBusy) window.linus.setUiState('focused').catch(() => undefined);
            }}
            onBlur={() => {
              setIsInputFocused(false);
              if (appState.uiState === 'focused') window.linus.setUiState('idle').catch(() => undefined);
            }}
          />

          {/* Send / Stop */}
          <motion.button
            type={isBusy ? 'button' : 'submit'}
            className="send-button no-drag"
            title={isBusy ? 'Stop' : 'Send'}
            disabled={!prompt.trim() && attachments.length === 0 && !isBusy}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.1 }}
            onClick={() => {
              if (isBusy) {
                window.linus.stopSpeech();
                window.linus.setUiState('idle');
              }
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isBusy ? (
                <motion.span key="stop" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Square size={13} fill="currentColor" strokeWidth={0} />
                </motion.span>
              ) : (
                <motion.span key="send" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <SendHorizontal size={16} strokeWidth={2.1} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Mic */}
          <motion.button
            type="button"
            className={`icon-button no-drag${recording ? ' recording' : ''}`}
            title={recording ? 'Stop listening' : 'Speak to Linus'}
            whileTap={{ scale: 0.88 }}
            onClick={toggleRecording}
          >
            <AnimatePresence mode="wait" initial={false}>
              {recording ? (
                <motion.span key="rec" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }} transition={{ duration: 0.12 }}>
                  <Loader2 className="status-spin" size={17} />
                </motion.span>
              ) : (
                <motion.span key="mic" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }} transition={{ duration: 0.12 }}>
                  <Mic size={17} strokeWidth={2} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Close */}
          <motion.button
            type="button"
            className="icon-button no-drag"
            title="Minimize Linus"
            whileTap={{ scale: 0.88 }}
            onClick={() => window.linus.setWindowMode('orb').catch(() => undefined)}
          >
            <X size={18} strokeWidth={2} />
          </motion.button>
        </form>

        {/* Attachments */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              className="attachment-strip no-drag"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={softSpring}
            >
              {attachments.map((att, i) => (
                <motion.button
                  type="button"
                  className="attachment-thumb"
                  data-kind={att.mimeType.startsWith('image/') ? 'image' : 'document'}
                  data-loading={isBusy}
                  key={`${att.name}-${i}`}
                  title={`Remove ${att.name}`}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={spring}
                  onClick={() => removeAttachment(i)}
                >
                  {att.mimeType.startsWith('image/') ? (
                    <img src={att.dataUrl} alt={att.name} />
                  ) : (
                    <strong>{fileBadge(att.name)}</strong>
                  )}
                  <span>{i + 1}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dismiss overlay */}
        <AnimatePresence>
          {(skillOpen || slashOpen || selectorOpen) && (
            <motion.button
              className="menu-dismiss no-drag"
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectorOpen(false);
                if (prompt.trim().startsWith('/')) setPrompt('');
                collapseSurface();
              }}
            />
          )}
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

        {/* Status row */}
        <StatusLine
          appState={appState}
          taskPreview={taskPreview}
          hasPrompt={prompt.trim().length > 0}
          thinkingStatus={thinkingStatus}
        />

        {/* Response */}
        <AnimatePresence>
          {(taskPreview?.responseText || taskPreview?.error || taskPreview?.imageUrl) && (
            <ResponsePanel preview={taskPreview!} speechError={speechError} />
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}

function activeSkillName(appState: LinusAppState): string {
  return appState.skills.find((s) => s.id === appState.activeSkill)?.name ?? 'Assistant';
}

// ────────────────────────────────────────────────────────────────────────────
// Orb
// ────────────────────────────────────────────────────────────────────────────
function Orb({ state, provider, onExpand }: {
  state: LinusUiState;
  provider?: ProviderOption;
  onExpand: () => void;
}): JSX.Element {
  return (
    <main className="orb-stage drag-region">
      <motion.button
        className="linus-orb no-drag"
        data-state={state}
        title="Open Linus"
        onClick={onExpand}
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        transition={spring}
      >
        <ProviderLogo providerId={provider?.id ?? 'auto'} size={26} />
      </motion.button>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Provider Selector
// ────────────────────────────────────────────────────────────────────────────
function ProviderSelector({ selected, providers, onSelect }: {
  selected: ProviderId;
  providers: ProviderOption[];
  onSelect: (provider: ProviderOption) => void;
}): JSX.Element {
  return (
    <motion.div
      className="provider-menu no-drag"
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={softSpring}
    >
      {providers.map((provider) => (
        <motion.button
          className="provider-option"
          type="button"
          key={provider.id}
          data-selected={provider.id === selected}
          whileHover={{ x: 2 }}
          onClick={() => onSelect(provider)}
        >
          <span className="provider-mark">
            <ProviderLogo providerId={provider.id} size={24} />
          </span>
          <span className="provider-copy">
            <span>{provider.name}</span>
            <small>{provider.model}</small>
          </span>
          <span className="provider-status" data-status={provider.status}>
            {provider.id === selected ? <Check size={14} /> : statusLabel(provider)}
          </span>
        </motion.button>
      ))}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Command Palette
// ────────────────────────────────────────────────────────────────────────────
function CommandPalette({ onSelect }: {
  onSelect: (command: (typeof commandItems)[number]) => void;
}): JSX.Element {
  return (
    <motion.div
      className="command-menu no-drag"
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={softSpring}
    >
      {commandItems.map((command) => (
        <button className="command-option" type="button" key={command.id} onClick={() => onSelect(command)}>
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

// ────────────────────────────────────────────────────────────────────────────
// Skill Palette
// ────────────────────────────────────────────────────────────────────────────
function SkillPalette({ skills, activeSkill, onSelect }: {
  skills: SkillOption[];
  activeSkill: string;
  onSelect: (skill: SkillOption) => void;
}): JSX.Element {
  return (
    <motion.div
      className="command-menu skill-menu no-drag"
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={softSpring}
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

// ────────────────────────────────────────────────────────────────────────────
// Status Line
// ────────────────────────────────────────────────────────────────────────────
function StatusLine({ appState, taskPreview, hasPrompt, thinkingStatus }: {
  appState: LinusAppState;
  taskPreview: LinusTaskPreview | null;
  hasPrompt: boolean;
  thinkingStatus: string;
}): JSX.Element {
  const text = appState.uiState === 'thinking'
    ? thinkingStatus
    : statusByState[appState.uiState] || taskPreview?.statusText || '';
  const showActivity = taskPreview && (appState.uiState === 'thinking' || appState.uiState === 'success');

  return (
    <div className="status-row no-drag">
      <span className="status-text">
        {appState.uiState === 'thinking' && (
          <motion.span
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
            style={{ display: 'inline-flex' }}
          >
            <Loader2 size={12} />
          </motion.span>
        )}
        {hasPrompt && appState.uiState === 'focused' ? 'Enter to send' : text}
      </span>
      <AnimatePresence>
        {showActivity && taskPreview ? <ActivityStrip steps={taskPreview.steps} /> : null}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Response Panel
// ────────────────────────────────────────────────────────────────────────────
function ResponsePanel({ preview, speechError }: {
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
      initial={{ opacity: 0, y: 10, scale: 0.97, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 6, scale: 0.97, filter: 'blur(4px)' }}
      transition={softSpring}
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
              <a href={selectedMedia?.url ?? preview.imageUrl} download title="Download">Download</a>
              <button type="button" onClick={shareArtifact}>Share</button>
              <button type="button" onClick={() => setArtifactOpen(false)}>✕</button>
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
          {mediaItems.length > 1 && (
            <div className="artifact-grid">
              {mediaItems.map((item, i) => (
                <button
                  type="button"
                  key={`${item.url}-${i}`}
                  data-selected={i === selectedIndex}
                  onClick={() => { setSelectedIndex(i); setArtifactOpen(true); }}
                >
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span>{item.type}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <p className={preview.error ? 'response-error' : undefined}>
        {preview.error ?? preview.responseText}
      </p>
      {speechError ? <div className="speech-warning">⚠ Speech: {speechError}</div> : null}
    </motion.article>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Activity Strip
// ────────────────────────────────────────────────────────────────────────────
function ActivityStrip({ steps }: { steps: ActivityStep[] }): JSX.Element {
  return (
    <motion.div
      className="activity-strip"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={spring}
    >
      {steps.map((step) => (
        <motion.span
          className="activity-dot"
          data-status={step.status}
          key={step.id}
          title={step.label}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring}
        />
      ))}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Real Provider Logo SVGs
// ────────────────────────────────────────────────────────────────────────────
function ProviderLogo({ providerId, size = 22 }: { providerId: ProviderId; size?: number }): JSX.Element {
  return (
    <span className="provider-logo" data-provider={providerId} aria-label={providerId} style={{ width: size, height: size }}>
      <ProviderSvg providerId={providerId} size={size} />
    </span>
  );
}

function ProviderSvg({ providerId, size }: { providerId: ProviderId; size: number }): JSX.Element {
  const s = size * 0.62;
  switch (providerId) {
    case 'groq':
      // Groq lightning bolt
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M13 2L4.5 13.5H11.5L10 22L19.5 10.5H12.5L13 2Z" fill="white" />
        </svg>
      );
    case 'gemini':
      // Google Gemini star
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 2C12 2 13.8 8.2 20 12C13.8 15.8 12 22 12 22C12 22 10.2 15.8 4 12C10.2 8.2 12 2Z" fill="white" />
        </svg>
      );
    case 'openrouter':
      // OpenRouter stylised "OR" with two connected nodes
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="6" cy="12" r="3" fill="white" />
          <circle cx="18" cy="6" r="2.2" fill="rgba(255,255,255,0.75)" />
          <circle cx="18" cy="18" r="2.2" fill="rgba(255,255,255,0.75)" />
          <line x1="9" y1="10.5" x2="15.8" y2="7.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9" y1="13.5" x2="15.8" y2="16.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'ollama':
      // Ollama llama silhouette
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <ellipse cx="12" cy="17" rx="5" ry="4" fill="#374151" />
          <circle cx="12" cy="9" r="4.2" fill="#374151" />
          <ellipse cx="14.5" cy="6.5" rx="1.5" ry="2.5" fill="#374151" />
          <circle cx="10.8" cy="8.2" r="0.7" fill="white" />
        </svg>
      );
    case 'pollinations':
      // Pollinations flower
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="2.5" fill="white" />
          <ellipse cx="12" cy="6" rx="2" ry="3.5" fill="rgba(255,255,255,0.82)" />
          <ellipse cx="12" cy="18" rx="2" ry="3.5" fill="rgba(255,255,255,0.82)" />
          <ellipse cx="6" cy="12" rx="3.5" ry="2" fill="rgba(255,255,255,0.82)" />
          <ellipse cx="18" cy="12" rx="3.5" ry="2" fill="rgba(255,255,255,0.82)" />
          <ellipse cx="7.8" cy="7.8" rx="2" ry="3" fill="rgba(255,255,255,0.65)" transform="rotate(-45 7.8 7.8)" />
          <ellipse cx="16.2" cy="16.2" rx="2" ry="3" fill="rgba(255,255,255,0.65)" transform="rotate(-45 16.2 16.2)" />
        </svg>
      );
    case 'lla5':
      // Lla-5 / Pollinations text model — simple "L5" glyph
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <text x="3" y="17" fontSize="12" fontWeight="800" fill="white" fontFamily="system-ui">L5</text>
        </svg>
      );
    case 'auto':
    default:
      // Auto — animated spark
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="white" />
        </svg>
      );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────
function readAttachment(file: File): Promise<LinusAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      resolve({ name: file.name, mimeType: file.type, dataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  });
}

function fileBadge(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? 'DOC' : name.slice(dot + 1, dot + 4).toUpperCase();
}

function statusLabel(provider: ProviderOption): JSX.Element | string {
  if (provider.status === 'needs-key') return 'Key';
  if (provider.status === 'offline') return <CircleSlash size={13} />;
  if (provider.status === 'needs-model') return 'Model';
  if (provider.status === 'todo') return '—';
  return '';
}
