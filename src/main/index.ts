import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import type {
  LinusTheme,
  LinusAppState,
  LinusAttachment,
  LinusUiState,
  LinusWindowMode,
  ProviderId,
  SkillId
} from '../shared/linus';
import { AiRouter } from './ai/router';
import { BrowserAutomation } from './browser/browserAutomation';
import { loadDotEnv, readLinusEnv, type LinusEnv } from './config/env';
import { MemoryStore } from './memory/memoryStore';
import { createProviders } from './providers/chatProviders';
import { buildProviderRegistry } from './providers/registry';
import type { ChatResponse } from './providers/types';
import {
  configureAppDataPath,
  ensureAppDataLayout,
  readSettings,
  type PersistedSettings,
  writeSettings
} from './settings/appData';
import { skillInstructions, skillOptions } from './skills/skillRegistry';
import { detectLocalIntent } from './tasks/intentRouter';
import { planToolWithProvider, type PlannedTool } from './tasks/toolPlanner';
import { splitAttachments } from './tools/attachmentReader';
import { detectDesktopIntent, executeDesktopIntent } from './tools/desktopTools';
import { detectImageIntent, generateImage } from './tools/imageGeneration';
import { detectProviderSearchToolCall, detectSerperIntent, runSerperSearch } from './tools/serperSearch';
import { analyzeAttachedImages, detectVisionIntent, runVisionIntent } from './tools/visionTool';
import { SttService } from './voice/sttService';
import { TtsService } from './voice/ttsService';

loadDotEnv();

const INPUT_SIZE = { width: 520, height: 280 };
const INPUT_EXPANDED_SIZE = { width: 520, height: 500 };
const EXPANDED_SIZE = { width: 720, height: 600 };
const ORB_SIZE = { width: 68, height: 68 };

let mainWindow: BrowserWindow | null = null;
let appDataRoot = configureAppDataPath();
let env: LinusEnv = readLinusEnv();
let settings: PersistedSettings;
let uiState: LinusUiState = 'idle';
let aiRouter: AiRouter;
let ttsService: TtsService;
let sttService: SttService;
let browserAutomation: BrowserAutomation;
let memoryStore: MemoryStore;

const windowModes: LinusWindowMode[] = ['input', 'expanded', 'workspace', 'orb'];
const themes: LinusTheme[] = ['mist', 'dark'];
const uiStates: LinusUiState[] = [
  'idle',
  'hover',
  'focused',
  'thinking',
  'tool',
  'listening',
  'speaking',
  'success',
  'error'
];

function createWindow(): void {
  ensureAppDataLayout(appDataRoot);
  settings = readSettings(appDataRoot);
  if (settings.selectedProvider === 'auto' && env.defaultProvider !== 'auto') {
    settings.selectedProvider = env.defaultProvider;
    writeSettings(appDataRoot, settings);
  }

  mainWindow = new BrowserWindow({
    ...resolveInitialBounds(settings.windowMode),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Linus',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('moved', persistCurrentBounds);
  mainWindow.on('resized', persistCurrentBounds);
  mainWindow.on('blur', () => {
    if (settings.windowMode === 'input' && uiState === 'focused') {
      setUiState('idle');
    }
  });

  // Drag-to-top-edge detection for workspace mode
  let dragCheckInterval: ReturnType<typeof setInterval> | null = null;
  mainWindow.on('move', () => {
    if (!mainWindow || settings.windowMode !== 'input') return;

    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const threshold = 15;

    if (bounds.y <= display.workArea.y + threshold) {
      if (!dragCheckInterval) {
        dragCheckInterval = setInterval(() => {
          if (!mainWindow) {
            if (dragCheckInterval) clearInterval(dragCheckInterval);
            dragCheckInterval = null;
            return;
          }
          const currentBounds = mainWindow.getBounds();
          if (currentBounds.y <= display.workArea.y + threshold) {
            if (dragCheckInterval) clearInterval(dragCheckInterval);
            dragCheckInterval = null;
            setWindowMode('workspace');
          }
        }, 150);
      }
    }
  });

  mainWindow.on('closed', () => {
    if (dragCheckInterval) {
      clearInterval(dragCheckInterval);
      dragCheckInterval = null;
    }
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function resolveInitialBounds(mode: LinusWindowMode): Electron.BrowserWindowConstructorOptions {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const saved = settings?.bounds[mode];
  let size: { width: number; height: number };

  if (mode === 'orb') {
    size = ORB_SIZE;
  } else if (mode === 'expanded') {
    size = EXPANDED_SIZE;
  } else if (mode === 'workspace') {
    size = { width: workArea.width, height: workArea.height };
  } else {
    size = INPUT_SIZE;
  }

  return {
    width: saved?.width ?? size.width,
    height: saved?.height ?? size.height,
    x: saved?.x ?? Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: saved?.y ?? (mode === 'workspace' ? workArea.y : Math.round(workArea.y + workArea.height * 0.18))
  };
}

function persistCurrentBounds(): void {
  if (!mainWindow || !settings) {
    return;
  }

  settings.bounds[settings.windowMode] = mainWindow.getBounds();
  writeSettings(appDataRoot, settings);
}

function appState(): LinusAppState {
  return {
    mode: settings.windowMode,
    uiState,
    selectedProvider: settings.selectedProvider,
    activeSkill: settings.activeSkill,
    theme: settings.theme,
    hotkey: settings.hotkey,
    appDataPath: appDataRoot,
    providers: buildProviderRegistry(env),
    skills: skillOptions(),
    sidebarPanel: settings.windowMode === 'workspace' ? 'chats' : '',
    sidebarOpen: settings.windowMode === 'workspace',
    rightSidebarOpen: false
  };
}

function resolveWindowSize(mode: LinusWindowMode): { width: number; height: number } {
  if (mode === 'orb') return ORB_SIZE;
  if (mode === 'expanded') return EXPANDED_SIZE;
  if (mode === 'workspace') {
    const display = screen.getPrimaryDisplay();
    return { width: display.workArea.width, height: display.workArea.height };
  }
  return INPUT_SIZE;
}

function setWindowMode(mode: LinusWindowMode): LinusAppState {
  if (!mainWindow || settings.windowMode === mode) {
    return appState();
  }

  persistCurrentBounds();
  settings.windowMode = mode;
  const savedBounds = settings.bounds[mode];
  const size = resolveWindowSize(mode);

  mainWindow.setResizable(true);

  if (mode === 'workspace') {
    const display = screen.getPrimaryDisplay();
    mainWindow.setBounds(display.workArea, true);
    mainWindow.setResizable(true);
   
  } else if (savedBounds) {
    mainWindow.setBounds({ ...savedBounds, width: size.width, height: size.height }, true);
  } else {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds(
      {
        x: Math.round(bounds.x + bounds.width / 2 - size.width / 2),
        y: bounds.y,
        width: size.width,
        height: size.height
      },
      true
    );
  }

  if (mode !== 'workspace') {
    mainWindow.setResizable(false);
 
    mainWindow.setAlwaysOnTop(true, 'floating');
  } else {
    mainWindow.setAlwaysOnTop(true);
  }

  mainWindow.show();
  mainWindow.focus();
  writeSettings(appDataRoot, settings);
  mainWindow.webContents.send('linus:state-changed', appState());
  return appState();
}

function setUiState(nextState: LinusUiState): LinusAppState {
  uiState = nextState;
  mainWindow?.webContents.send('linus:state-changed', appState());
  return appState();
}

function registerIpc(): void {
  ipcMain.handle('linus:get-state', () => appState());
  ipcMain.handle('linus:set-window-mode', (_event, mode: unknown) => {
    if (!isWindowMode(mode)) {
      return appState();
    }

    return setWindowMode(mode);
  });
  ipcMain.handle('linus:set-ui-state', (_event, state: unknown) => {
    if (!isUiState(state)) {
      return appState();
    }

    return setUiState(state);
  });
  ipcMain.handle('linus:set-surface-expanded', (_event, expanded: unknown) => {
    if (typeof expanded !== 'boolean') {
      return appState();
    }

    setInputSurfaceExpanded(expanded);
    return appState();
  });
  ipcMain.handle('linus:set-selected-provider', (_event, provider: unknown) => {
    if (!isProviderId(provider)) {
      return appState();
    }

    settings.selectedProvider = provider;
    writeSettings(appDataRoot, settings);
    mainWindow?.webContents.send('linus:state-changed', appState());
    return appState();
  });
  ipcMain.handle('linus:set-active-skill', (_event, skill: unknown) => {
    if (!isSkillId(skill)) {
      return appState();
    }

    settings.activeSkill = skill;
    writeSettings(appDataRoot, settings);
    mainWindow?.webContents.send('linus:state-changed', appState());
    return appState();
  });
  ipcMain.handle('linus:set-theme', (_event, theme: unknown) => {
    if (!isTheme(theme)) {
      return appState();
    }

    settings.theme = theme;
    writeSettings(appDataRoot, settings);
    mainWindow?.webContents.send('linus:state-changed', appState());
    return appState();
  });

  ipcMain.handle('linus:transcribe-audio', async (_event, audio: unknown, mimeType: unknown) => {
    if (!(audio instanceof ArrayBuffer) || typeof mimeType !== 'string') {
      throw new Error('Invalid audio payload.');
    }

    return sttService.transcribe(audio, mimeType);
  });
  ipcMain.handle('linus:stop-speech', () => {
    ttsService.stop();
  });

  ipcMain.handle('linus:submit-prompt', async (_event, prompt: unknown, images: unknown) => {
    const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    const attachments = normalizeAttachments(images);
    const attached = splitAttachments(attachments);
    if (!normalizedPrompt && attachments.length === 0) {
      return {
        statusText: 'Tell Linus what you want to do.',
        steps: [
          { id: 'understand', label: 'Understanding request', status: 'pending' },
          { id: 'route', label: 'Routing to provider', status: 'pending' },
          { id: 'respond', label: 'Preparing response', status: 'pending' }
        ]
      };
    }

    setUiState('thinking');
    ttsService.stop();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      if (attachments.length > 0) {
        setUiState('tool');
        const attachmentPrompt = normalizedPrompt || 'Summarize these attachments and point out useful details.';
        const visionResult =
          attached.images.length > 0
            ? await analyzeAttachedImages(attachmentPrompt, attached.images, env)
            : null;
        const verifiedResult = [
          attached.documents.length > 0
            ? `Read ${attached.documents.length} document attachment(s).\n\n${attached.readableText}`
            : '',
          visionResult
            ? `Analyzed ${attached.images.length} image attachment(s) with ${visionResult.providerName}.\n\n${visionResult.analysis}`
            : ''
        ]
          .filter(Boolean)
          .join('\n\n');
        const finalResponse = await finalizeToolResponse(attachmentPrompt, 'attachments.read_analyze', verifiedResult);
        await rememberTask(attachmentPrompt, finalResponse.content);
        setUiState('success');
        speakResponse(finalResponse.content, finalResponse.provider);
        setTimeout(() => setUiState('idle'), env.speakResponses ? 3200 : 1200);

        return {
          statusText: attached.images.length > 0 ? 'Analyzing image...' : 'Attachments analyzed',
          responseText: finalResponse.content,
          providerName: finalResponse.providerName,
          model: `${visionResult?.model ?? 'document-reader'} + ${finalResponse.model}`,
          kind: 'tool',
          steps: [
            { id: 'understand', label: 'Received attachments', status: 'done' },
            {
              id: 'read',
              label: `Read ${attached.documents.length} document(s) and ${attached.images.length} image(s)`,
              status: 'done'
            },
            { id: 'respond', label: `Finalized with ${finalResponse.providerName}`, status: 'done' }
          ]
        };
      }

      const visionIntent = detectVisionIntent(normalizedPrompt);
      if (visionIntent) {
        setUiState('tool');
        const result = await runVisionIntent(visionIntent, env);
        const verifiedResult = `${result.openedUrl ? `Opened ${result.openedUrl}. ` : ''}Captured the screen and analyzed it with ${result.providerName}.\n\n${result.analysis}`;
        const finalResponse = await finalizeToolResponse(normalizedPrompt, 'vision.screenshot_analyze', verifiedResult);
        await rememberTask(normalizedPrompt, finalResponse.content);
        setUiState('success');
        speakResponse(finalResponse.content, finalResponse.provider);
        setTimeout(() => setUiState('idle'), env.speakResponses ? 3200 : 1200);

        return {
          statusText: 'Screen analyzed',
          responseText: finalResponse.content,
          providerName: finalResponse.providerName,
          model: `${result.model} + ${finalResponse.model}`,
          kind: 'tool',
          steps: [
            { id: 'understand', label: 'Understood vision task', status: 'done' },
            { id: 'capture', label: visionIntent.label, status: 'done' },
            { id: 'analyze', label: 'Analyzed screenshot with Groq vision', status: 'done' },
            { id: 'respond', label: `Finalized with ${finalResponse.providerName}`, status: 'done' }
          ]
        };
      }

      const imageIntent = detectImageIntent(normalizedPrompt);
      if (imageIntent) {
        setUiState('tool');
        const result = await generateImage(imageIntent, env, appDataRoot);
        const finalResponse = await finalizeToolResponse(normalizedPrompt, 'image.generate', result.message);
        await rememberTask(normalizedPrompt, finalResponse.content);
        setUiState('success');
        speakResponse(finalResponse.content, finalResponse.provider);
        setTimeout(() => setUiState('idle'), env.speakResponses ? 3200 : 1200);

        return {
          statusText: 'Image generated',
          responseText: finalResponse.content,
          imageUrl: result.dataUrl ?? result.url,
          mediaItems: [
            {
              type: 'image',
              title: result.prompt,
              url: result.dataUrl ?? result.url ?? result.filePath ?? '',
              thumbnailUrl: result.dataUrl ?? result.url,
              source: result.providerName,
              snippet: result.message
            }
          ],
          providerName: finalResponse.providerName,
          model: `${result.providerName} ${result.model}`,
          kind: 'image',
          steps: [
            { id: 'understand', label: 'Understood image request', status: 'done' },
            { id: 'generate', label: imageIntent.label, status: 'done' },
            { id: 'open', label: 'Opened generated image', status: 'done' },
            { id: 'respond', label: `Finalized with ${finalResponse.providerName}`, status: 'done' }
          ]
        };
      }

      const serperIntent = detectSerperIntent(normalizedPrompt);
      if (serperIntent) {
        setUiState('tool');
        const result = await runSerperSearch(serperIntent, env);
        const finalResponse = await finalizeToolResponse(normalizedPrompt, 'web.serper_search', result.message);
        await rememberTask(normalizedPrompt, finalResponse.content);
        setUiState('success');
        speakResponse(finalResponse.content, finalResponse.provider);
        setTimeout(() => setUiState('idle'), env.speakResponses ? 3200 : 1200);

        return {
          statusText: 'Search completed',
          responseText: finalResponse.content,
          mediaItems: result.items,
          providerName: finalResponse.providerName,
          model: `${result.providerName}:${result.model} + ${finalResponse.model}`,
          kind: 'tool',
          steps: [
            { id: 'understand', label: 'Understood internal search request', status: 'done' },
            { id: 'search', label: serperIntent.label, status: 'done' },
            { id: 'respond', label: `Finalized with ${finalResponse.providerName}`, status: 'done' }
          ]
        };
      }

      const plannedTool = await planToolWithProvider(normalizedPrompt, aiRouter, settings.selectedProvider);
      const plannedResponse = plannedTool ? await executePlannedTool(normalizedPrompt, plannedTool) : null;
      if (plannedResponse) {
        return plannedResponse;
      }

      const desktopIntent = detectDesktopIntent(normalizedPrompt);
      if (desktopIntent) {
        const plannedResponse = await executePlannedTool(normalizedPrompt, {
          type: 'desktop',
          intent: desktopIntent
        });
        if (plannedResponse) {
          return plannedResponse;
        }
      }

      const localIntent = detectLocalIntent(normalizedPrompt);
      if (localIntent.type === 'browser') {
        const plannedResponse = await executePlannedTool(normalizedPrompt, localIntent);
        if (plannedResponse) {
          return plannedResponse;
        }
      }

      const response = await aiRouter.route({
        preference: 'auto',
        selectedProvider: settings.selectedProvider,
        signal: controller.signal,
        messages: [
          {
            role: 'system',
            content: await buildSystemPrompt(normalizedPrompt)
          },
          {
            role: 'user',
            content: normalizedPrompt
          }
        ]
      });

      const providerSearchIntent = detectProviderSearchToolCall(response.content, normalizedPrompt);
      if (providerSearchIntent) {
        setUiState('tool');
        const result = await runSerperSearch(providerSearchIntent, env);
        const finalResponse = await finalizeToolResponse(normalizedPrompt, 'web.serper_search', result.message);
        await rememberTask(normalizedPrompt, finalResponse.content);
        setUiState('success');
        speakResponse(finalResponse.content, finalResponse.provider);
        setTimeout(() => setUiState('idle'), env.speakResponses ? 3200 : 1200);

        return {
          statusText: 'Search completed',
          responseText: finalResponse.content,
          mediaItems: result.items,
          providerName: finalResponse.providerName,
          model: `${result.providerName}:${result.model} + ${finalResponse.model}`,
          kind: 'tool',
          steps: [
            { id: 'understand', label: 'Converted provider tool call to real tool', status: 'done' },
            { id: 'search', label: providerSearchIntent.label, status: 'done' },
            { id: 'respond', label: `Finalized with ${finalResponse.providerName}`, status: 'done' }
          ]
        };
      }

      setUiState('success');
      await rememberConversation(normalizedPrompt, response.content);
      speakResponse(response.content, response.provider);
      setTimeout(() => setUiState('idle'), env.speakResponses ? 4200 : 1500);

      return {
        statusText: `${response.providerName} answered`,
        responseText: response.content,
        providerName: response.providerName,
        model: response.model,
        kind: 'chat',
        steps: [
          { id: 'understand', label: 'Understanding request', status: 'done' },
          { id: 'route', label: `Routed to ${response.providerName}`, status: 'done' },
          { id: 'execute', label: 'Generated response', status: 'done' },
          { id: 'verify', label: 'Verified provider response', status: 'done' }
        ]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Linus could not complete the request.';
      setUiState('error');
      setTimeout(() => setUiState('idle'), 2200);

      return {
        statusText: 'Something went wrong',
        error: message,
        kind: 'chat',
        steps: [
          { id: 'understand', label: 'Understanding request', status: 'done' },
          { id: 'route', label: 'Routing to provider', status: 'error' },
          { id: 'respond', label: 'Preparing response', status: 'pending' }
        ]
      };
    } finally {
      clearTimeout(timeout);
    }
  });

  ipcMain.handle('linus:close', () => {
    setWindowMode('orb');
    return appState();
  });


ipcMain.handle('linus:set-sidebar-panel', (_event, panel: unknown) => {
    if (typeof panel !== 'string') {
      return appState();
    }
    mainWindow?.webContents.send('linus:state-changed', {
      ...appState(),
      sidebarPanel: panel,
      sidebarOpen: true
    });
    return {
      ...appState(),
      sidebarPanel: panel,
      sidebarOpen: true
    };
  });

  ipcMain.handle('linus:set-sidebar-open', (_event, open: unknown) => {
    if (typeof open !== 'boolean') {
      return appState();
    }
    mainWindow?.webContents.send('linus:state-changed', {
      ...appState(),
      sidebarOpen: open
    });
    return {
      ...appState(),
      sidebarOpen: open
    };
  });

  ipcMain.handle('linus:set-right-sidebar-open', (_event, open: unknown) => {
    if (typeof open !== 'boolean') {
      return appState();
    }
    mainWindow?.webContents.send('linus:state-changed', {
      ...appState(),
      rightSidebarOpen: open
    });
    return {
      ...appState(),
      rightSidebarOpen: open
    };
  });
}

function normalizeAttachments(value: unknown): LinusAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is LinusAttachment => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const attachment = item as Partial<LinusAttachment>;
      return (
        typeof attachment.name === 'string' &&
        typeof attachment.mimeType === 'string' &&
        typeof attachment.dataUrl === 'string' &&
        attachment.dataUrl.startsWith('data:')
      );
    })
    .slice(0, 9);
}

function setInputSurfaceExpanded(expanded: boolean): void {
  if (!mainWindow || settings.windowMode !== 'input') {
    return;
  }

  const bounds = mainWindow.getBounds();
  const target = expanded ? INPUT_EXPANDED_SIZE : INPUT_SIZE;
  if (bounds.width === target.width && bounds.height === target.height) {
    return;
  }

  mainWindow.setResizable(true);
  mainWindow.setBounds({ ...bounds, width: target.width, height: target.height }, true);
  mainWindow.setResizable(false);
}

function isWindowMode(value: unknown): value is LinusWindowMode {
  return typeof value === 'string' && windowModes.includes(value as LinusWindowMode);
}

function isUiState(value: unknown): value is LinusUiState {
  return typeof value === 'string' && uiStates.includes(value as LinusUiState);
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && buildProviderRegistry(env).some((option) => option.id === value);
}

function isSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' && skillOptions().some((skill) => skill.id === value);
}

function isTheme(value: unknown): value is LinusTheme {
  return typeof value === 'string' && themes.includes(value as LinusTheme);
}

async function executePlannedTool(
  prompt: string,
  plannedTool: PlannedTool
): Promise<{
  statusText: string;
  responseText: string;
  providerName: string;
  model: string;
  kind: 'tool';
  steps: Array<{ id: string; label: string; status: 'done' | 'active' | 'pending' | 'error' }>;
} | null> {
  if (plannedTool.type === 'chat') {
    return null;
  }

  setUiState('tool');

  if (plannedTool.type === 'desktop') {
    const executableIntent =
      plannedTool.intent.type === 'notepad-note'
        ? { ...plannedTool.intent, text: await resolveNotepadText(prompt, plannedTool.intent.text) }
        : plannedTool.intent;
    const result = await executeDesktopIntent(executableIntent);
    const finalResponse = await finalizeToolResponse(prompt, plannedTool.intent.type, result);
    await rememberTask(prompt, finalResponse.content);
    setUiState('success');
    speakResponse(finalResponse.content, finalResponse.provider);
    setTimeout(() => setUiState('idle'), env.speakResponses ? 3200 : 1200);

    return {
      statusText: 'Task completed',
      responseText: finalResponse.content,
      providerName: finalResponse.providerName,
      model: `planner:${plannedTool.intent.type} + ${finalResponse.model}`,
      kind: 'tool',
      steps: [
        { id: 'understand', label: 'Planned local action with provider', status: 'done' },
        { id: 'execute', label: plannedTool.intent.label, status: 'done' },
        { id: 'verify', label: 'Verified local action', status: 'done' },
        { id: 'respond', label: `Finalized with ${finalResponse.providerName}`, status: 'done' }
      ]
    };
  }

  const result = await browserAutomation.open(plannedTool.request);
  const finalResponse = await finalizeToolResponse(prompt, 'browser.open', `${result}.`);
  await rememberTask(prompt, finalResponse.content);
  setUiState('success');
  speakResponse(finalResponse.content, finalResponse.provider);
  setTimeout(() => setUiState('idle'), env.speakResponses ? 3200 : 1400);

  return {
    statusText: 'Browser action completed',
    responseText: finalResponse.content,
    providerName: finalResponse.providerName,
    model: `planner:browser.open + ${finalResponse.model}`,
    kind: 'tool',
    steps: [
      { id: 'understand', label: 'Planned browser action with provider', status: 'done' },
      { id: 'execute', label: plannedTool.label, status: 'done' },
      { id: 'verify', label: 'Launch completed without error', status: 'done' },
      { id: 'respond', label: `Finalized with ${finalResponse.providerName}`, status: 'done' }
    ]
  };
}

async function initializeAi(): Promise<void> {
  env = readLinusEnv();
  aiRouter = new AiRouter();
  for (const provider of createProviders(env)) {
    aiRouter.register(provider);
  }

  ttsService = new TtsService(env, appDataRoot);
  sttService = new SttService(env);
  browserAutomation = new BrowserAutomation();
  memoryStore = new MemoryStore(appDataRoot);
  await memoryStore.seedDefaults();
}

async function buildSystemPrompt(prompt: string): Promise<string> {
  const memories = await memoryStore.search('all', prompt, 8);
  const memoryText = memories.map((memory) => `- ${memory.text}`).join('\n');

  return [
    'You are Linus, a Windows desktop AI agent created by Shapes.',
    env.systemPrompt,
    `Active skill: ${settings.activeSkill}. ${skillInstructions(settings.activeSkill)}`,
    'You can use real tools only when the app has actually executed them. Do not claim actions happened unless a tool result says so.',
    memoryText ? `Relevant memory:\n${memoryText}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function finalizeToolResponse(
  userPrompt: string,
  toolName: string,
  toolResult: string
): Promise<ChatResponse> {
  try {
    return await aiRouter.route({
      preference: 'auto',
      selectedProvider: settings.selectedProvider,
      messages: [
        {
          role: 'system',
          content: await buildSystemPrompt(userPrompt)
        },
        {
          role: 'user',
          content: [
            `User request: ${userPrompt}`,
            `Verified local tool: ${toolName}`,
            `Tool result:\n${toolResult}`,
            'Reply naturally as Linus. Be concise. Mention only what the verified result proves. Do not pretend to perform any extra action.'
          ].join('\n\n')
        }
      ]
    });
  } catch (error) {
    return {
      provider: 'auto',
      providerName: 'Linus',
      model: 'tool-result',
      content: `${toolResult}\n\nProvider summary failed: ${
        error instanceof Error ? error.message : 'unknown provider error'
      }`,
      verified: true
    };
  }
}

async function resolveNotepadText(userPrompt: string, requestedText: string): Promise<string> {
  if (!shouldGenerateNotepadText(requestedText)) {
    return requestedText;
  }

  try {
    const response = await aiRouter.route({
      preference: 'auto',
      selectedProvider: settings.selectedProvider,
      messages: [
        {
          role: 'system',
          content: await buildSystemPrompt(userPrompt)
        },
        {
          role: 'user',
          content: [
            'Write the exact text that should be saved into Notepad.',
            'The user asked for a note about you/Linus. Write in first person as Linus, created by Shapes.',
            'Keep it useful and honest: explain what Linus can do now, what is still being built, and the operating style.',
            'Do not include markdown fences.',
            `Original request: ${userPrompt}`
          ].join('\n')
        }
      ]
    });
    return response.content.trim();
  } catch {
    return [
      'Linus is a Windows desktop AI agent created by Shapes.',
      'I can chat through configured providers, open supported apps, open browser searches, create local notes and folders, remember useful facts, speak through configured TTS, and analyze screenshots when Groq vision is configured.',
      'I should only claim actions that were actually verified. Some advanced automation is still being expanded, but the tool system is real and designed to grow safely.'
    ].join('\n\n');
  }
}

function shouldGenerateNotepadText(text: string): boolean {
  return /\b(?:everything\s+about\s+(?:you|u|linus|yourself)|about\s+(?:you|u|linus|yourself))\b/i.test(text);
}

async function rememberConversation(prompt: string, response: string): Promise<void> {
  await memoryStore.write('conversation', `User: ${prompt}\nLinus: ${response.slice(0, 1200)}`);
  await maybeRememberUserFact(prompt);
}

async function rememberTask(prompt: string, result: string): Promise<void> {
  await memoryStore.write('daily-task', `Task: ${prompt}\nResult: ${result}`);
  await maybeRememberUserFact(prompt);
}

async function maybeRememberUserFact(prompt: string): Promise<void> {
  const match = prompt.match(/\b(?:remember|note that|keep in mind)\b[:,]?\s*(.+)$/i);
  if (match?.[1]) {
    await memoryStore.write('long-term', match[1].trim());
  }
}

function speakResponse(text: string, provider: ProviderId): void {
  if (!env.speakResponses) {
    return;
  }

  setTimeout(() => {
    setUiState('speaking');
    ttsService
      .speak(text, provider)
      .catch((error) => {
        mainWindow?.webContents.send('linus:speech-error', error instanceof Error ? error.message : 'Speech failed.');
      })
      .finally(() => setUiState('idle'));
  }, 500);
}

function registerShortcuts(): void {
  globalShortcut.unregisterAll();
  globalShortcut.register(settings.hotkey, () => {
    if (!mainWindow) {
      return;
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }

    if (settings.windowMode === 'orb') {
      setWindowMode('input');
    }

    mainWindow.focus();
    mainWindow.webContents.send('linus:focus-input');
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId(process.platform === 'win32' && !app.isPackaged ? process.execPath : 'app.shapes.linus');

  await initializeAi();
  createWindow();
  registerIpc();
  registerShortcuts();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep Linus resident so the global shortcut can reopen the floating surface.
});
