/**
 * One notification backend in Spike B's fallback chain (docs/spikes/B-notificacoes.md), and the
 * `CommandRunner` seam every real backend spawns its external command through.
 */
import { spawnHidden } from '../process/spawn.js';
import type { Notice } from '../../core/ports.js';

/**
 * Declares its own availability instead of `ChainNotifier` (`chain.ts`) asking the OS directly —
 * the seam docs/PLANO-DE-ENTREGA.md S4-T1 asks for ("injete o detector de disponibilidade em vez
 * de perguntar ao SO no meio da lógica"), so the chain's own selection logic
 * (`ChainNotifier#notify`) is testable with fakes, on any OS the CI runs on — the S2-T1 lesson
 * applied here: a test that only passes on one OS hides a defect on the other two.
 */
export interface NotificationBackend {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  /**
   * Always `false` today — no backend implements action buttons (docs/ESPECIFICACAO.md §
   * "Notificações": "ações vêm depois, se a validação [manual] se provar", S4-T1's contract is
   * title + body only). Reserved so a future backend that DOES support one can flip it without
   * changing this interface's shape (D-024: a bare boolean is honest while every implementation
   * agrees on the value; the day one doesn't, this needs to become a discriminated union instead).
   */
  supportsActions(): boolean;
  send(notice: Notice): Promise<void>;
}

export interface SpawnResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * A backend's own hook to run its external command — injected so a test can verify exactly what
 * WOULD have been spawned (docs/TESTES.md § `notification/`: "verificar os argumentos montados,
 * não o toast aparecendo") without ever starting a real `powershell.exe`/`notify-send`/`osascript`.
 * Spike B is explicit that a test runner may not even have a notification session to receive one
 * ("em servidor sem sessão gráfica, nada disso existe") — and even where there is one, `npm test`
 * must never pop a real notification on the screen of whoever runs it. Defaults to `spawnCommand`
 * below in every real backend; only a test overrides it.
 */
export type CommandRunner = (command: string, args: readonly string[]) => Promise<SpawnResult>;

/**
 * `shell: false`, array of arguments (AGENTS.md § "Processos") — the real implementation every
 * concrete backend uses by default. Not itself covered by a dedicated test: it is a thin,
 * structurally identical wrapper to `adapters/process/console-signal.ts#runPowerShellScript`,
 * which the process integration suite already exercises against a real `powershell.exe` — writing
 * a second real-process test here would prove the same generic spawn plumbing twice, not anything
 * specific to notification.
 */
export const spawnCommand: CommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    // S4-T6: the daemon (no console of its own, D-005) is a real caller of this, at every
    // lead-time/end-of-day notice — without `windowsHide`, the WinRT toast helper pops a real,
    // visible console window on Windows for the length of the call. `spawnHidden` (D-038) forces
    // that flag now, the same one `console-signal.ts#runPowerShellScript` already carried for the
    // identical reason; doesn't change `exitCode`/`stdout`/`stderr` either way.
    const child = spawnHidden(command, [...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });

/**
 * V2-T8 item 4: the result of a `spawnDetachedListening` call — TWO independent promises from one
 * spawn, because `linux-notify-send.ts`'s click listener needs to know two DIFFERENT things at two
 * DIFFERENT times. `spawned` settles as soon as the OS confirms the process actually started
 * (Node's own `'spawn'` event, which fires immediately — it does not wait for the command to do
 * anything) — that is all `LinuxNotifySendBackend#send` needs before it can return, because
 * `notify-send --wait` shows the toast right away and only delays ITS OWN exit, not the toast's
 * appearance. `closed` settles only once the process actually exits (`'close'`), which for a
 * `--wait`ed `notify-send` can be seconds to indefinitely later (whenever the person clicks or the
 * notification server times it out) — nothing in this project's own `send()` call chain waits on
 * this one; whoever reads `closed` does so as a background continuation (`.then`, never
 * `await`ed inline in `send()`).
 */
export interface DetachedLaunch {
  readonly spawned: Promise<boolean>;
  readonly closed: Promise<SpawnResult>;
}

export type DetachedCommandRunner = (command: string, args: readonly string[]) => DetachedLaunch;

/**
 * `detached: true` + `.unref()` (D-038, same mechanism `adapters/process/daemon-launch.ts#
 * spawnDetachedDaemon` already uses, for the identical reason: the CALLER — here, the daemon's own
 * long-running loop — must never be kept alive or blocked by this child's own lifetime) on top of
 * `spawnHidden`'s `windowsHide` (irrelevant on Linux, this backend's only real caller, but kept for
 * the same reason every other spawn in this project goes through `spawnHidden` rather than a bare
 * `node:child_process.spawn` — one place nobody can forget it). Stdio stays piped (`'pipe'`), not
 * `'ignore'` like `spawnDetachedDaemon`'s own: THIS caller needs to read back the clicked action id
 * from stdout, which is the entire reason this function exists instead of reusing `spawnCommand`.
 */
export const spawnDetachedListening: DetachedCommandRunner = (command, args) => {
  const child = spawnHidden(command, [...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: true,
  });
  child.unref();
  const spawned = new Promise<boolean>((resolve) => {
    child.once('spawn', () => resolve(true));
    child.once('error', () => resolve(false));
  });
  const closed = new Promise<SpawnResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    // An 'error' here means the process never ran at all (ENOENT, permission) — `spawned` above
    // already reports that as `false`; `closed` still needs to settle so nothing awaiting it hangs
    // forever, with a `null` exit code (Node's own convention for "never actually exited").
    child.on('error', () => resolve({ exitCode: null, stdout, stderr }));
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
  return { spawned, closed };
};
