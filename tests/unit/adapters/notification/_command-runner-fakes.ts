/**
 * A named `CommandRunner` double (docs/TESTES.md: "duplo de I/O é classe/objeto nomeado
 * implementando a porta, não stub inline") — records every `(command, args)` call it received
 * instead of ever spawning a real process. This is the seam docs/PLANO-DE-ENTREGA.md S4-T1 asks
 * for: verifying "os argumentos montados, não o toast aparecendo" (docs/TESTES.md § `notification/`)
 * without ever starting a real `powershell.exe`/`notify-send`/`osascript` — none of which `npm
 * test` may show on the screen of whoever runs it.
 */
import type {
  CommandRunner,
  DetachedCommandRunner,
  SpawnResult,
} from '@seeya-ai/engine/adapters/notification/backend.js';

export interface RecordedCommandCall {
  readonly command: string;
  readonly args: readonly string[];
}

export class RecordingCommandRunner {
  readonly calls: RecordedCommandCall[] = [];

  constructor(private readonly result: SpawnResult = { exitCode: 0, stdout: '', stderr: '' }) {}

  run: CommandRunner = (command, args) => {
    this.calls.push({ command, args: [...args] });
    return Promise.resolve(this.result);
  };
}

/**
 * V2-T8 item 4: a named `DetachedCommandRunner` double — records every call and resolves both of
 * `backend.ts#DetachedLaunch`'s own promises with fixed, injected values, so a test can assert on
 * exactly what `LinuxNotifySendBackend#sendWithClickAction` spawned AND drive its background
 * `handleClickResult` continuation deterministically, without ever spawning a real, detached
 * `notify-send`.
 */
export class RecordingDetachedCommandRunner {
  readonly calls: RecordedCommandCall[] = [];

  constructor(
    private readonly spawnedResult: boolean = true,
    private readonly closedResult: SpawnResult = { exitCode: 0, stdout: '', stderr: '' },
  ) {}

  run: DetachedCommandRunner = (command, args) => {
    this.calls.push({ command, args: [...args] });
    return {
      spawned: Promise.resolve(this.spawnedResult),
      closed: Promise.resolve(this.closedResult),
    };
  };
}
