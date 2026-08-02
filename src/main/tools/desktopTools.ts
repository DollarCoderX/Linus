import { shell } from 'electron';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export type DesktopIntent =
  | {
      type: 'launch-app';
      app: 'notepad' | 'calculator' | 'terminal' | 'explorer';
      label: string;
    }
  | {
      type: 'notepad-note';
      text: string;
      label: string;
    }
  | {
      type: 'create-folder';
      folderName: string;
      base: 'desktop' | 'documents' | 'downloads';
      label: string;
    }
  | {
      type: 'open-target';
      target: string;
      label: string;
    }
  | {
      type: 'launch-multiple-apps';
      apps: Array<'notepad' | 'calculator' | 'terminal' | 'explorer'>;
      label: string;
    }
  | {
      type: 'create-multiple-folders';
      folderNames: string[];
      base: 'desktop' | 'documents' | 'downloads';
      label: string;
    }
  | {
      type: 'write-multiple-notes';
      notes: Array<{ title?: string; text: string }>;
      label: string;
    };

export async function executeDesktopIntent(intent: DesktopIntent): Promise<string> {
  if (intent.type === 'launch-app') {
    await launchApplication(intent.app);
    return `Opened ${appLabel(intent.app)}.`;
  }

  if (intent.type === 'notepad-note') {
    const notesDir = join(homedir(), 'Documents', 'Linus Notes');
    mkdirSync(notesDir, { recursive: true });
    const filePath = join(notesDir, `note-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
    writeFileSync(filePath, intent.text, 'utf8');
    await launchProcess('notepad.exe', [filePath]);
    return `Created a note and opened it in Notepad: ${filePath}`;
  }

  if (intent.type === 'open-target') {
    const resolved = resolveOpenTarget(intent.target);
    if (resolved.kind === 'path') {
      const error = await shell.openPath(resolved.value);
      if (error) {
        throw new Error(error);
      }
      return `Opened ${resolved.value}.`;
    }

    await launchProcess('powershell.exe', ['-NoProfile', '-Command', `Start-Process ${quotePowerShell(resolved.value)}`]);
    return `Launched ${resolved.value}.`;
  }

  if (intent.type === 'launch-multiple-apps') {
    const launched: string[] = [];
    for (const app of intent.apps) {
      await launchApplication(app);
      launched.push(appLabel(app));
    }
    return `Opened ${launched.join(', ')}.`;
  }

  if (intent.type === 'create-multiple-folders') {
    const created: string[] = [];
    for (const folderName of intent.folderNames) {
      const folderPath = resolve(basePath(intent.base), folderName);
      mkdirSync(folderPath, { recursive: true });
      created.push(folderPath);
    }

    if (created.length > 0) {
      await shell.openPath(created[created.length - 1]);
    }

    return `Created folders: ${created.join(', ')}.`;
  }

  if (intent.type === 'write-multiple-notes') {
    const notesDir = join(homedir(), 'Documents', 'Linus Notes');
    mkdirSync(notesDir, { recursive: true });
    const saved: string[] = [];

    for (const note of intent.notes) {
      const filePath = join(
        notesDir,
        `${note.title ? sanitizeFilename(note.title) : 'note'}-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
      );
      writeFileSync(filePath, note.text, 'utf8');
      saved.push(filePath);
    }

    if (saved.length > 0) {
      await launchProcess('notepad.exe', [saved[saved.length - 1]]);
    }

    return `Saved ${saved.length} note(s): ${saved.join(', ')}.`;
  }

  if (intent.type === 'create-folder') {
    const folderPath = resolve(basePath(intent.base), intent.folderName);
    mkdirSync(folderPath, { recursive: true });
    if (!existsSync(folderPath)) {
      throw new Error(`Could not verify the folder at ${folderPath}.`);
    }

    await shell.openPath(folderPath);
    return `Created and opened the folder: ${folderPath}`;
  }

  return 'No desktop action was needed.';
}

export function detectDesktopIntent(prompt: string): DesktopIntent | null {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  const multiLaunchMatch = text.match(
    /^open\s+(?:(?:notepad|calculator|calc|terminal|powershell|command\s+prompt|cmd|file\s+explorer|explorer)\s*(?:,\s*|\s+and\s+|\s*&\s*))+.+$/i
  );
  if (multiLaunchMatch) {
    const appNames = text
      .replace(/^open\s+/i, '')
      .split(/\s*(?:,\s*|\s+and\s+|\s*&\s*)\s*/i)
      .map((name) => name.trim())
      .filter(Boolean);
    const apps = appNames
      .map(normalizeAppName)
      .filter((app): app is 'notepad' | 'calculator' | 'terminal' | 'explorer' => app !== null);

    if (apps.length >= 2) {
      return {
        type: 'launch-multiple-apps',
        apps,
        label: `Opening ${apps.map(appLabel).join(', ')}`
      };
    }
  }

  const notepadWriteMatch = text.match(
    /^open\s+notepad\s+(?:and\s+)?(?:write|type)\s+(.+?)(?:\s+(?:then\s+)?save(?:\s+it)?\.?)?$/i
  );
  if (notepadWriteMatch?.[1]) {
    return {
      type: 'notepad-note',
      text: cleanupDictatedText(notepadWriteMatch[1]),
      label: 'Writing and saving a Notepad note'
    };
  }

  const noteMatch = text.match(/(?:open\s+notepad\s+and\s+)?(?:write|type|create)\s+(?:a\s+)?note\s+(?:saying|that says|with)?\s*(.+)$/i);
  if (lower.includes('notepad') && noteMatch?.[1]) {
    const noteText = cleanupDictatedText(noteMatch[1]);
    return {
      type: 'notepad-note',
      text: noteText,
      label: 'Writing a Notepad note'
    };
  }

  if (/^open\s+notepad\b/i.test(text)) {
    return { type: 'launch-app', app: 'notepad', label: 'Opening Notepad' };
  }

  if (/^open\s+(calculator|calc)\b/i.test(text)) {
    return { type: 'launch-app', app: 'calculator', label: 'Opening Calculator' };
  }

  if (/^open\s+(terminal|powershell|command prompt|cmd)\b/i.test(text)) {
    return { type: 'launch-app', app: 'terminal', label: 'Opening Terminal' };
  }

  if (/^open\s+(file explorer|explorer)\b/i.test(text)) {
    return { type: 'launch-app', app: 'explorer', label: 'Opening File Explorer' };
  }

  const openTargetMatch = text.match(/^(?:open|launch|start)\s+(.+)$/i);
  if (openTargetMatch?.[1]) {
    return {
      type: 'open-target',
      target: cleanupDictatedText(openTargetMatch[1]),
      label: `Opening ${openTargetMatch[1].trim()}`
    };
  }

  const multiFolderMatch = text.match(
    /create\s+(?:the\s+)?folders?\s+(?:called|named)?\s*["']?([^"']+?)["']?(?:\s+in\s+(desktop|documents|downloads))?$/i
  );
  if (multiFolderMatch?.[1]) {
    const folderNames = multiFolderMatch[1]
      .split(/\s*(?:,\s*|\s+and\s+|\s+&\s*)\s*/i)
      .map((name) => name.trim().replace(/["']/g, ''))
      .filter(Boolean);

    if (folderNames.length >= 2) {
      return {
        type: 'create-multiple-folders',
        folderNames,
        base: folderBase(multiFolderMatch[2]),
        label: 'Creating multiple folders'
      };
    }

    if (folderNames.length === 1) {
      return {
        type: 'create-folder',
        folderName: folderNames[0],
        base: folderBase(multiFolderMatch[2]),
        label: 'Creating a folder'
      };
    }
  }

  const folderMatch = text.match(/create\s+(?:a\s+)?folder\s+(?:called|named)?\s*["']?([^"']+?)["']?(?:\s+in\s+(desktop|documents|downloads))?$/i);
  if (folderMatch?.[1]) {
    return {
      type: 'create-folder',
      folderName: folderMatch[1].trim(),
      base: folderBase(folderMatch[2]),
      label: 'Creating a folder'
    };
  }

  return null;
}

function resolveOpenTarget(target: string): { kind: 'path' | 'app'; value: string } {
  const cleaned = target.replace(/^["']|["']$/g, '').trim();
  if (existsSync(cleaned)) {
    return { kind: 'path', value: resolve(cleaned) };
  }

  const found = findNamedTarget(cleaned);
  if (found) {
    return { kind: 'path', value: found };
  }

  return { kind: 'app', value: cleaned };
}

function findNamedTarget(name: string): string | null {
  const roots = [homedir(), join(homedir(), 'Desktop'), join(homedir(), 'Documents'), join(homedir(), 'Downloads')];
  const target = name.toLowerCase();

  for (const root of roots) {
    const found = scanShallow(root, target, 3);
    if (found) {
      return found;
    }
  }

  return null;
}

function scanShallow(root: string, target: string, depth: number): string | null {
  if (depth < 0 || !existsSync(root)) {
    return null;
  }

  let entries: string[] = [];
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = join(root, entry);
    if (entry.toLowerCase() === target || entry.toLowerCase().startsWith(`${target}.`)) {
      return fullPath;
    }
  }

  for (const entry of entries.slice(0, 200)) {
    const fullPath = join(root, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        const found = scanShallow(fullPath, target, depth - 1);
        if (found) {
          return found;
        }
      }
    } catch {
      // Ignore inaccessible folders during best-effort user-file search.
    }
  }

  return null;
}

function cleanupDictatedText(value: string): string {
  return value
    .replace(/\s+(?:then\s+)?save(?:\s+it)?\.?$/i, '')
    .trim();
}

function sanitizeFilename(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function normalizeAppName(value: string): 'notepad' | 'calculator' | 'terminal' | 'explorer' | null {
  const normalized = value.toLowerCase().trim();
  if (/^notepad$/.test(normalized)) {
    return 'notepad';
  }
  if (/^(calculator|calc)$/.test(normalized)) {
    return 'calculator';
  }
  if (/^(terminal|powershell|command\s*prompt|cmd)$/.test(normalized)) {
    return 'terminal';
  }
  if (/^(file\s*explorer|explorer)$/.test(normalized)) {
    return 'explorer';
  }
  return null;
}

function folderBase(value?: string): 'desktop' | 'documents' | 'downloads' {
  const normalized = value?.toLowerCase();
  if (normalized === 'desktop' || normalized === 'downloads') {
    return normalized;
  }

  return 'documents';
}

function basePath(base: 'desktop' | 'documents' | 'downloads'): string {
  if (base === 'desktop') {
    return join(homedir(), 'Desktop');
  }

  if (base === 'downloads') {
    return join(homedir(), 'Downloads');
  }

  return join(homedir(), 'Documents');
}

type LaunchableApp = Extract<DesktopIntent, { type: 'launch-app' }>['app'];

async function launchApplication(app: LaunchableApp): Promise<void> {
  if (app === 'calculator') {
    await launchProcess('calc.exe', []);
    return;
  }

  if (app === 'terminal') {
    await launchProcess('powershell.exe', []);
    return;
  }

  if (app === 'explorer') {
    await launchProcess('explorer.exe', []);
    return;
  }

  await launchProcess('notepad.exe', []);
}

function launchProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });

    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function appLabel(app: LaunchableApp): string {
  if (app === 'calculator') {
    return 'Calculator';
  }

  if (app === 'terminal') {
    return 'Terminal';
  }

  if (app === 'explorer') {
    return 'File Explorer';
  }

  return 'Notepad';
}
