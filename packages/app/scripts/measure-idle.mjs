#!/usr/bin/env node
// V2-T17 item 1(b)/(c) measurement tooling — launches the real dev bundle ONCE (Windows only, see
// process-tree-stats.ps1) against a disposable home directory, with a window open and no tabs,
// then samples the whole process tree three times over three back-to-back 60-second idle windows
// (nobody touches the window; `docs/DESEMPENHO.md` has the full method and why one continuous run
// was chosen over three separate launches — steady-state "at rest" behavior, not launch variance,
// is what (b)/(c) are about, and re-launching three times would only add three more cold-start
// artifacts this task isn't trying to measure). Reports, for each window: the memory (working
// set) sampled at its start, and the CPU time consumed by the whole tree during it.
//
// console.*/JSON.parse without a schema: tooling outside src/, same precedent as
// scripts/measure-startup.mjs (this directory's own file has the fuller reasoning).
//
// Usage: `node scripts/measure-idle.mjs` (from packages/app), after `node scripts/build.mjs`.
// Windows only — process-tree-stats.ps1 is PowerShell; a Linux/macOS equivalent is out of this
// task's own scope (docs/PLANO-DE-ENTREGA.md V2-T17 "o que não entra").

import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainScript = path.join(packageRoot, 'dist', 'electron', 'main.js');
const statsScript = path.join(packageRoot, 'scripts', 'process-tree-stats.ps1');

const SETTLE_MS = 15_000;
const WINDOW_MS = 60_000;
const WINDOWS = 3;

if (process.platform !== 'win32') {
  console.error('measure-idle.mjs only runs on Windows (process-tree-stats.ps1 is PowerShell).');
  process.exit(1);
}
if (!existsSync(mainScript)) {
  console.error(`${mainScript} does not exist — run "node scripts/build.mjs" first.`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function treeStats(rootPid) {
  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      statsScript,
      '-RootProcessId',
      String(rootPid),
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `process-tree-stats.ps1 exited with ${String(result.status)}: ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout);
}

async function main() {
  const { default: electronPath } = await import('electron');
  const home = mkdtempSync(path.join(tmpdir(), 'seeya-perf-idle-'));

  console.log('Launching the app (window open, no tabs)...');
  const child = spawn(electronPath, [mainScript], {
    cwd: packageRoot,
    stdio: 'ignore',
    shell: false,
    env: {
      ...process.env,
      SEEYA_APP_OFFSCREEN: '1',
      SEEYA_APP_HOME_OVERRIDE: home,
    },
  });
  const rootPid = child.pid;

  try {
    console.log(`Settling for ${SETTLE_MS}ms (past the first refresh tick)...`);
    await sleep(SETTLE_MS);

    const memorySamplesBytes = [];
    const cpuPercentSamples = [];
    for (let index = 1; index <= WINDOWS; index += 1) {
      const start = treeStats(rootPid);
      memorySamplesBytes.push(start.workingSetBytes);
      console.log(
        `Window ${index}/${WINDOWS}: ${start.processCount} processes, ` +
          `${(start.workingSetBytes / 1024 / 1024).toFixed(1)}MiB at rest — sampling CPU for ${WINDOW_MS}ms...`,
      );
      await sleep(WINDOW_MS);
      const end = treeStats(rootPid);
      const cpuDeltaSeconds = end.cpuSeconds - start.cpuSeconds;
      const percentOfOneCore = (cpuDeltaSeconds / (WINDOW_MS / 1000)) * 100;
      cpuPercentSamples.push(percentOfOneCore);
      console.log(
        `  CPU consumed: ${cpuDeltaSeconds.toFixed(2)}s (${percentOfOneCore.toFixed(2)}% of one core)`,
      );
    }

    console.log(
      '\nMemory (working set, MiB):',
      memorySamplesBytes.map((b) => (b / 1024 / 1024).toFixed(1)),
    );
    console.log(
      'Memory range (MiB):',
      (Math.min(...memorySamplesBytes) / 1024 / 1024).toFixed(1),
      '-',
      (Math.max(...memorySamplesBytes) / 1024 / 1024).toFixed(1),
    );
    console.log(
      'Idle CPU (% of one core):',
      cpuPercentSamples.map((p) => p.toFixed(2)),
    );
    console.log(
      'Idle CPU range (%):',
      Math.min(...cpuPercentSamples).toFixed(2),
      '-',
      Math.max(...cpuPercentSamples).toFixed(2),
    );
  } finally {
    // taskkill /T kills the whole tree — a plain child.kill() only signals the root process,
    // which measured (this task) leaves Electron's own gpu/renderer/utility children orphaned on
    // Windows. Best-effort: a failed kill here just leaves this script's own disposable instance
    // running, never the maintainer's real installed app (a different root pid entirely — this
    // script's own docstring on process-tree-stats.ps1 has the full reasoning).
    spawnSync('taskkill', ['/PID', String(rootPid), '/T', '/F'], { stdio: 'ignore' });
    rmSync(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
