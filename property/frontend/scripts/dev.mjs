import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkInterfaces } from 'node:os';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.resolve(frontendDir, '..', 'backend');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm executable was not found.');
const runNpm = (args, cwd, env = process.env) => spawn(process.execPath, [npmCli, ...args], { cwd, env, stdio: 'inherit' });
const addresses = Object.values(networkInterfaces()).flat().filter((address) => address?.family === 'IPv4' && !address.internal);
const lanAddress = addresses.find((address) => address.address.startsWith('192.168.'))?.address
  ?? addresses.find((address) => address.address.startsWith('10.'))?.address
  ?? addresses.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address.address))?.address;
const lanUrl = lanAddress ? `http://${lanAddress}:5174` : 'http://localhost:5174';

function isPortRunning(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

const children = [];
if (!(await isPortRunning(3001))) {
  children.push(runNpm(['run', 'dev'], backendDir, {
    ...process.env,
    FRONTEND_URL: lanUrl,
    FRONTEND_URLS: `${lanUrl},http://localhost:5174,http://127.0.0.1:5174`,
  }));
}

const frontend = await isPortRunning(5174) ? null : runNpm(['run', 'dev:frontend'], frontendDir);
if (frontend) children.push(frontend);
else console.log('Frontend is already running on port 5174.');
console.log(`HomeLink: ${lanUrl}`);

function stop() {
  for (const child of children) if (!child.killed) child.kill();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
frontend?.on('exit', (code) => { stop(); process.exitCode = code ?? 0; });
