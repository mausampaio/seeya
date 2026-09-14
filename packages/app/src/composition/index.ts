/**
 * The app's composition root (D-020, emended by D-043: "cli/ e app/ são as duas raízes de
 * composição"). Mirrors `packages/cli/src/composition.ts`'s own shape and docstring — the only
 * module in `packages/app/src` allowed to name a concrete engine adapter and wire it behind a
 * port, and the only one allowed to call `os.homedir()`/read `process.env`/`process.platform`
 * directly. `electron/main.ts` calls `buildAppContext` once, at startup, with the real home
 * directory; nothing else in `packages/app/src` reaches for the real filesystem or environment on
 * its own.
 *
 * **Reuses `@seeya-ai/engine/adapters/resumption/env.js#buildResumptionEnv` directly, not by
 * copy** (docs/PLANO-DE-ENTREGA.md V2-T2, item 3: "pela mesma função que o `start-day` já usa"),
 * even though that module isn't re-exported by `adapters/resumption/index.ts` — the engine's
 * package export map (`./adapters/*.js`) resolves any path under `adapters/`, not just each
 * adapter's own `index.ts`, so this is still a legitimate public-subpath import, not a reach past
 * the package boundary the `app-only-imports-engine-public-subpaths` guard would reject (that
 * guard only tells a `packages/engine/dist/**` resolution apart from a raw
 * `packages/engine/src/**` one — see `.dependency-cruiser.cjs`'s own comment).
 */
import os from 'node:os';
import path from 'node:path';
import { systemClock } from '@seeya-ai/engine/adapters/clock/index.js';
import { buildResumptionEnv } from '@seeya-ai/engine/adapters/resumption/env.js';
import type { Clock } from '@seeya-ai/engine/core/ports.js';
import { NodePtyAdapter } from '../pty/node-pty-adapter.js';
import { PtyManager, type PtyManagerCallbacks } from '../pty/pty-manager.js';
import { defaultShellCommand, type ShellCommand } from '../pty/default-shell.js';

export interface AppHome {
  readonly claudeHome: string;
  readonly seeyaHome: string;
}

/** Mirrors `packages/cli/src/composition.ts#resolveCliHome` exactly — the same two directories,
 * resolved the same way (`os.homedir()` read once, here). */
export function resolveAppHome(homeDir: string = os.homedir()): AppHome {
  return {
    claudeHome: path.join(homeDir, '.claude'),
    seeyaHome: path.join(homeDir, '.seeya'),
  };
}

export interface AppContext {
  readonly clock: Clock;
  readonly home: AppHome;
  /** The raw home directory (`os.homedir()`) — what a tab's cwd defaults to when the person
   * leaves the directory field blank (`electron/main.ts`'s own `createTab` handler). */
  readonly homeDir: string;
  /** The environment a tab's process should spawn with — already cleaned of inherited
   * `CLAUDE*`/`AI_AGENT` session variables (D-017), computed once so every `createTab` call reuses
   * the same base instead of re-deriving it. */
  readonly tabEnv: NodeJS.ProcessEnv;
  readonly defaultShell: ShellCommand;
  buildPtyManager(callbacks: PtyManagerCallbacks): PtyManager;
}

/**
 * Builds everything `electron/main.ts` needs, reading the real `process.env`/`process.platform`
 * exactly once (mirrors `packages/cli/src/composition.ts#buildCliContext`'s own "read once" shape).
 */
export function buildAppContext(homeDir: string = os.homedir()): AppContext {
  const home = resolveAppHome(homeDir);
  return {
    clock: systemClock,
    home,
    homeDir,
    tabEnv: buildResumptionEnv(process.env),
    defaultShell: defaultShellCommand(process.platform, process.env),
    buildPtyManager: (callbacks) => new PtyManager(new NodePtyAdapter(), callbacks),
  };
}
