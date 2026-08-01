export type TaskPhase = 'understand' | 'plan' | 'execute' | 'observe' | 'verify' | 'respond';

export interface TaskLifecycleStep {
  phase: TaskPhase;
  label: string;
  completed: boolean;
}

export const defaultTaskLifecycle: TaskLifecycleStep[] = [
  { phase: 'understand', label: 'Understanding request', completed: false },
  { phase: 'plan', label: 'Planning steps', completed: false },
  { phase: 'execute', label: 'Executing action', completed: false },
  { phase: 'observe', label: 'Observing result', completed: false },
  { phase: 'verify', label: 'Verifying final state', completed: false },
  { phase: 'respond', label: 'Preparing response', completed: false }
];
