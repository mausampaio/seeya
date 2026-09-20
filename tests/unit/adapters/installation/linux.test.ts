/**
 * `LinuxAppInstallation` (V2-T13, D-045 item 2). **Not measured against a real `.deb` install**
 * (docs/QUESTOES.md Q-081: only Windows was measured for this task) — every process call here is
 * faked, per AGENTS.md § "Testes": "nenhum teste toca... o dpkg".
 */
import { describe, expect, it } from 'vitest';
import { LinuxAppInstallation } from '@seeya-ai/engine/adapters/installation/linux.js';
import { RecordingCommandRunner } from '../autostart/_command-runner-fakes.js';

describe('LinuxAppInstallation#find', () => {
  it('dpkg-query reports "install ok installed" → installed, at the conventional /usr/bin path', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: 'install ok installed\n0.1.0\n', stderr: '' },
    ]);
    const installation = new LinuxAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toEqual({
      kind: 'installed',
      executablePath: '/usr/bin/seeya',
    });
    expect(runner.calls).toEqual([
      { command: 'dpkg-query', args: ['-W', '-f=${Status}\n${Version}\n', 'seeya'] },
    ]);
  });

  it('dpkg-query exits non-zero with "no packages found matching" → notInstalled, not an error', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'dpkg-query: no packages found matching seeya\n' },
    ]);
    const installation = new LinuxAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toEqual({ kind: 'notInstalled' });
  });

  it('an AppImage run (never registered with dpkg) reads exactly the same as no package known', async () => {
    // Same shape as the previous test on purpose — this IS "AppImage nunca é dono" (D-045),
    // falling out of the ordinary dpkg answer rather than a special case this adapter checks for.
    const runner = new RecordingCommandRunner([
      { exitCode: 1, stdout: '', stderr: 'dpkg-query: no packages found matching seeya\n' },
    ]);
    const installation = new LinuxAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toEqual({ kind: 'notInstalled' });
  });

  it('status "deinstall ok config-files" (removed but not purged) → notInstalled', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: 'deinstall ok config-files\n0.1.0\n', stderr: '' },
    ]);
    const installation = new LinuxAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toEqual({ kind: 'notInstalled' });
  });

  it('an unrecognized Status line → unknown, never guessed (D-025)', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 0, stdout: 'something dpkg never documented\n', stderr: '' },
    ]);
    const installation = new LinuxAppInstallation({ run: runner.run });

    await expect(installation.find()).resolves.toMatchObject({ kind: 'unknown' });
  });

  it('dpkg-query exiting non-zero for an unrelated reason → unknown, with the raw stderr', async () => {
    const runner = new RecordingCommandRunner([
      { exitCode: 2, stdout: '', stderr: 'dpkg-query: error: some other failure' },
    ]);
    const installation = new LinuxAppInstallation({ run: runner.run });

    const status = await installation.find();
    expect(status.kind).toBe('unknown');
    expect(status.kind === 'unknown' && status.error).toContain('some other failure');
  });

  it('dpkg-query itself never spawning (no dpkg on this distro) → unknown, never thrown', async () => {
    const installation = new LinuxAppInstallation({
      run: () => Promise.reject(new Error('spawn dpkg-query ENOENT')),
    });

    await expect(installation.find()).resolves.toMatchObject({ kind: 'unknown' });
  });
});
