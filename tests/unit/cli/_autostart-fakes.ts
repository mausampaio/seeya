/**
 * A named `Autostart` double (docs/TESTES.md: "duplo de I/O é classe/objeto nomeado implementando
 * a porta, não stub inline"), shared by every test that needs `StatusCommandContext.autostart`
 * but isn't itself testing autostart behavior — `status()` always answers `disabled` unless a
 * scripted status is passed in, and `enable`/`disable` are never called by any of those tests.
 */
import type { Autostart, AutostartStatus } from '../../../src/core/ports.js';

export class FakeAutostart implements Autostart {
  constructor(private readonly scriptedStatus: AutostartStatus = { kind: 'disabled' }) {}

  status(): Promise<AutostartStatus> {
    return Promise.resolve(this.scriptedStatus);
  }

  enable(): ReturnType<Autostart['enable']> {
    return Promise.reject(new Error('not exercised — this fake is status-only'));
  }

  disable(): ReturnType<Autostart['disable']> {
    return Promise.reject(new Error('not exercised — this fake is status-only'));
  }
}
