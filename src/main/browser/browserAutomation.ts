import { spawn } from 'node:child_process';
import { shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface BrowserAutomationRequest {
  browser: 'primary' | 'chrome' | 'edge' | 'firefox';
  url?: string;
  searchQuery?: string;
}

export class BrowserAutomation {
  async open(request: BrowserAutomationRequest): Promise<string> {
    const targetUrl = buildTargetUrl(request);

    if (request.browser === 'primary') {
      await shell.openExternal(targetUrl);
      return `Opened your primary browser at ${targetUrl}`;
    }

    await launchNamedBrowser(request.browser, targetUrl);
    return `Opened ${browserLabel(request.browser)} at ${targetUrl}`;
  }
}

function buildTargetUrl(request: BrowserAutomationRequest): string {
  if (request.url) {
    return normalizeUrl(request.url);
  }

  if (request.searchQuery) {
    return `https://www.google.com/search?q=${encodeURIComponent(request.searchQuery)}`;
  }

  return 'about:blank';
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function launchNamedBrowser(browser: 'chrome' | 'edge' | 'firefox', url: string): Promise<void> {
  const executable = browserExecutable(browser);

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });

    child.once('error', async () => {
      if (browser === 'chrome' || browser === 'edge') {
        try {
          await shell.openExternal(url);
          resolve();
          return;
        } catch (error) {
          reject(error);
          return;
        }
      }

      reject(new Error(`${browserLabel(browser)} could not be launched. Is it installed?`));
    });

    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function browserExecutable(browser: 'chrome' | 'edge' | 'firefox'): string {
  const detectedPath = detectBrowserPath(browser);
  if (detectedPath) {
    return detectedPath;
  }

  if (browser === 'edge') {
    return 'msedge.exe';
  }

  if (browser === 'firefox') {
    return 'firefox.exe';
  }

  return 'chrome.exe';
}

function detectBrowserPath(browser: 'chrome' | 'edge' | 'firefox'): string | null {
  const programFiles = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(
    Boolean
  ) as string[];

  const relativePaths: Record<typeof browser, string[]> = {
    chrome: [
      'Google/Chrome/Application/chrome.exe',
      'Google/Chrome Beta/Application/chrome.exe'
    ],
    edge: ['Microsoft/Edge/Application/msedge.exe'],
    firefox: ['Mozilla Firefox/firefox.exe']
  };

  for (const root of programFiles) {
    for (const relativePath of relativePaths[browser]) {
      const candidate = join(root, ...relativePath.split('/'));
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function browserLabel(browser: 'chrome' | 'edge' | 'firefox'): string {
  if (browser === 'edge') {
    return 'Edge';
  }

  if (browser === 'firefox') {
    return 'Firefox';
  }

  return 'Chrome';
}
