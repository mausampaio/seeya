import type { AppInstallation, AppInstallationStatus } from '@seeya-ai/engine/core/ports.js';

/**
 * Named double for `AppInstallation` (AGENTS.md § Testes: "duplo de I/O é classe/objeto nomeado
 * implementando a porta, não stub inline") — V2-T46. On Windows, the real adapter spawns
 * `powershell.exe` to walk the uninstall registry (`adapters/installation/windows.ts`); measured
 * (this task, on the machine it shipped from) at ~400ms once "warm" but ~3s on the very first
 * spawn of a test run. `composition.test.ts` passes this instead, for every `buildAppContext` call BUT the one test
 * whose whole purpose is proving the real OS wiring — see
 * `packages/app/src/composition/index.ts#BuildAppContextOverrides`'s own docstring.
 */
export class FakeAppInstallation implements AppInstallation {
  constructor(private readonly scriptedStatus: AppInstallationStatus = { kind: 'notInstalled' }) {}

  find(): Promise<AppInstallationStatus> {
    return Promise.resolve(this.scriptedStatus);
  }
}
