#!/usr/bin/env node
// V2-T17 item 1(a) measurement tooling — spawns the real dev bundle (dist/electron/main.js) three
// times against a disposable home directory and reports how long each launch took from process
// spawn to the first `sessionsUpdate` IPC send. `electron/main.ts#writeStartupTiming`'s own
// docstring has the exact definition (send time, not paint time) and the reasoning behind why
// that is close enough to "the session list is on screen" for this budget — this script is the
// other half of that instrumentation: it records its own launch instant with `Date.now()` (fine
// here, D-019 only restricts packages/*/src/**, not tooling under scripts/ — same precedent as
// scripts/spike-j-measure.mjs) and subtracts the instant the app process wrote.
//
// Prerequisite: `node scripts/build.mjs` (this package) must have already produced
// dist/electron/main.js — this script never bundles on its own, so a stale bundle measures stale
// code; `docs/DESEMPENHO.md` says so in its own method section.
//
// console.*/JSON.parse without a schema: tooling outside src/, same precedent as
// scripts/build.mjs and scripts/spike-j-measure.mjs (AGENTS.md § "Registro e saída" and § "Dados
// de fora" both scope their rules to the app, not to one-off measurement scripts reading a file
// they just wrote themselves in a throwaway temp directory).
//
// Usage: `node scripts/measure-startup.mjs` (from packages/app), after `node scripts/build.mjs`.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainScript = path.join(packageRoot, 'dist', 'electron', 'main.js');

const RUNS = 3;
// Generous relative to the ~1s this file's own measurements actually saw — long enough to survive
// a loaded machine without masking a real hang as "still measuring".
const TIMEOUT_MS = 20_000;

if (!existsSync(mainScript)) {
  console.error(`${mainScript} does not exist — run "node scripts/build.mjs" first.`);
  process.exit(1);
}

function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (existsSync(filePath)) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`timed out after ${timeoutMs}ms waiting for ${filePath}`));
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

async function measureOnce(electronPath, index) {
  const workDir = mkdtempSync(path.join(tmpdir(), 'seeya-perf-startup-'));
  const home = path.join(workDir, 'home');
  const timingPath = path.join(workDir, 'timing.json');
  // Reuses the existing screenshot+quit instrumentation to make the process close itself after
  // the measurement — main.ts's own SEEYA_APP_QUIT_AFTER_MS is only read alongside
  // SEEYA_APP_SCREENSHOT_PATH today, and adding a second, unconditional "just quit" flag only for
  // this script would be more code than reusing what already exists (this task's own "não
  // otimizar, não gold-plate" instruction reads the same way for its own tooling).
  const screenshotPath = path.join(workDir, 'unused.png');

  const launchedAt = Date.now();
  const child = spawn(electronPath, [mainScript], {
    cwd: packageRoot,
    stdio: 'ignore',
    shell: false,
    env: {
      ...process.env,
      SEEYA_APP_OFFSCREEN: '1',
      SEEYA_APP_HOME_OVERRIDE: home,
      SEEYA_APP_STARTUP_TIMING_PATH: timingPath,
      SEEYA_APP_SCREENSHOT_PATH: screenshotPath,
      SEEYA_APP_QUIT_AFTER_MS: '200',
    },
  });

  try {
    await waitForFile(timingPath, TIMEOUT_MS);
    const { sessionsListSentAt } = JSON.parse(readFileSync(timingPath, 'utf8'));
    const elapsedMs = new Date(sessionsListSentAt).getTime() - launchedAt;
    console.log(`  run ${index}: ${elapsedMs}ms`);
    return elapsedMs;
  } finally {
    child.kill();
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const { default: electronPath } = await import('electron');
  console.log(`Measuring startup (${RUNS} runs)...`);
  const results = [];
  for (let index = 1; index <= RUNS; index += 1) {
    results.push(await measureOnce(electronPath, index));
  }
  const min = Math.min(...results);
  const max = Math.max(...results);
  console.log(`\nResults (ms): ${results.join(', ')}`);
  console.log(`Range: ${min}-${max}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
