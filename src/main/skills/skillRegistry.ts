import type { SkillId, SkillOption } from '../../shared/linus';

export interface LinusSkill extends SkillOption {
  id: SkillId;
  description: string;
  capabilities: string[];
  allowedTools: string[];
  enabled: boolean;
  instructions: string;
}

export const initialSkills: LinusSkill[] = [
  {
    id: 'assistant',
    name: 'Assistant',
    description: 'General conversation, task understanding, and response drafting.',
    capabilities: ['conversation', 'summarization', 'intent-detection'],
    allowedTools: [],
    enabled: true,
    instructions: 'Act as the default balanced Linus assistant. Be useful, direct, and honest.'
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'Natural conversation without forcing tools.',
    capabilities: ['conversation', 'context'],
    allowedTools: [],
    enabled: true,
    instructions: 'Hold a natural conversation. Use tools only when the user clearly asks for action or current/local information.'
  },
  {
    id: 'planner',
    name: 'Planner',
    description: 'Breaks larger requests into tracked, verifiable steps.',
    capabilities: ['planning', 'progress-tracking', 'verification'],
    allowedTools: [],
    enabled: true,
    instructions: 'Break tasks into short steps, track progress, and focus on verification.'
  },
  {
    id: 'coder',
    name: 'Coder',
    description: 'Reads, edits, debugs, and explains software projects.',
    capabilities: ['code-reading', 'code-editing', 'test-analysis'],
    allowedTools: ['filesystem.read', 'filesystem.write', 'terminal.run'],
    enabled: true,
    instructions: 'Prioritize codebase context, exact file references, tests, and careful implementation.'
  },
  {
    id: 'browser',
    name: 'Browser',
    description: 'Searches, navigates pages, captures screenshots, and reads visible content.',
    capabilities: ['search', 'navigation', 'screenshot-analysis'],
    allowedTools: ['browser.open', 'system.screenshot'],
    enabled: true,
    instructions: 'Prefer browser/search actions for web requests and verify visible outcomes where implemented.'
  },
  {
    id: 'file-manager',
    name: 'File Manager',
    description: 'Finds, organizes, creates, edits, moves, and deletes files with permission checks.',
    capabilities: ['file-search', 'file-organization', 'file-verification'],
    allowedTools: ['filesystem.list', 'filesystem.read', 'filesystem.write'],
    enabled: true,
    instructions: 'Be precise with paths, confirm destructive actions, and verify file operations.'
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Turns questions into careful research tasks and concise summaries.',
    capabilities: ['research', 'source-synthesis'],
    allowedTools: ['browser.open'],
    enabled: true,
    instructions: 'Ask for sources when needed and separate facts from uncertainty.'
  },
  {
    id: 'writer',
    name: 'Writer',
    description: 'Drafts, rewrites, and polishes text.',
    capabilities: ['drafting', 'editing', 'tone'],
    allowedTools: [],
    enabled: true,
    instructions: 'Help write clean, natural text with strong structure and voice.'
  },
  {
    id: 'teacher',
    name: 'Teacher',
    description: 'Explains concepts and helps with study.',
    capabilities: ['teaching', 'quiz', 'study-planning'],
    allowedTools: [],
    enabled: true,
    instructions: 'Teach clearly, check understanding, and call out suspiciously fast studying with humor.'
  },
  {
    id: 'windows',
    name: 'Windows',
    description: 'Launches apps and performs supported Windows desktop actions.',
    capabilities: ['app-launch', 'notepad', 'folders'],
    allowedTools: ['application.launch', 'filesystem.write', 'browser.open'],
    enabled: true,
    instructions: 'Prefer real Windows actions for app, browser, folder, and simple note requests.'
  },
  {
    id: 'image',
    name: 'Image',
    description: 'Generates, searches, compares, and analyzes images.',
    capabilities: ['image-generation', 'image-search', 'vision'],
    allowedTools: ['image.generate', 'web.serper_images', 'vision.analyze'],
    enabled: true,
    instructions: 'Route simple image generation to fast image tools and detailed image work to stronger models when available.'
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Searches web, images, news, and videos without opening a browser.',
    capabilities: ['serper', 'news', 'videos', 'images'],
    allowedTools: ['web.serper_search'],
    enabled: true,
    instructions: 'Use internal search cards for web, image, news, and video queries where possible.'
  },
  {
    id: 'shell',
    name: 'Shell',
    description: 'Plans command-line work through a safer controlled shell model.',
    capabilities: ['powershell', 'commands', 'verification'],
    allowedTools: ['terminal.run'],
    enabled: true,
    instructions: 'Be careful with commands, explain risky actions, and verify command output before claiming success.'
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'Creates, summarizes, and organizes Linus notes.',
    capabilities: ['notes', 'summaries', 'documents'],
    allowedTools: ['filesystem.write', 'attachments.read'],
    enabled: true,
    instructions: 'Turn messy user thoughts and uploaded documents into clean useful notes.'
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Analyzes CSV, JSON, logs, and structured text.',
    capabilities: ['csv', 'json', 'logs', 'analysis'],
    allowedTools: ['attachments.read', 'filesystem.read'],
    enabled: true,
    instructions: 'Look for structure, anomalies, patterns, and concise conclusions.'
  },
  {
    id: 'voice',
    name: 'Voice',
    description: 'Voice input, speech output, and spoken interaction behavior.',
    capabilities: ['stt', 'tts', 'interruption'],
    allowedTools: ['voice.stt', 'voice.tts'],
    enabled: true,
    instructions: 'Keep spoken responses shorter and easy to understand aloud.'
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Builds repeatable local workflows and macros.',
    capabilities: ['workflow', 'macros', 'task-continuation'],
    allowedTools: ['browser.open', 'application.launch', 'filesystem.write'],
    enabled: true,
    instructions: 'Break automations into verified steps and avoid pretending unsupported actions exist.'
  }
];

export function skillOptions(): SkillOption[] {
  return initialSkills.map(({ id, name, description }) => ({ id, name, description }));
}

export function skillInstructions(id: SkillId): string {
  return initialSkills.find((skill) => skill.id === id)?.instructions ?? initialSkills[0].instructions;
}
