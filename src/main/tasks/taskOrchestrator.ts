import type { LinusEnv } from '../config/env';
import type { LinusTaskPreview, ParallelTask, LinusToolResult } from '../../shared/linus';
import type { BrowserAutomation } from '../browser/browserAutomation';
import type { PlannedTool, PlannedToolBatch } from './toolPlanner';
import { executeToolBatch, type ToolExecutionContext } from './parallelExecutor';

export interface OrchestratorContext {
  browserAutomation: BrowserAutomation;
  env: LinusEnv;
  appDataRoot: string;
}

export interface OrchestrationResult {
  aggregateSummary: string;
  results: LinusToolResult[];
  parallelTasks: ParallelTask[];
}

const MAX_BATCH = 9;

/**
 * Orchestrates a planned tool batch.
 * Runs independent tools in parallel, grouping by mode.
 */
export async function orchestrateTask(
  batch: PlannedToolBatch,
  context: OrchestratorContext
): Promise<OrchestrationResult> {
  const parallelTasks: ParallelTask[] = [];
  const results: LinusToolResult[] = [];
  const aggregateParts: string[] = [];

  const tools = batch.tools.filter((tool) => tool.type !== 'chat');

  // Sequential: run tools one at a time in order.
  if (batch.mode === 'sequential' && tools.length > 1) {
    for (const tool of tools) {
      await runSingle(tool, context, parallelTasks, results, aggregateParts);
    }
    return {
      aggregateSummary: aggregateParts.join('\n'),
      results,
      parallelTasks
    };
  }

  // Parallel or single-tool: run all in one batch.
  if (tools.length > 0) {
    await runBatch(tools, context, parallelTasks, results, aggregateParts);
  }

  // Mixed: split into parallel chunks of up to MAX_BATCH.
  if (batch.mode === 'mixed') {
    for (let i = 0; i < tools.length; i += MAX_BATCH) {
      const chunk = tools.slice(i, i + MAX_BATCH);
      await runBatch(chunk, context, parallelTasks, results, aggregateParts);
    }
  }

  return {
    aggregateSummary: aggregateParts.join('\n'),
    results,
    parallelTasks
  };
}

async function runSingle(
  tool: PlannedTool,
  context: OrchestratorContext,
  parallelTasks: ParallelTask[],
  results: LinusToolResult[],
  aggregateParts: string[]
): Promise<void> {
  const id = `task-${parallelTasks.length}`;
  const task = newParallelTask(id, tool);
  parallelTasks.push(task);

  const taskContext: ToolExecutionContext = {
    browserAutomation: context.browserAutomation,
    env: context.env,
    appDataRoot: context.appDataRoot
  };

  const execResults = await executeToolBatch([tool], taskContext, (index, status, result, error) => {
    const current = parallelTasks[parallelTasks.length - 1];
    if (current) {
      current.status = status;
      if (result) {
        current.result = result;
      }
      if (error) {
        current.error = error;
      }
    }
  });

  const execResult = execResults[0];
  results.push(execResult);

  if (execResult.success && execResult.result) {
    aggregateParts.push(`${labelFor(tool)}: ${execResult.result}`);
  } else if (execResult.error) {
    aggregateParts.push(`${labelFor(tool)}: failed (${execResult.error})`);
  }
}

async function runBatch(
  tools: PlannedTool[],
  context: OrchestratorContext,
  parallelTasks: ParallelTask[],
  results: LinusToolResult[],
  aggregateParts: string[]
): Promise<void> {
  const batchStartIndex = parallelTasks.length;

  tools.forEach((tool) => {
    const id = `task-${parallelTasks.length}`;
    parallelTasks.push(newParallelTask(id, tool));
  });

  const taskContext: ToolExecutionContext = {
    browserAutomation: context.browserAutomation,
    env: context.env,
    appDataRoot: context.appDataRoot
  };

  const execResults = await executeToolBatch(tools, taskContext, (index, status, result, error) => {
    const task = parallelTasks[batchStartIndex + index];
    if (task) {
      task.status = status;
      if (result) {
        task.result = result;
      }
      if (error) {
        task.error = error;
      }
    }
  });

  execResults.forEach((execResult, index) => {
    results.push(execResult);
    const task = parallelTasks[batchStartIndex + index];
    if (task) {
      task.status = execResult.success ? 'done' : 'error';
      if (execResult.error) {
        task.error = execResult.error;
      }
    }

    const tool = tools[index];
    if (execResult.success && execResult.result) {
      aggregateParts.push(`${labelFor(tool)}: ${execResult.result}`);
    } else if (execResult.error) {
      aggregateParts.push(`${labelFor(tool)}: failed (${execResult.error})`);
    }
  });
}

function newParallelTask(id: string, tool: PlannedTool): ParallelTask {
  return {
    id,
    tool: tool.type,
    label: labelFor(tool),
    status: 'queued'
  };
}

function labelFor(tool: PlannedTool): string {
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

export function buildPreviewFromOrchestration(
  orchestration: OrchestrationResult,
  statusText: string,
  model: string
): LinusTaskPreview {
  const doneCount = orchestration.parallelTasks.filter((task) => task.status === 'done').length;
  const totalCount = orchestration.parallelTasks.length;
  const errorCount = orchestration.parallelTasks.filter((task) => task.status === 'error').length;

  return {
    statusText,
    responseText: orchestration.aggregateSummary || 'Tasks completed.',
    providerName: 'Linus',
    model,
    kind: 'tool',
    parallelTasks: orchestration.parallelTasks,
    steps: [
      { id: 'understand', label: 'Understood request', status: 'done' },
      { id: 'plan', label: `Planned ${totalCount} tool(s)`, status: 'done' },
      {
        id: 'execute',
        label: `Executed ${doneCount} of ${totalCount} tool(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        status: 'done'
      },
      { id: 'verify', label: 'Verified tool results', status: 'done' },
      { id: 'respond', label: 'Prepared response', status: 'done' }
    ]
  };
}
