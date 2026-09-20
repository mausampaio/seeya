import { describe, expect, it } from 'vitest';
import {
  isCallerTheOwningApp,
  resolveDaemonOwner,
  shouldOfferDaemonOwnershipTransition,
} from '@seeya-ai/engine/application/daemon-ownership.js';

describe('resolveDaemonOwner', () => {
  it('installed → app, carrying the executable path as launchPath', () => {
    expect(
      resolveDaemonOwner({ kind: 'installed', executablePath: 'C:\\Program Files\\seeya.exe' }),
    ).toEqual({ kind: 'app', launchPath: 'C:\\Program Files\\seeya.exe' });
  });

  it('notInstalled → cli (v1 behavior)', () => {
    expect(resolveDaemonOwner({ kind: 'notInstalled' })).toEqual({ kind: 'cli' });
  });

  it('unknown (the OS query itself failed) → unknown, never guessed either way (D-025)', () => {
    expect(resolveDaemonOwner({ kind: 'unknown', error: 'permission denied' })).toEqual({
      kind: 'unknown',
    });
  });
});

describe('shouldOfferDaemonOwnershipTransition', () => {
  it('app owner, never answered, a CLI daemon is alive → true', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'app', launchPath: 'C:\\seeya.exe' },
        previousAnswer: null,
        cliDaemonAlive: true,
        cliAutostartEnabled: false,
      }),
    ).toBe(true);
  });

  it('app owner, never answered, CLI autostart registered (no live daemon) → true', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'app', launchPath: 'C:\\seeya.exe' },
        previousAnswer: null,
        cliDaemonAlive: false,
        cliAutostartEnabled: true,
      }),
    ).toBe(true);
  });

  it('app owner, never answered, but nothing CLI-owned exists → false (nothing to ask about)', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'app', launchPath: 'C:\\seeya.exe' },
        previousAnswer: null,
        cliDaemonAlive: false,
        cliAutostartEnabled: false,
      }),
    ).toBe(false);
  });

  it('already answered "declined" → false, never asked twice (D-045)', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'app', launchPath: 'C:\\seeya.exe' },
        previousAnswer: 'declined',
        cliDaemonAlive: true,
        cliAutostartEnabled: true,
      }),
    ).toBe(false);
  });

  it('already answered "accepted" → false, never asked twice', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'app', launchPath: 'C:\\seeya.exe' },
        previousAnswer: 'accepted',
        cliDaemonAlive: true,
        cliAutostartEnabled: true,
      }),
    ).toBe(false);
  });

  it("owner is cli → false, the question is only ever the app's to ask", () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'cli' },
        previousAnswer: null,
        cliDaemonAlive: true,
        cliAutostartEnabled: true,
      }),
    ).toBe(false);
  });

  it('owner is unknown → false, D-025 applied to the transition question too', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'unknown' },
        previousAnswer: null,
        cliDaemonAlive: true,
        cliAutostartEnabled: true,
      }),
    ).toBe(false);
  });
});

// V2-T22: the installer's own `daemon` re-launch call is made BY the app's own binary — this is
// the pure comparison that tells `runDaemonLauncher` apart the one case where D-045 item 3's
// refusal must not apply.
describe('isCallerTheOwningApp', () => {
  it('exact same string on both sides → true', () => {
    expect(
      isCallerTheOwningApp(
        { kind: 'app', launchPath: 'C:\\Program Files\\seeya\\seeya.exe' },
        'C:\\Program Files\\seeya\\seeya.exe',
        'win32',
      ),
    ).toBe(true);
  });

  it('Windows: differs only by drive-letter case and separator → still true', () => {
    expect(
      isCallerTheOwningApp(
        { kind: 'app', launchPath: 'C:\\Program Files\\seeya\\seeya.exe' },
        'c:/program files/seeya/seeya.exe',
        'win32',
      ),
    ).toBe(true);
  });

  it('Windows: differs only by a trailing separator → still true', () => {
    expect(
      isCallerTheOwningApp(
        { kind: 'app', launchPath: 'C:\\Program Files\\seeya\\seeya.exe\\' },
        'C:\\Program Files\\seeya\\seeya.exe',
        'win32',
      ),
    ).toBe(true);
  });

  it('a genuinely different binary → false, the ordinary D-045 item 3 refusal still applies', () => {
    expect(
      isCallerTheOwningApp(
        { kind: 'app', launchPath: 'C:\\Program Files\\seeya\\seeya.exe' },
        'C:\\Users\\dev\\node.exe',
        'win32',
      ),
    ).toBe(false);
  });

  it('POSIX: case is significant, unlike win32 → a case-only difference is a different path', () => {
    expect(
      isCallerTheOwningApp(
        { kind: 'app', launchPath: '/opt/Seeya/seeya' },
        '/opt/seeya/seeya',
        'posix',
      ),
    ).toBe(false);
  });

  it('owner is cli → false, there is no launchPath to compare against at all', () => {
    expect(
      isCallerTheOwningApp({ kind: 'cli' }, 'C:\\Program Files\\seeya\\seeya.exe', 'win32'),
    ).toBe(false);
  });

  it('owner is unknown → false, same reasoning as cli', () => {
    expect(
      isCallerTheOwningApp({ kind: 'unknown' }, 'C:\\Program Files\\seeya\\seeya.exe', 'win32'),
    ).toBe(false);
  });
});
