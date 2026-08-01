export type PermissionLevel = 'safe' | 'sensitive' | 'dangerous';

export interface LinusToolDefinition {
  name: string;
  description: string;
  permission: PermissionLevel;
  implemented: boolean;
}

export const initialToolRegistry: LinusToolDefinition[] = [
  {
    name: 'filesystem.list',
    description: 'List files and folders in a user-approved location.',
    permission: 'safe',
    implemented: false
  },
  {
    name: 'filesystem.read',
    description: 'Read file content for user-requested tasks.',
    permission: 'safe',
    implemented: false
  },
  {
    name: 'filesystem.write',
    description: 'Create or edit files after permission checks.',
    permission: 'sensitive',
    implemented: false
  },
  {
    name: 'browser.open',
    description: 'Open the configured browser and navigate to URLs.',
    permission: 'safe',
    implemented: false
  },
  {
    name: 'terminal.run',
    description: 'Run validated shell commands and capture output.',
    permission: 'sensitive',
    implemented: false
  },
  {
    name: 'system.screenshot',
    description: 'Capture the screen for user-requested visual tasks.',
    permission: 'safe',
    implemented: false
  }
];
