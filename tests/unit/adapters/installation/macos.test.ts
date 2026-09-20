/**
 * `MacosAppInstallation` (V2-T13, D-045 item 2). **Not measured against a real `.app` install**
 * (docs/QUESTOES.md Q-081: only Windows was measured for this task) — `pathExists` is always
 * injected here, never a real `/Applications` check (AGENTS.md § "Testes").
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MacosAppInstallation } from '@seeya-ai/engine/adapters/installation/macos.js';

const APPLICATIONS_DIR = '/Applications';
// Built with `path.join`, same as `MacosAppInstallation` itself — host-independent, same reasoning
// `tests/unit/adapters/autostart/macos.test.ts`'s own `PLIST_PATH` already uses.
const BUNDLE_PATH = path.join(APPLICATIONS_DIR, 'seeya.app');
const EXECUTABLE_PATH = path.join(BUNDLE_PATH, 'Contents', 'MacOS', 'seeya');

describe('MacosAppInstallation#find', () => {
  it('the bundle exists → installed, at Contents/MacOS/seeya', async () => {
    const installation = new MacosAppInstallation({
      applicationsDir: APPLICATIONS_DIR,
      pathExists: (candidatePath) => candidatePath === BUNDLE_PATH,
    });

    await expect(installation.find()).resolves.toEqual({
      kind: 'installed',
      executablePath: EXECUTABLE_PATH,
    });
  });

  it('no bundle at that path → notInstalled', async () => {
    const installation = new MacosAppInstallation({
      applicationsDir: APPLICATIONS_DIR,
      pathExists: () => false,
    });

    await expect(installation.find()).resolves.toEqual({ kind: 'notInstalled' });
  });

  it('a custom applicationsDir (test-only) is honored, never a hardcoded real path', async () => {
    const fakeApplicationsDir = path.join('tmp', 'fake-applications');
    const fakeBundlePath = path.join(fakeApplicationsDir, 'seeya.app');
    const installation = new MacosAppInstallation({
      applicationsDir: fakeApplicationsDir,
      pathExists: (candidatePath) => candidatePath === fakeBundlePath,
    });

    await expect(installation.find()).resolves.toEqual({
      kind: 'installed',
      executablePath: path.join(fakeBundlePath, 'Contents', 'MacOS', 'seeya'),
    });
  });

  it('pathExists throwing → unknown, never guessed either way (D-025)', async () => {
    const installation = new MacosAppInstallation({
      pathExists: () => {
        throw new Error('permission denied');
      },
    });

    const status = await installation.find();
    expect(status.kind).toBe('unknown');
    expect(status.kind === 'unknown' && status.error).toContain('permission denied');
  });
});
