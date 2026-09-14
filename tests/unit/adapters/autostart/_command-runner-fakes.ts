/**
 * A named `CommandRunner` double (docs/TESTES.md: "duplo de I/O é classe/objeto nomeado
 * implementando a porta, não stub inline"), same shape
 * `tests/unit/adapters/notification/_command-runner-fakes.ts` already established for the
 * identical port — records every `(command, args)` call and returns a scripted result instead of
 * ever spawning a real `powershell.exe`/`systemctl`/`launchctl` (AGENTS.md § "Testes": "nenhum
 * teste toca... o systemd").
 */
import type { CommandRunner, SpawnResult } from '@seeya-ai/engine/adapters/notification/backend.js';

export interface RecordedCommandCall {
  readonly command: string;
  readonly args: readonly string[];
}

export class RecordingCommandRunner {
  readonly calls: RecordedCommandCall[] = [];

  constructor(
    private readonly results: SpawnResult[] = [{ exitCode: 0, stdout: '', stderr: '' }],
  ) {}

  run: CommandRunner = (command, args) => {
    this.calls.push({ command, args: [...args] });
    const result = this.results[Math.min(this.calls.length - 1, this.results.length - 1)];
    return Promise.resolve(result ?? { exitCode: 0, stdout: '', stderr: '' });
  };
}
