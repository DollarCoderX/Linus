import type { BrowserAutomationRequest } from '../browser/browserAutomation';

export type LocalIntent =
  | {
      type: 'browser';
      request: BrowserAutomationRequest;
      label: string;
    }
  | {
      type: 'chat';
    };

export function detectLocalIntent(prompt: string): LocalIntent {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const browser = detectBrowser(lower);

  const searchMatch =
    text.match(/(?:open\s+(?:chrome|edge|firefox|browser)\s+(?:and\s+)?)?search(?:\s+google)?\s+for\s+(.+)$/i) ||
    text.match(/open\s+(?:chrome|edge|firefox|browser)\s+(?:and\s+)?search\s+(.+)$/i) ||
    text.match(/(?:open\s+(?:chrome|edge|firefox|browser)\s+(?:and\s+)?)?look\s+up\s+(.+)$/i);

  if (searchMatch?.[1]) {
    const query = cleanupQuery(searchMatch[1]);
    return {
      type: 'browser',
      request: {
        browser,
        searchQuery: query
      },
      label: `Searching for "${query}"`
    };
  }

  const urlMatch =
    text.match(/(?:open|go\s+to|navigate\s+to)\s+((?:https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?)/i) ||
    text.match(/(?:open\s+(?:chrome|edge|firefox|browser)\s+(?:and\s+)?)go\s+to\s+(.+)$/i);

  if (urlMatch?.[1]) {
    const url = cleanupQuery(urlMatch[1]);
    return {
      type: 'browser',
      request: {
        browser,
        url
      },
      label: `Opening ${url}`
    };
  }

  if (/^open\s+(chrome|edge|firefox|browser)\b/i.test(text)) {
    return {
      type: 'browser',
      request: {
        browser
      },
      label: `Opening ${browser === 'primary' ? 'your browser' : browser}`
    };
  }

  return { type: 'chat' };
}

function detectBrowser(lower: string): BrowserAutomationRequest['browser'] {
  if (lower.includes('chrome')) {
    return 'chrome';
  }

  if (lower.includes('firefox')) {
    return 'firefox';
  }

  if (lower.includes('edge')) {
    return 'edge';
  }

  return 'primary';
}

function cleanupQuery(value: string): string {
  return value.trim().replace(/[.!?]+$/, '');
}
