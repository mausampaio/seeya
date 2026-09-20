/**
 * `AppInstallation` for macOS (V2-T13, D-045 item 2): looks for the `.app` bundle in
 * `/Applications` — no registry, no package manager, the plain mechanism D-045's own text names
 * ("no macOS, o app em Aplicativos"). **Not measured against a real install**
 * (docs/QUESTOES.md Q-081: only Windows was measured for this task, same disclaimer
 * `adapters/autostart/macos.ts` already carries for the identical reason) — exercised in unit
 * tests only with an injected `pathExists`, never a real filesystem check against `/Applications`.
 */
import path from 'node:path';
import fs from 'node:fs';
import type { AppInstallation, AppInstallationStatus } from '../../core/ports.js';

/** `packages/app/electron-builder.yml`'s own `productName` — the `.app` bundle's own directory
 * name, and (by macOS's own convention) its executable's directory inside `Contents/MacOS/`. */
const PRODUCT_NAME = 'seeya';

export interface MacosAppInstallationOptions {
  /** Defaults to `/Applications`. Overridable so a test never touches the real one. */
  readonly applicationsDir?: string;
  readonly pathExists?: (candidatePath: string) => boolean;
}

export class MacosAppInstallation implements AppInstallation {
  private readonly bundlePath: string;
  private readonly executablePath: string;
  private readonly pathExists: (candidatePath: string) => boolean;

  constructor(options: MacosAppInstallationOptions = {}) {
    const applicationsDir = options.applicationsDir ?? '/Applications';
    this.bundlePath = path.join(applicationsDir, `${PRODUCT_NAME}.app`);
    this.executablePath = path.join(this.bundlePath, 'Contents', 'MacOS', PRODUCT_NAME);
    this.pathExists = options.pathExists ?? fs.existsSync;
  }

  find(): Promise<AppInstallationStatus> {
    try {
      return Promise.resolve(
        this.pathExists(this.bundlePath)
          ? { kind: 'installed', executablePath: this.executablePath }
          : { kind: 'notInstalled' },
      );
    } catch (error) {
      // fs.existsSync itself never throws for an ordinary missing path, but a caller-supplied
      // `pathExists` (a test double, or a future non-fs backed check) might for other reasons —
      // D-025: a check that failed to answer is `unknown`, never guessed either way.
      return Promise.resolve({
        kind: 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
