import type { ParallelTaskStatus } from '../../shared/linus';
import type { LinusEnv } from '../config/env';
import type { BrowserAutomation } from '../browser/browserAutomation';
import type { PlannedTool } from './toolPlanner';
import { executeDesktopIntent } from '../tools/desktopTools';
import { runSerperSearch, type SerperIntent } from '../tools/serperSearch';
import { generateImage } from '../tools/imageGeneration';

export interface ToolExecutionContext {
  browserAutomation: BrowserAutomation;
  env: LinusEnv;
  appDataRoot: string;
}

export interface ToolExecutionResult {
  tool: string;
  label: string;
  success: boolean;
  result?: string;
  error?: string;
}

export type TaskUpdateCallback = (
  index: number,
  status: ParallelTaskStatus,
  result?: string,
  error?: string
) => void;

/**
 * Executes a batch of tools concurrently (up to the caller's batch size).
 * Uses Promise.allSettled so one failed tool never blocks the others.
 */
export async function executeToolBatch(
  tools: PlannedTool[],
  context: ToolExecutionContext,
  onUpdate?: TaskUpdateCallback
): Promise<ToolExecutionResult[]> {
  const settled = await Promise.allSettled(
    tools.map((tool, index) => executeTool(tool, index, context, onUpdate))
  );

  return settled.map((entry, index) => {
    const tool = tools[index];
    const label = toolLabel(tool);

    if (entry.status === 'fulfilled') {
      return {
        tool: tool.type,
        label,
        success: true,
        result: entry.value
      };
    }

    return {
      tool: tool.type,
      label,
      success: false,
      error: entry.reason instanceof Error ? entry.reason.message : 'Tool failed unexpectedly.'
    };
  });
}

async function executeTool(
  tool: PlannedTool,
  index: number,
  context: ToolExecutionContext,
  onUpdate?: TaskUpdateCallback
): Promise<string> {
  onUpdate?.(index, 'running');

  try {
    if (tool.type === 'browser') {
      const result = await context.browserAutomation.open(tool.request);
      onUpdate?.(index, 'done', result);
      return result;
    }

    if (tool.type === 'desktop') {
      const result = await executeDesktopIntent(tool.intent);
      onUpdate?.(index, 'done', result);
      return result;
    }

    if (tool.type === 'web-search') {
      const intent: SerperIntent = {
        type: 'web',
        query: tool.query,
        count: 5,
        label: tool.label
      };
      const result = await runSerperSearch(intent, context.env);
      onUpdate?.(index, 'done', result.message);
      return result.message;
    }

    if (tool.type === 'image-generate') {
      const result = await generateImage(
        {
          prompt: tool.prompt,
          provider: 'auto',
          label: tool.label
        },
        context.env,
        context.appDataRoot
      );
      const message = result.url
        ? `${result.message}\n${result.url}`
        : result.message;
      onUpdate?.(index, 'done', message);
      return message;
    }

    // Fallback for unsupported tool kinds.
    const message = 'No executable action was needed for this part of the request.';
    onUpdate?.(index, 'done', message);
    return message;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool failed unexpectedly.';
    onUpdate?.(index, 'error', undefined, message);
    throw error;
  }
}

function toolLabel(tool: PlannedTool): string {
  if (tool.type === 'browser') {
    return tool.label;
  }

  if (tool.type === 'desktop') {
    return tool.intent.label;
  }

  if (tool.type === 'web-search') {
    return tool.label;
  }

  if (tool.type === 'image-generate') {
    return tool.label;
  }

  return 'Thinking';
}
