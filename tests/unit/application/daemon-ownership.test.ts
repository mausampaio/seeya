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

// V2-T25 (D-045 item 1's bug fix): the app's own launchPath throughout these fixtures.
const APP_OWNER = { kind: 'app', launchPath: 'C:\\seeya.exe' } as const;
const OTHER_BINARY = 'C:\\Users\\dev\\node.exe';

describe('shouldOfferDaemonOwnershipTransition', () => {
  it('app owner, never answered, a daemon launched by a DIFFERENT binary is alive → true', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: OTHER_BINARY,
        cliAutostartRegisteredPath: undefined,
        platform: 'win32',
      }),
    ).toBe(true);
  });

  it('app owner, never answered, autostart registered to a DIFFERENT binary (no live daemon) → true', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: false,
        cliDaemonLaunchedBy: undefined,
        cliAutostartRegisteredPath: OTHER_BINARY,
        platform: 'win32',
      }),
    ).toBe(true);
  });

  it('app owner, never answered, but nothing is registered/alive at all → false (nothing to ask about)', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: false,
        cliDaemonLaunchedBy: undefined,
        cliAutostartRegisteredPath: undefined,
        platform: 'win32',
      }),
    ).toBe(false);
  });

  // V2-T25's own bug fix, items 1/3/4 — the app's own already-running daemon/already-registered
  // autostart must never trigger the "found someone else's" question.
  it("autostart pointing at the app's OWN binary → false, does not offer (item 4, test 1)", () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: false,
        cliDaemonLaunchedBy: undefined,
        cliAutostartRegisteredPath: 'C:\\seeya.exe',
        platform: 'win32',
      }),
    ).toBe(false);
  });

  it('autostart pointing at a DIFFERENT binary → true, offers (item 4, test 2)', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: false,
        cliDaemonLaunchedBy: undefined,
        cliAutostartRegisteredPath: OTHER_BINARY,
        platform: 'win32',
      }),
    ).toBe(true);
  });

  it('a live lock with NO launchedBy recorded → false, does not offer (item 4, test 3 — D-025: "don\'t know", never "someone else")', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: undefined,
        cliAutostartRegisteredPath: undefined,
        platform: 'win32',
      }),
    ).toBe(false);
  });

  it('a live lock launched by a DIFFERENT executable → true, offers (item 4, test 4)', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: OTHER_BINARY,
        cliAutostartRegisteredPath: undefined,
        platform: 'win32',
      }),
    ).toBe(true);
  });

  it("a live lock launched by the app's own binary AND autostart pointing at the app itself → false", () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: null,
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: 'C:\\seeya.exe',
        cliAutostartRegisteredPath: 'c:/seeya.exe',
        platform: 'win32',
      }),
    ).toBe(false);
  });

  it('already answered "declined" → false, never asked twice (D-045)', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: 'declined',
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: OTHER_BINARY,
        cliAutostartRegisteredPath: OTHER_BINARY,
        platform: 'win32',
      }),
    ).toBe(false);
  });

  it('already answered "accepted" → false, never asked twice', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: APP_OWNER,
        previousAnswer: 'accepted',
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: OTHER_BINARY,
        cliAutostartRegisteredPath: OTHER_BINARY,
        platform: 'win32',
      }),
    ).toBe(false);
  });

  it("owner is cli → false, the question is only ever the app's to ask", () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'cli' },
        previousAnswer: null,
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: OTHER_BINARY,
        cliAutostartRegisteredPath: OTHER_BINARY,
        platform: 'win32',
      }),
    ).toBe(false);
  });

  it('owner is unknown → false, D-025 applied to the transition question too', () => {
    expect(
      shouldOfferDaemonOwnershipTransition({
        owner: { kind: 'unknown' },
        previousAnswer: null,
        cliDaemonAlive: true,
        cliDaemonLaunchedBy: OTHER_BINARY,
        cliAutostartRegisteredPath: OTHER_BINARY,
        platform: 'win32',
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
