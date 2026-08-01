import type { ProviderId } from '../../shared/linus';
import type { AiRouter } from '../ai/router';
import type { BrowserAutomationRequest } from '../browser/browserAutomation';
import type { DesktopIntent } from '../tools/desktopTools';

export type PlannedTool =
  | {
      type: 'browser';
      request: BrowserAutomationRequest;
      label: string;
    }
  | {
      type: 'desktop';
      intent: DesktopIntent;
    }
  | {
      type: 'chat';
    };

interface ToolPlanJson {
  tool?: string;
  confidence?: number;
  browser?: BrowserAutomationRequest['browser'];
  url?: string;
  query?: string;
  app?: 'notepad' | 'calculator' | 'terminal' | 'explorer';
  target?: string;
  text?: string;
  folderName?: string;
  base?: 'desktop' | 'documents' | 'downloads';
}

export async function planToolWithProvider(
  prompt: string,
  aiRouter: AiRouter,
  selectedProvider: ProviderId
): Promise<PlannedTool | null> {
  try {
    const response = await aiRouter.route({
      preference: 'auto',
      selectedProvider,
      messages: [
        {
          role: 'system',
          content: [
            'You are Linus tool planner. Return only compact JSON.',
            'Choose one safe tool from: chat, browser.search, browser.open_url, browser.open, desktop.launch_app, desktop.open_target, desktop.notepad_note, desktop.create_folder.',
            'Do not invent unsupported tools. If the request needs unsupported automation, return {"tool":"chat"}.',
            'Use browser values: primary, chrome, edge, firefox.',
            'Use app values: notepad, calculator, terminal, explorer.',
            'Use base values: desktop, documents, downloads.',
            'Set confidence from 0 to 1.'
          ].join(' ')
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return normalizePlan(parseJsonPlan(response.content));
  } catch {
    return null;
  }
}

function parseJsonPlan(content: string): ToolPlanJson | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]) as ToolPlanJson;
  } catch {
    return null;
  }
}

function normalizePlan(plan: ToolPlanJson | null): PlannedTool | null {
  if (!plan || (plan.confidence ?? 0) < 0.62) {
    return null;
  }

  const browser = normalizeBrowser(plan.browser);

  if (plan.tool === 'browser.search' && plan.query) {
    return {
      type: 'browser',
      request: { browser, searchQuery: plan.query.trim() },
      label: `Searching for "${plan.query.trim()}"`
    };
  }

  if (plan.tool === 'browser.open_url' && plan.url) {
    return {
      type: 'browser',
      request: { browser, url: plan.url.trim() },
      label: `Opening ${plan.url.trim()}`
    };
  }

  if (plan.tool === 'browser.open') {
    return {
      type: 'browser',
      request: { browser },
      label: `Opening ${browser === 'primary' ? 'your browser' : browser}`
    };
  }

  if (plan.tool === 'desktop.launch_app' && plan.app) {
    return {
      type: 'desktop',
      intent: {
        type: 'launch-app',
        app: plan.app,
        label: `Opening ${plan.app}`
      }
    };
  }

  if (plan.tool === 'desktop.open_target' && plan.target) {
    return {
      type: 'desktop',
      intent: {
        type: 'open-target',
        target: plan.target.trim(),
        label: `Opening ${plan.target.trim()}`
      }
    };
  }

  if (plan.tool === 'desktop.notepad_note' && plan.text) {
    return {
      type: 'desktop',
      intent: {
        type: 'notepad-note',
        text: plan.text.trim(),
        label: 'Writing and saving a Notepad note'
      }
    };
  }

  if (plan.tool === 'desktop.create_folder' && plan.folderName) {
    return {
      type: 'desktop',
      intent: {
        type: 'create-folder',
        folderName: plan.folderName.trim(),
        base: normalizeBase(plan.base),
        label: 'Creating a folder'
      }
    };
  }

  return null;
}

function normalizeBrowser(value?: BrowserAutomationRequest['browser']): BrowserAutomationRequest['browser'] {
  if (value === 'chrome' || value === 'edge' || value === 'firefox') {
    return value;
  }

  return 'primary';
}

function normalizeBase(value?: 'desktop' | 'documents' | 'downloads'): 'desktop' | 'documents' | 'downloads' {
  if (value === 'desktop' || value === 'downloads') {
    return value;
  }

  return 'documents';
}
