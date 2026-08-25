/**
 * Démarre Next sur le port 3000 après avoir libéré ce port
 * (ancien `next dev` encore vivant, lock Turbopack, etc.).
 */
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listeningPids(port) {
  if (process.platform === 'win32') {
    let out = '';
    try {
      out = execSync('netstat -ano -p tcp', { encoding: 'utf8', windowsHide: true });
    } catch {
      return [];
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const local = parts[1] ?? '';
      const pid = Number(parts[parts.length - 1]);
      if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
      if (local.endsWith(`:${port}`)) pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out
      .split(/\s+/)
      .map(Number)
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', windowsHide: true });
    } catch {
      /* déjà mort */
    }
    return;
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* déjà mort */
  }
}

async function freePort(port) {
  const deadline = Date.now() + 4000;
  let killed = false;
  while (Date.now() < deadline) {
    const pids = listeningPids(port);
    if (pids.length === 0) {
      if (killed) console.log(`Port ${port} libéré.`);
      return;
    }
    for (const pid of pids) {
      console.log(`Arrêt du processus ${pid} qui occupe le port ${port}…`);
      killPid(pid);
      killed = true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

await freePort(PORT);

const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
// Webpack : Turbopack peut rester coincé à compiler indéfiniment sous Windows
// (CPU à fond, page qui ne charge jamais). `next build` / Vercel inchangés.
const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(PORT), '--webpack'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  windowsHide: false,
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
