import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LinusTheme, LinusWindowMode, ProviderId, SkillId } from '../../shared/linus';

export interface PersistedSettings {
  selectedProvider: ProviderId;
  activeSkill: SkillId;
  theme: LinusTheme;
  hotkey: string;
  windowMode: LinusWindowMode;
  bounds: {
    input?: Electron.Rectangle;
    orb?: Electron.Rectangle;
  };
}

const defaultSettings: PersistedSettings = {
  selectedProvider: 'auto',
  activeSkill: 'assistant',
  theme: 'mist',
  hotkey: 'CommandOrControl+Space',
  windowMode: 'input',
  bounds: {}
};

export function resolveLinusDataRoot(): string {
  return join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'Linus');
}

export function configureAppDataPath(): string {
  const root = resolveLinusDataRoot();
  mkdirSync(root, { recursive: true });
  app.setPath('userData', root);
  return root;
}

export function ensureAppDataLayout(root: string): void {
  const directories = [
    'System',
    'System/Memory',
    'System/Memory/LongTerm',
    'System/Memory/DailyTasks',
    'System/Memory/Temporary',
    'System/Memory/Conversations',
    'System/Memory/Projects',
    'System/Skills',
    'System/Cache',
    'System/Data',
    'System/Logs',
    'System/Settings',
    'System/Exports',
    'System/Core'
  ];

  for (const directory of directories) {
    mkdirSync(join(root, directory), { recursive: true });
  }
}

export function readSettings(root: string): PersistedSettings {
  const filePath = settingsPath(root);

  if (!existsSync(filePath)) {
    writeSettings(root, defaultSettings);
    return defaultSettings;
  }

  try {
    const parsed = {
      ...defaultSettings,
      ...JSON.parse(readFileSync(filePath, 'utf8'))
    };
    if (parsed.windowMode !== 'input' && parsed.windowMode !== 'orb') {
      parsed.windowMode = 'input';
    }
    return parsed;
  } catch {
    return defaultSettings;
  }
}

export function writeSettings(root: string, settings: PersistedSettings): void {
  writeFileSync(settingsPath(root), JSON.stringify(settings, null, 2));
}

function settingsPath(root: string): string {
  return join(root, 'System', 'Settings', 'settings.json');
}
