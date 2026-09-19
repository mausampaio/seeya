/**
 * `LinuxNotifySendBackend` (docs/spikes/B-notificacoes.md § Linux). `run` is always a
 * `RecordingCommandRunner` here — a real `notify-send` is never spawned, so this suite is
 * exercisable on any of the three CI systems (including a headless Linux container with no
 * `libnotify` installed at all — exactly the case Spike B calls out, and exactly why the real
 * OS is never asked directly here).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildNotifySendArgs,
  LinuxNotifySendBackend,
  parseNotifySendVersion,
  versionSupportsActionFlag,
} from '@seeya-ai/engine/adapters/notification/linux-notify-send.js';
import { RecordingCommandRunner, RecordingDetachedCommandRunner } from './_command-runner-fakes.js';

const NOTICE = { title: 'seeya end-day: 2026-08-16', body: '1 session captured.' };

describe('buildNotifySendArgs', () => {
  it('passes title and body as two separate argv elements, unescaped', () => {
    expect(buildNotifySendArgs(NOTICE)).toEqual([NOTICE.title, NOTICE.body]);
  });

  it('never emits an -A action flag by default — this task has no action buttons unless asked', () => {
    const args = buildNotifySendArgs({ title: 'has -A in it, literally', body: 'plain' });
    // The literal text is untouched (argv, not a shell string) — there's just no CODE path here
    // that adds a real `-A` flag anywhere in the array.
    expect(args).toHaveLength(2);
    expect(args).not.toContain('-A');
  });

  it('V2-T8 item 4: includeAction=true prepends --wait --action=default=Open', () => {
    const args = buildNotifySendArgs(NOTICE, true);

    expect(args).toEqual(['--wait', '--action=default=Open', NOTICE.title, NOTICE.body]);
  });
});

describe('parseNotifySendVersion (V2-T8 item 4)', () => {
  it('parses "notify-send 0.8.1" (measured: node:22-bookworm + libnotify-bin 0.8.1-1)', () => {
    expect(parseNotifySendVersion('notify-send 0.8.1\n')).toEqual({
      major: 0,
      minor: 8,
      patch: 1,
    });
  });

  it('returns undefined for output with no MAJOR.MINOR.PATCH substring', () => {
    expect(parseNotifySendVersion('not a version string')).toBeUndefined();
  });
});

describe('versionSupportsActionFlag (V2-T8 item 4)', () => {
  it("the task's own threshold: 0.7.10 and above support --action", () => {
    expect(versionSupportsActionFlag({ major: 0, minor: 7, patch: 10 })).toBe(true);
    expect(versionSupportsActionFlag({ major: 0, minor: 8, patch: 1 })).toBe(true);
    expect(versionSupportsActionFlag({ major: 1, minor: 0, patch: 0 })).toBe(true);
  });

  it('below 0.7.10 does not', () => {
    expect(versionSupportsActionFlag({ major: 0, minor: 7, patch: 9 })).toBe(false);
    expect(versionSupportsActionFlag({ major: 0, minor: 6, patch: 99 })).toBe(false);
  });

  it('an unparseable version never supports it (D-025: absence is not a guess in either direction)', () => {
    expect(versionSupportsActionFlag(undefined)).toBe(false);
  });
});

describe('LinuxNotifySendBackend — isAvailable', () => {
  it('is unavailable outright on a non-Linux platform, without ever probing the command', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new LinuxNotifySendBackend({ platform: 'win32', run: runner.run });

    await expect(backend.isAvailable()).resolves.toBe(false);
    expect(runner.calls).toHaveLength(0);
  });

  it('is available on linux when the probe exits 0', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '1.2.3', stderr: '' });
    const backend = new LinuxNotifySendBackend({ platform: 'linux', run: runner.run });

    await expect(backend.isAvailable()).resolves.toBe(true);
    expect(runner.calls[0]?.args).toEqual(['--version']);
  });

  it('is unavailable on linux when the probe exits non-zero (installed but broken)', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 1, stdout: '', stderr: 'error' });
    const backend = new LinuxNotifySendBackend({ platform: 'linux', run: runner.run });

    await expect(backend.isAvailable()).resolves.toBe(false);
  });

  it('is unavailable on linux when the command does not exist at all (Spike B: headless server)', async () => {
    const throwingRun = () => Promise.reject(new Error('spawn notify-send ENOENT'));
    const backend = new LinuxNotifySendBackend({ platform: 'linux', run: throwingRun });

    await expect(backend.isAvailable()).resolves.toBe(false);
  });

  it('never claims to support actions', () => {
    expect(new LinuxNotifySendBackend().supportsActions()).toBe(false);
  });
});

describe('LinuxNotifySendBackend — send', () => {
  it('spawns the configured command with the exact notify-send arguments', async () => {
    const runner = new RecordingCommandRunner();
    const backend = new LinuxNotifySendBackend({ command: 'fake-notify-send', run: runner.run });

    await backend.send(NOTICE);

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.command).toBe('fake-notify-send');
    expect(runner.calls[0]?.args).toEqual(buildNotifySendArgs(NOTICE));
  });

  it('throws when notify-send exits non-zero, with the raw stderr in the message', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 1, stdout: '', stderr: 'no such bus' });
    const backend = new LinuxNotifySendBackend({ run: runner.run });

    await expect(backend.send(NOTICE)).rejects.toThrow(/exited 1.*no such bus/s);
  });
});

describe('LinuxNotifySendBackend — send with click action (V2-T8 item 4)', () => {
  it('falls back to the plain toast when the protocol marker is not registered', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner();
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve(null),
    });

    await backend.send(NOTICE);

    expect(detached.calls).toHaveLength(0);
    expect(runner.calls[0]?.args).toEqual(buildNotifySendArgs(NOTICE));
  });

  it('falls back to the plain toast when notify-send is older than 0.7.10', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.7.9', stderr: '' });
    const detached = new RecordingDetachedCommandRunner();
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve('seeya'),
    });

    await backend.send(NOTICE);

    expect(detached.calls).toHaveLength(0);
  });

  it('spawns detached with --wait --action=default=Open when registered and version-capable', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner(true, {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
    const backend = new LinuxNotifySendBackend({
      command: 'fake-notify-send',
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve('seeya'),
    });

    await backend.send(NOTICE);

    expect(detached.calls).toHaveLength(1);
    expect(detached.calls[0]?.command).toBe('fake-notify-send');
    expect(detached.calls[0]?.args).toEqual(buildNotifySendArgs(NOTICE, true));
    // The plain (non-detached) runner is only ever used for the --version probe here, never to
    // actually show the toast — sendWithClickAction uses spawnDetached for that.
    expect(runner.calls.every((call) => call.args[0] === '--version')).toBe(true);
  });

  it('throws when the detached spawn never actually started', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner(false);
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve('seeya'),
    });

    await expect(backend.send(NOTICE)).rejects.toThrow(/failed to start/);
  });

  it('opens seeya://open via xdg-open once the "default" action comes back on stdout', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner(true, {
      exitCode: 0,
      stdout: 'default\n',
      stderr: '',
    });
    const openProtocolUrl = vi.fn(() => Promise.resolve());
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve('seeya'),
      openProtocolUrl,
    });

    await backend.send(NOTICE);
    // handleClickResult runs as a background continuation off `launch.closed` — a microtask tick
    // is enough since RecordingDetachedCommandRunner resolves both promises synchronously.
    await Promise.resolve();
    await Promise.resolve();

    expect(openProtocolUrl).toHaveBeenCalledWith('seeya://open');
  });

  // V2-T10 item 2: a marker naming the dev scheme opens the dev URL — never the packaged one.
  it('opens seeya-dev://open when the active scheme is "seeya-dev"', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner(true, {
      exitCode: 0,
      stdout: 'default\n',
      stderr: '',
    });
    const openProtocolUrl = vi.fn(() => Promise.resolve());
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve('seeya-dev'),
      openProtocolUrl,
    });

    await backend.send(NOTICE);
    await Promise.resolve();
    await Promise.resolve();

    expect(openProtocolUrl).toHaveBeenCalledWith('seeya-dev://open');
  });

  it('never opens the URL when the notification was dismissed or timed out (empty stdout)', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner(true, {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
    const openProtocolUrl = vi.fn(() => Promise.resolve());
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve('seeya'),
      openProtocolUrl,
    });

    await backend.send(NOTICE);
    await Promise.resolve();
    await Promise.resolve();

    expect(openProtocolUrl).not.toHaveBeenCalled();
  });

  it('a failing openProtocolUrl is swallowed (best-effort, nothing left to report to)', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner(true, {
      exitCode: 0,
      stdout: 'default',
      stderr: '',
    });
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.resolve('seeya'),
      openProtocolUrl: () => Promise.reject(new Error('xdg-open missing')),
    });

    await expect(backend.send(NOTICE)).resolves.toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('a throwing activeProtocolScheme reads as "no scheme" (never crashes send)', async () => {
    const runner = new RecordingCommandRunner({ exitCode: 0, stdout: '0.8.1', stderr: '' });
    const detached = new RecordingDetachedCommandRunner();
    const backend = new LinuxNotifySendBackend({
      run: runner.run,
      spawnDetached: detached.run,
      activeProtocolScheme: () => Promise.reject(new Error('storage unavailable')),
    });

    await expect(backend.send(NOTICE)).resolves.toBeUndefined();
    expect(detached.calls).toHaveLength(0);
  });
});
