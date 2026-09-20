/**
 * Windows Task Scheduler mechanism for `Autostart` (docs/PLANO-DE-ENTREGA.md S5-T1), chosen and
 * measured in docs/QUESTOES.md Q-067: `Register-ScheduledTask`/`Get-ScheduledTask`/
 * `Unregister-ScheduledTask` (the `ScheduledTasks` PowerShell module, backed by the Task
 * Scheduler COM API) — not the `schtasks.exe` CLI the task's own brief suggested. Measured on the
 * machine this task shipped from: `schtasks /Create` refuses with "Acesso negado" under the same
 * non-elevated user token `Register-ScheduledTask` succeeds under (`whoami /groups` shows
 * `BUILTIN\Administradores` held "for deny only" — a split UAC token) — the COM-based cmdlet and
 * the decades-old CLI enforce different privilege checks for the identical operation. `schtasks
 * /Query` (read-only) needs no elevation either way; `status()` still goes through PowerShell for
 * consistency (structured JSON via `ConvertTo-Json`, no text-table parsing across Windows
 * locales — `schtasks /Query /FO LIST`'s field names are themselves localized).
 *
 * **The launched command wraps `conhost.exe --headless`** (Q-067's own measurement table): the
 * only one of the three candidates the brief named that left every box checked — interactive
 * session, no visible window, working toast from that session. `Register-ScheduledTask -Trigger
 * AtLogOn` with an `Interactive` logon type is what places the task in the user's own interactive
 * session in the first place (docs/spikes/B-notificacoes.md: the toast needs that session, not
 * session 0); `conhost.exe --headless` is what keeps the launched console from flashing a window
 * in it (D-038's "todo processo que o seeya lança é invisível", applied here to the one process
 * `spawnHidden` itself never touches — Task Scheduler starts it, not `node:child_process`).
 *
 * **The registered path lives in the task's `Description` field, not parsed back out of
 * `Arguments`.** `Arguments` has to stay a real, quoted, executable command line
 * (`--headless "<node>" "<seeya script>" daemon`) that Windows itself tokenizes for
 * `conhost.exe`; parsing quoted paths with embedded spaces back out of that string with a regex
 * would be exactly the kind of fragile text surgery this project avoids elsewhere (AGENTS.md's
 * own "erro clássico" is a cousin of this: don't loosen or hand-roll parsing against an
 * undocumented shape when a stable one is available). `Description` carries the same
 * `binaryPath` `enable()` was given, verbatim, with nothing else competing to write it — reading
 * it back is a single property access, not parsing.
 */
import { escapeForPowerShellSingleQuotedString } from '../notification/windows-toast.js';

export const AUTOSTART_TASK_NAME = 'SeeyaDaemonAutostart';

function quoted(value: string): string {
  return escapeForPowerShellSingleQuotedString(value);
}

/**
 * `Get-ScheduledTask` by name, printed as compact JSON on stdout: `{"found":false}` when absent,
 * or `{"found":true,"registeredPath":"<Description>"}` when present. `windows.ts#query` is what
 * parses this stdout into `core/autostart.ts#AutostartRawQuery` — this function only ever builds
 * text, never touches a real `Get-ScheduledTask` itself.
 */
export function buildQueryScript(): string {
  return `
$ErrorActionPreference = 'Stop'
try {
  $t = Get-ScheduledTask -TaskName '${AUTOSTART_TASK_NAME}' -ErrorAction Stop
  [pscustomobject]@{ found = $true; registeredPath = [string]$t.Description } | ConvertTo-Json -Compress
} catch {
  [pscustomobject]@{ found = $false } | ConvertTo-Json -Compress
}
`;
}

/**
 * Prefixes `argument` with `set K=V&& ` for every entry of `env` (V2-T13, D-045 item 4) and moves
 * the launched executable to `cmd.exe /c "..."` — `New-ScheduledTaskAction` has no environment
 * parameter of its own (measured: PowerShell 5.1's `ScheduledTasks` module carries none), so a
 * `cmd.exe` wrapper is what actually sets the variable before the real command runs; `set` inside
 * one `cmd.exe /c` invocation stays visible to every process IT spawns (`conhost.exe`, then
 * `execPath`), which is the only requirement here. Returns `execute`/`argument` unchanged when
 * `env` is empty/undefined — the CLI's own call (no `env`) never goes through this wrapper at all,
 * same script text as before this task.
 */
function withEnvPrefix(
  env: Readonly<Record<string, string>> | undefined,
  execute: string,
  argument: string,
): { readonly execute: string; readonly argument: string } {
  const entries = env === undefined ? [] : Object.entries(env);
  if (entries.length === 0) {
    return { execute, argument };
  }
  const sets = entries.map(([key, value]) => `set ${key}=${value}`).join('&& ');
  return { execute: 'cmd.exe', argument: `/c "${sets}&& ${execute} ${argument}"` };
}

/**
 * Registers (or re-registers, overwriting) the task pointing at `execPath`/`scriptPath` — always
 * `AtLogOn` for the CURRENT user, `Interactive` logon type (see this file's own top comment for
 * why). Idempotent: safe to call whether or not the task already exists —
 * `core/autostart.ts#decideAutostartEnable` decides what to SAY about it from a query taken
 * BEFORE this runs, never from this script's own output.
 *
 * `env` (V2-T13, D-045 item 4, optional) is the app's own way to register autostart pointing at
 * Electron's binary: `execPath` there is `process.execPath` (Electron, not plain Node), and the
 * launched task needs `ELECTRON_RUN_AS_NODE=1` set for that binary to behave as Node at all
 * (`adapters/process/daemon-launch.ts#DaemonLaunchTarget`'s own docstring has the full mechanism —
 * `spawnDetachedDaemon` sets this the same way for the "Start daemon" button, this is the same
 * fact carried into the REGISTERED task instead of a one-off `spawn`). See `withEnvPrefix` above
 * for how it's actually injected.
 */
export function buildRegisterScript(
  execPath: string,
  scriptPath: string,
  env?: Readonly<Record<string, string>>,
): string {
  const { execute, argument } = withEnvPrefix(
    env,
    'conhost.exe',
    `--headless "${execPath}" "${scriptPath}" daemon`,
  );
  return `
$ErrorActionPreference = 'Stop'
$userId = "$env:USERDOMAIN\\$env:USERNAME"
$taskAction = New-ScheduledTaskAction -Execute '${quoted(execute)}' -Argument '${quoted(argument)}'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
Unregister-ScheduledTask -TaskName '${AUTOSTART_TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName '${AUTOSTART_TASK_NAME}' -Action $taskAction -Trigger $trigger -Principal $principal -Description '${quoted(scriptPath)}' | Out-Null
Write-Output 'OK'
`;
}

/** Removes the task, tolerating it already being absent (D-025) — same "already gone is not an
 * error" contract `core/ports.ts#Storage.clearDaemonLock` documents for the same reason. */
export function buildUnregisterScript(): string {
  return `
$ErrorActionPreference = 'Stop'
$t = Get-ScheduledTask -TaskName '${AUTOSTART_TASK_NAME}' -ErrorAction SilentlyContinue
if ($null -eq $t) {
  Write-Output 'ABSENT'
} else {
  Unregister-ScheduledTask -TaskName '${AUTOSTART_TASK_NAME}' -Confirm:$false
  Write-Output 'REMOVED'
}
`;
}
