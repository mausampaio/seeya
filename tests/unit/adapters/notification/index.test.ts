import { describe, expect, it } from 'vitest';
import {
  buildDefaultBackends,
  buildNotifier,
  notifier,
} from '@seeya-ai/engine/adapters/notification/index.js';
import { WindowsToastBackend } from '@seeya-ai/engine/adapters/notification/windows-toast.js';
import { MacOsascriptBackend } from '@seeya-ai/engine/adapters/notification/macos-osascript.js';
import { LinuxNotifySendBackend } from '@seeya-ai/engine/adapters/notification/linux-notify-send.js';

describe('buildDefaultBackends', () => {
  it('picks WindowsToastBackend on win32', () => {
    const [backend] = buildDefaultBackends('win32');
    expect(backend).toBeInstanceOf(WindowsToastBackend);
  });

  it('picks MacOsascriptBackend on darwin', () => {
    const [backend] = buildDefaultBackends('darwin');
    expect(backend).toBeInstanceOf(MacOsascriptBackend);
  });

  it('picks LinuxNotifySendBackend on linux', () => {
    const [backend] = buildDefaultBackends('linux');
    expect(backend).toBeInstanceOf(LinuxNotifySendBackend);
  });

  it('returns no native backend for an unrecognized platform — ChainNotifier still works via stderr', () => {
    expect(buildDefaultBackends('aix')).toEqual([]);
  });

  // V2-T5b item 5: threading isProtocolHandlerRegistered still picks the same backend type —
  // the OPTION's own effect on the toast is exercised directly against WindowsToastBackend
  // (tests/unit/adapters/notification/windows-toast.test.ts), never by spawning a real
  // powershell.exe from here.
  it('still picks WindowsToastBackend on win32 when isProtocolHandlerRegistered is passed', () => {
    const [backend] = buildDefaultBackends('win32', () => Promise.resolve(true));
    expect(backend).toBeInstanceOf(WindowsToastBackend);
  });

  // V2-T8 item 4: same shape as the Windows case above — the OPTION's own effect is exercised
  // directly against LinuxNotifySendBackend (tests/unit/adapters/notification/
  // linux-notify-send.test.ts's own "send with click action" describe block).
  it('still picks LinuxNotifySendBackend on linux when isProtocolHandlerRegistered is passed', () => {
    const [backend] = buildDefaultBackends('linux', () => Promise.resolve(true));
    expect(backend).toBeInstanceOf(LinuxNotifySendBackend);
  });
});

describe('notifier', () => {
  it('is a ready-to-use singleton implementing the Notifier port', () => {
    expect(typeof notifier.notify).toBe('function');
  });
});

describe('buildNotifier', () => {
  it('returns a working Notifier, same shape as the bare singleton', () => {
    const built = buildNotifier(() => Promise.resolve(true), 'win32');
    expect(typeof built.notify).toBe('function');
  });
});
