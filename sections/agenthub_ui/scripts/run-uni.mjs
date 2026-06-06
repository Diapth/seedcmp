import { spawn } from 'node:child_process';
import path from 'node:path';

const cwd = process.cwd();
const env = {
  ...process.env,
  UNI_INPUT_DIR: process.env.UNI_INPUT_DIR || cwd
};

const isWindows = process.platform === 'win32';
const bin = path.join(cwd, 'node_modules', '.bin', isWindows ? 'uni.cmd' : 'uni');
const args = process.argv.slice(2);

const child = spawn(bin, args, {
  cwd,
  env,
  stdio: 'inherit',
  shell: isWindows
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
