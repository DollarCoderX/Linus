
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
    implemented: true
  },
  {
    name: 'filesystem.read',
    description: 'Read file content for user-requested tasks.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'filesystem.write',
    description: 'Create or edit files after permission checks.',
    permission: 'sensitive',
    implemented: true
  },
  {
    name: 'browser.open',
    description: 'Open the configured browser and navigate to URLs.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'browser.search',
    description: 'Search the web through the configured browser.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'web.serper_search',
    description: 'Run fast internal web, image, news, or video searches.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'image.generate',
    description: 'Generate in-app images with Pollinations or Gemini.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'vision.screenshot_analyze',
    description: 'Capture the screen and analyze it with a vision provider.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'desktop.launch_app',
    description: 'Launch Notepad, Calculator, Terminal, or File Explorer.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'desktop.open_target',
    description: 'Open a file, folder, or application by name.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'desktop.notepad_note',
    description: 'Create and save a Notepad note.',
    permission: 'safe',
    implemented: true
  },
  {
    name: 'desktop.create_folder',
    description: 'Create folders in Desktop, Documents, or Downloads.',
    permission: 'safe',
    implemented: true
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
    implemented: true
  }
];
