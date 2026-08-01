export interface TerminalRunRequest {
  shell: 'powershell' | 'cmd';
  command: string;
  cwd?: string;
}

export interface TerminalRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class TerminalTool {
  async run(_request: TerminalRunRequest): Promise<TerminalRunResult> {
    throw new Error('TODO Phase 3: implement command validation, permission checks, and output capture.');
  }
}
