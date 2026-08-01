const { spawn } = require('node:child_process');

const command = process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite';
const args = process.argv.slice(2);
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(command, args, {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
