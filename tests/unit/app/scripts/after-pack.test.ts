/**
 * V2-T15 item 3: the guard that proves item 2's fix without a Mac. `fixSpawnHelperModeIn`'s own
 * docstring in `packages/app/scripts/after-pack.mjs` has the measurement behind why this uses a
 * FAKE `fs`-like double instead of a real temp directory + real `chmodSync`: on Windows,
 * `chmodSync` never sets an execute bit `statSync` can observe (measured directly on this
 * machine), so a real-filesystem assertion would pass on Linux/macOS CI and prove nothing on
 * `windows-latest` — the one thing a regression guard cannot do. `FakePackagedFs` below plays the
 * role of a packaged macOS app's own `app.asar.unpacked/node_modules/node-pty/prebuilds/` tree,
 * entirely in memory, so the mode decision itself is provable on every OS this suite runs on.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixSpawnHelperModeIn } from '../../../../packages/app/scripts/after-pack.mjs';
import type { SpawnHelperFs } from '../../../../packages/app/scripts/after-pack.d.mts';

const NO_EXEC_BIT = 0o100644;
const WITH_EXEC_BIT = 0o100755;

/** A minimal double for the three `node:fs` functions `fixSpawnHelperModeIn` calls — a directory
 * of files, each with its own mode, nothing else. Named for what it stands in for (AGENTS.md §
 * Testes: "duplo de I/O é classe/objeto nomeado implementando a porta"). */
class FakePackagedFs implements SpawnHelperFs {
  private readonly filesByPath: Map<string, number>;

  constructor(filesByPath: ReadonlyArray<readonly [string, number]>) {
    this.filesByPath = new Map(filesByPath);
  }

  readdirSync(dirPath: string): string[] {
    const prefix = `${dirPath}${path.sep}`;
    const names = new Set<string>();
    for (const filePath of this.filesByPath.keys()) {
      if (filePath.startsWith(prefix)) {
        names.add(filePath.slice(prefix.length).split(path.sep)[0] ?? '');
      }
    }
    if (names.size === 0) {
      throw new Error(`ENOENT: no such directory, ${dirPath}`);
    }
    return [...names];
  }

  statSync(filePath: string): { readonly mode: number } {
    const mode = this.filesByPath.get(filePath);
    if (mode === undefined) {
      throw new Error(`ENOENT: no such file, ${filePath}`);
    }
    return { mode };
  }

  chmodSync(filePath: string, mode: number): void {
    this.filesByPath.set(filePath, mode);
  }
}

const prebuildsDir = path.join('app.asar.unpacked', 'node_modules', 'node-pty', 'prebuilds');
const arm64Helper = path.join(prebuildsDir, 'darwin-arm64', 'spawn-helper');
const x64Helper = path.join(prebuildsDir, 'darwin-x64', 'spawn-helper');

describe('fixSpawnHelperModeIn', () => {
  it('chmods the darwin-arm64 spawn-helper it finds without an execute bit', () => {
    const fs = new FakePackagedFs([[arm64Helper, NO_EXEC_BIT]]);

    const fixed = fixSpawnHelperModeIn(fs, prebuildsDir);

    expect(fixed).toEqual([arm64Helper]);
    expect(fs.statSync(arm64Helper).mode & 0o111).not.toBe(0);
  });

  // Regression proof for the maintainer's own achado (docs/PLANO-DE-ENTREGA.md V2-T15): the
  // arm64/x64 split is real — this proves an already-executable sibling is left untouched, not
  // just that a broken one gets fixed.
  it('leaves an already-executable spawn-helper (e.g. darwin-x64) alone', () => {
    const fs = new FakePackagedFs([[x64Helper, WITH_EXEC_BIT]]);

    const fixed = fixSpawnHelperModeIn(fs, prebuildsDir);

    expect(fixed).toEqual([]);
    expect(fs.statSync(x64Helper).mode).toBe(WITH_EXEC_BIT);
  });

  it('fixes only the broken one when arm64 and x64 are both present', () => {
    const fs = new FakePackagedFs([
      [arm64Helper, NO_EXEC_BIT],
      [x64Helper, WITH_EXEC_BIT],
    ]);

    const fixed = fixSpawnHelperModeIn(fs, prebuildsDir);

    expect(fixed).toEqual([arm64Helper]);
  });

  it('does nothing when the prebuilds directory does not exist (win/linux packages)', () => {
    const fs = new FakePackagedFs([]);

    expect(() => fixSpawnHelperModeIn(fs, prebuildsDir)).not.toThrow();
    expect(fixSpawnHelperModeIn(fs, prebuildsDir)).toEqual([]);
  });

  it('ignores a prebuilds entry that is not a darwin-* directory', () => {
    const winHelper = path.join(prebuildsDir, 'win32-x64', 'spawn-helper');
    const fs = new FakePackagedFs([[winHelper, NO_EXEC_BIT]]);

    expect(fixSpawnHelperModeIn(fs, prebuildsDir)).toEqual([]);
  });

  it('skips a darwin-* directory with no spawn-helper file inside it', () => {
    const otherFile = path.join(prebuildsDir, 'darwin-arm64', 'pty.node');
    const fs = new FakePackagedFs([[otherFile, NO_EXEC_BIT]]);

    expect(fixSpawnHelperModeIn(fs, prebuildsDir)).toEqual([]);
  });
});
