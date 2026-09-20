/**
 * The autostart registration's own environment and output-capture file name (V2-T23), shared by
 * all three OS adapters (`macos.ts`/`windows.ts`/`linux.ts`) — same "declare once, reuse"
 * reasoning `adapters/resumption/env.ts` already applies to `INHERITED_SESSION_VARS`
 * (adapter-to-adapter imports are allowed by the layer matrix, docs/ARQUITETURA.md).
 *
 * **The bug this fixes, measured on the maintainer's Mac (docs/PLANO-DE-ENTREGA.md V2-T23).**
 * Before this task, `packages/app/src/composition/index.ts#enableAppAutostart` passed the WHOLE
 * `daemonLaunchTarget.env` — the full, D-017-cleaned environment a LIVE spawn uses right now — as
 * `AutostartLaunchOptions.env`, and each adapter wrote every entry it received into the file/unit/
 * task it registers. That environment is a photograph of one login: `SSH_AUTH_SOCK`/`TMPDIR` point
 * at paths that die at logout (a dead `SSH_AUTH_SOCK` is what makes `git` hang or fail during the
 * daemon's own capture), `XPC_*`/`__CF*`/`MallocNanoZone`/`COMMAND_MODE` are launch bookkeeping for
 * the process that photographed itself, and `USER`/`LOGNAME`/`HOME`/`SHELL` are variables the OS
 * already sets for the NEW login on its own. A registration read back weeks later, at a different
 * login, has no business carrying any of it.
 */

/**
 * Every variable an autostart registration is allowed to carry, with the reason it's there.
 * Nothing else survives `buildAutostartEnv` below, regardless of what a caller's own candidate
 * environment happens to contain.
 *
 * - `ELECTRON_RUN_AS_NODE` — without it, launching the app's own Electron binary at login opens
 *   the window instead of running the daemon (Electron's own documented mechanism, reused from
 *   `adapters/process/daemon-launch.ts#DaemonLaunchTarget`'s live-spawn case).
 * - `PATH` — the daemon needs to find `claude` and `git` during capture; a login job's own PATH is
 *   minimal on all three OSes (measured on the Mac this task's plan entry cites).
 *
 * **Known limit, not fixed by this task (docs/PLANO-DE-ENTREGA.md V2-T23 item 3): this `PATH` is
 * still a snapshot, frozen at the moment `enable()` ran.** If it later moves — a Node version
 * manager relinking its shim, `claude`/`git` reinstalled somewhere else — the registered job keeps
 * pointing at the old location until autostart is turned off and back on (`Autostart.disable()`
 * then `enable()` again), which re-reads the caller's current environment. Re-reading `PATH` at
 * login time itself is out of scope here — V2-T8's own `login-shell-path.ts` already measured how
 * unreliable that read is outside Windows.
 */
export const AUTOSTART_ENV_VAR_ALLOWLIST = ['ELECTRON_RUN_AS_NODE', 'PATH'] as const;

/**
 * Keeps only `AUTOSTART_ENV_VAR_ALLOWLIST`'s entries out of `candidateEnv` — everything else is
 * dropped, even when present (D-017's own discipline, "monte o ambiente explicitamente", applied
 * here to environment that goes to DISK rather than to a live `spawn`). `candidateEnv` accepts
 * `NodeJS.ProcessEnv`'s own `string | undefined` values directly (a caller can hand this the
 * live-spawn `daemonLaunchTarget.env` as-is) so no separate "drop the undefined ones" pass is
 * needed before calling this.
 *
 * Called twice on the path from a button click to a written file: once by the composition root
 * that builds `AutostartLaunchOptions.env` in the first place
 * (`packages/app/src/composition/index.ts#enableAppAutostart`), and once more inside each OS
 * adapter's own `enable()` — the second call is deliberate defense in depth (docs/PLANO-DE-
 * ENTREGA.md V2-T23 item 2: "a regra vale para os três adaptadores"), so a future caller that
 * forgets to filter can never write more than this list to disk either.
 */
export function buildAutostartEnv(
  candidateEnv: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of AUTOSTART_ENV_VAR_ALLOWLIST) {
    const value = candidateEnv[name];
    if (value !== undefined) {
      result[name] = value;
    }
  }
  return result;
}

/**
 * The file name (not a full path — each adapter joins this onto its own injected `seeyaHome`,
 * never `~/.claude`, D-027) an autostart registration's own launched process writes its stdout and
 * stderr to (V2-T23 item 5). Before this task, a login that failed to start the daemon left no
 * trace anywhere on disk — the only way to find out was running the registered command by hand,
 * which is exactly what happened on the Mac this task's plan entry measures. One shared file,
 * appended across runs, not one logger: this is each OS's own native output-redirection mechanism
 * for the process it launches (`StandardOutPath`/`StandardErrorPath` on macOS, `StandardOutput=`/
 * `StandardError=` on Linux, a `cmd.exe` redirection on Windows — see each adapter's own comment),
 * never a new logging system inside `seeya` itself (AGENTS.md § "Registro e saída": "não improvise
 * um logger").
 */
export const AUTOSTART_OUTPUT_LOG_FILE_NAME = 'autostart.log';
