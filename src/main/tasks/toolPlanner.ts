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
      type: 'web-search';
      label: string;
      query: string;
    }
  | {
      type: 'image-generate';
      label: string;
      prompt: string;
    }
  | {
      type: 'chat';
    };

export interface PlannedToolBatch {
  tools: PlannedTool[];
  mode: 'parallel' | 'sequential' | 'mixed';
}

export type ToolExecutionMode = 'parallel' | 'after';

export interface PrioritizedTool {
  tool: PlannedTool;
  mode: ToolExecutionMode;
  priority: number;
}

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
  prompt?: string;
}

interface ToolBatchPlanJson {
  tasks?: ToolPlanJson[];
  mode?: 'parallel' | 'sequential' | 'mixed';
}

const MAX_PARALLEL_TOOLS = 9;

export async function planToolBatchWithProvider(
  prompt: string,
  aiRouter: AiRouter,
  selectedProvider: ProviderId
): Promise<PlannedToolBatch | null> {
  try {
    const response = await aiRouter.route({
      preference: 'auto',
      selectedProvider,
      task: 'plan',
      messages: [
        {
          role: 'system',
          content: [
            'You are Linus parallel tool planner. Return only compact JSON.',
            'Break the user request into a JSON object with a "tasks" array of tool calls.',
            'Choose up to 9 independent tools from: chat, browser.search, browser.open_url, browser.open, desktop.launch_app, desktop.open_target, desktop.notepad_note, desktop.create_folder, web.serper_search, image.generate.',
            'Run independent tasks in parallel. Use mode "parallel" when tasks do not depend on each other.',
            'Only chain tasks ("sequential" mode) when one result is required by a later task.',
            'Do not invent unsupported tools. If nothing needs a tool, return {"tasks":[{"tool":"chat"}],"mode":"parallel"}.',
            'Use browser values: primary, chrome, edge, firefox.',
            'Use app values: notepad, calculator, terminal, explorer.',
            'Use base values: desktop, documents, downloads.',
            'Set confidence from 0 to 1 for each task.'
          ].join(' ')
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return normalizeBatch(parseJsonBatch(response.content));
  } catch {
    return null;
  }
}

function parseJsonBatch(content: string): ToolBatchPlanJson | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]) as ToolBatchPlanJson;
  } catch {
    return null;
  }
}

function normalizeBatch(batch: ToolBatchPlanJson | null): PlannedToolBatch | null {
  if (!batch || !Array.isArray(batch.tasks)) {
    return null;
  }

  const tools = batch.tasks
    .map((task) => normalizePlan(task))
    .filter((tool): tool is PlannedTool => tool !== null);

  if (tools.length === 0) {
    return null;
  }

  const safeTools = tools.slice(0, MAX_PARALLEL_TOOLS);

  return {
    tools: safeTools,
    mode: batch.mode === 'sequential' ? 'sequential' : batch.mode === 'mixed' ? 'mixed' : 'parallel'
  };
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

  if (plan.tool === 'web.serper_search' && (plan.query || plan.text)) {
    const query = plan.query?.trim() || plan.text?.trim() || '';
    return {
      type: 'web-search',
      label: `Searching for "${query}"`,
      query
    };
  }

  if (plan.tool === 'image.generate' && (plan.prompt || plan.text || plan.query)) {
    const prompt = plan.prompt?.trim() || plan.text?.trim() || plan.query?.trim() || '';
    return {
      type: 'image-generate',
      label: 'Generating an image',
      prompt
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
