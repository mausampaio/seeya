import { describe, expect, it } from 'vitest';
import {
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
