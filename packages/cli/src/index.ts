#!/usr/bin/env node
/**
 * Entry point for the `seeya` CLI (D-020: the project's only composition root). `sessions` and
 * `status` are the first two real commands (S1-T6, docs/ESPECIFICACAO.md § "Comandos") — every
 * other command in docs/PLANO-DE-ENTREGA.md still needs the tasks that build its own dependencies
 * (git, generation, storage's handoff methods, the daemon) first.
 *
 * This file itself stays deliberately thin: it only wires `commander` to `composition.ts` (the
 * one place allowed to name a concrete adapter) and the two command modules, then prints their
 * plain-text result (AGENTS.md § "Registro e saída" — user-facing output is plain text, through
 * `cli/`, never JSON). Building the context and formatting the report are both unit/integration
 * -tested without spawning this file; only the end-to-end journey (docs/TESTES.md's e2e nº1)
 * exercises this module for real, against the compiled `dist/cli/index.js`.
 */
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { z } from 'zod';
import packageJson from '../package.json' with { type: 'json' };
import {
  buildAutostartContext,
  buildCliContext,
  buildConfigContext,
  buildDaemonContext,
  buildEndDayContext,
  buildProjectAdoptContext,
  buildProjectAdoptDeps,
  buildProjectAuditDeps,
  buildProjectContext,
  buildProjectOpenDeps,
  buildProjectRemoveDeps,
  buildProjectRemoveRepoDeps,
  buildProjectRevertAdoptionDeps,
  buildSnoozeContext,
  buildStartDayContext,
  buildVerifyCommitDeps,
  resolveCliDaemonOwner,
} from './composition.js';
import { runSessionsCommand } from './sessions-command.js';
import { runStatusCommand } from './status-command.js';
import { runEndDayCommand } from './end-day-command.js';
import { runStartDayCommand } from './start-day-command.js';
import {
  resolveDaemonInvocationMode,
  runDaemonLauncher,
  runDaemonWorker,
  runDaemonStatus,
  runDaemonStop,
} from './daemon-command.js';
import { runSnoozeCommand, runSkipTodayCommand } from './snooze-command.js';
import {
  runAutostartEnableCommand,
  runAutostartDisableCommand,
  runAutostartStatusCommand,
} from './autostart-command.js';
import {
  runConfigGetCommand,
  runConfigPolicyCommand,
  runConfigSetCommand,
} from './config-command.js';
import {
  runProjectAddRepoCommand,
  runProjectAdoptCommand,
  runProjectAuditCommand,
  runProjectCreateCommand,
  runProjectListCommand,
  runProjectOpenCommand,
  runProjectShowCommand,
  runProjectVerifyCommitCommand,
  runProjectVerifyBashCommandCommand,
} from './project-command.js';
import {
  runProjectRemoveCommand,
  runProjectRemoveRepoCommand,
  runProjectRevertAdoptionCommand,
} from './project-undo-command.js';
import { DAEMON_CHILD_ENV_VAR } from '@seeya-ai/engine/adapters/process/daemon-launch.js';
import { captureObservedProcStart } from '@seeya-ai/engine/adapters/process/proc-start.js';
import { processExists } from '@seeya-ai/engine/adapters/process/existence.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';

const PackageJsonSchema = z.object({
  version: z.string(),
});

// V2-T22: `runDaemonLauncher`'s own `isCallerTheOwningApp` check (D-045 item 3's exception for the
// app's own binary calling itself) needs a platform hint to tolerate a Windows separator/case
// difference — read once here, the same `process.platform === 'win32'` convention
// `composition.ts#buildStartDayContext`/`end-day-command.ts` already use.
const PLATFORM_HINT: PathPlatformHint = process.platform === 'win32' ? 'win32' : 'posix';

const { version } = PackageJsonSchema.parse(packageJson);

const program = new Command();

program
  .name('seeya')
  .description(
    'Discovers Claude Code sessions, captures their state at the end of the day, and resumes them the next day.',
  )
  .version(version);

program
  .command('sessions')
  .description(
    'List known sessions: name, cwd, state (alive/idle/ended/unknown), last activity and ' +
      'end-of-day termination policy. Read-only.',
  )
  .action(async () => {
    const context = await buildCliContext();
    console.log(await runSessionsCommand(context));
  });

program
  .command('status')
  .description(
    'The single-panel answer to what is going to happen today and whether the daemon is ' +
      'handling it: configured and effective end-of-day time (snooze/skip-today folded in), ' +
      "eligible sessions, and the daemon's own state and health. Read-only.",
  )
  .action(async () => {
    const context = await buildCliContext();
    console.log(await runStatusCommand(context));
  });

program
  .command('end-day')
  .description(
    'Run the end-of-day capture: gathers evidence for every eligible session, writes a handoff ' +
      'and the daily briefing, and terminates opted-in sessions once their handoff is verified ' +
      'on disk. A generation failure never aborts the day (D-003) — this command exits ' +
      'successfully even when the model call fails for every session.',
  )
  .option(
    '--dry-run',
    'Run the same pipeline but stop before writing or terminating anything; show what would happen.',
  )
  .option('--session <idOrCwd>', 'Limit end-day to a single session, matched by sessionId or cwd.')
  .action(async (options: { dryRun?: boolean; session?: string }) => {
    const { deps, config, notifier } = await buildEndDayContext();
    console.log(
      await runEndDayCommand(
        deps,
        config,
        {
          dryRun: options.dryRun ?? false,
          // `exactOptionalPropertyTypes`: only set `session` when commander actually parsed one.
          ...(options.session !== undefined ? { session: options.session } : {}),
        },
        notifier,
      ),
    );
  });

program
  .command('start-day')
  .description(
    'Read the most recent still-pending briefing, show its consolidated plan, and resume the ' +
      'chosen sessions where they left off, one at a time (D-004).',
  )
  .option('--all', 'Resume every still-unresumed session in the found briefing.')
  .option('--session <id>', 'Resume only the session matching this sessionId or cwd.')
  .action(async (options: { all?: boolean; session?: string }) => {
    const context = await buildStartDayContext();
    const exitCode = await runStartDayCommand(
      context,
      {
        all: options.all ?? false,
        // `exactOptionalPropertyTypes`: only set `session` when commander actually parsed one.
        ...(options.session !== undefined ? { session: options.session } : {}),
      },
      { stdin: process.stdin, stdout: process.stdout, isTTY: process.stdin.isTTY === true },
    );
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });

program
  .command('daemon')
  .description(
    'Start the long-running daemon that watches sessions and triggers the end-of-day capture ' +
      'at the configured time (D-005). Runs detached from this terminal — closing the window or ' +
      'logging out does not stop it. A second instance refuses to start while one is already ' +
      'running.',
  )
  .option(
    '--stop',
    'Stop the currently running daemon, if any (D-005). Not an error when none is running.',
  )
  .option(
    '--status',
    "Show whether a daemon is running, its health (S4-T3b), and today's schedule. Read-only.",
  )
  .action(async (options: { stop?: boolean; status?: boolean }) => {
    if (options.stop === true && options.status === true) {
      console.error('seeya: --stop and --status cannot be used together.');
      process.exitCode = 1;
      return;
    }
    // V2-T13, D-045 item 3's own "cuidado central": `resolveDaemonInvocationMode` decides purely
    // from `options`/the env var, BEFORE `DaemonOwner` is ever asked about — the 'worker' branch
    // below (`runDaemonWorker`, dispatched to when the app's own detached child sets
    // DAEMON_CHILD_ENV_VAR=1) never even reaches `resolveCliDaemonOwner`, let alone gets refused
    // by it. Only the 'launcher' branch (a human typing "seeya daemon") does.
    const mode = resolveDaemonInvocationMode(options, process.env[DAEMON_CHILD_ENV_VAR] === '1');
    if (mode === 'stop') {
      const { storage, processControl, clock } = await buildDaemonContext();
      console.log(await runDaemonStop({ storage, processControl, clock }));
      return;
    }
    if (mode === 'status') {
      const { storage, processControl, clock } = await buildDaemonContext();
      console.log(await runDaemonStatus({ storage, processControl, clock }));
      return;
    }
    if (mode === 'worker') {
      const deps = await buildDaemonContext();
      // S4-T3b: the lock's own recycled-PID tie-break needs the WORKER's own procStart at the
      // moment it starts (core/daemon-lock.ts's own docstring) — captured here, the one real
      // composition root allowed to call adapters/process directly (D-020), then threaded down as
      // a plain value so scheduler/ never has to know how it was obtained (same discipline `pid`
      // itself already gets).
      const procStartCapture = await captureObservedProcStart(process.pid, processExists);
      const procStart = procStartCapture.kind === 'value' ? procStartCapture.value : undefined;
      // V2-T25: the WORKER's own `process.execPath` — for a plain CLI launch this is a Node
      // binary; for the app's own detached child (`packages/app/src/composition/index.ts#startDaemon`)
      // it's Electron's own binary, spawned with `ELECTRON_RUN_AS_NODE=1` — either way, the exact
      // executable currently running as the daemon, recorded on the lock so a later process can
      // tell "my own daemon" apart from "someone else's" (`core/daemon-lock.ts#DaemonLockInfo.launchedBy`).
      const exitCode = await runDaemonWorker(deps, process.pid, procStart, process.execPath);
      if (exitCode !== 0) {
        process.exitCode = exitCode;
      }
      return;
    }
    const { storage, processControl } = await buildDaemonContext();
    const daemonOwner = await resolveCliDaemonOwner();
    const scriptPath = fileURLToPath(import.meta.url);
    console.log(
      await runDaemonLauncher(
        storage,
        processControl,
        { nodePath: process.execPath, scriptPath, args: ['daemon'] },
        daemonOwner,
        PLATFORM_HINT,
      ),
    );
  });

const autostartCommand = program
  .command('autostart')
  .description(
    "Register (or remove) seeya daemon in this OS's own autostart mechanism (Task Scheduler / " +
      'systemd --user / LaunchAgent, S5-T1), so it comes back up after a reboot or logout ' +
      'without anyone remembering to run "seeya daemon" by hand.',
  );

autostartCommand
  .command('enable')
  .description(
    'Register seeya daemon to start on login, pointing at the binary currently in use. Safe to ' +
      'run again: updates the registered path instead of duplicating the registration.',
  )
  .action(async () => {
    const { autostart } = buildAutostartContext();
    const binaryPath = fileURLToPath(import.meta.url);
    const daemonOwner = await resolveCliDaemonOwner();
    console.log(await runAutostartEnableCommand(autostart, binaryPath, daemonOwner));
  });

autostartCommand
  .command('disable')
  .description('Remove the autostart registration, if any. Not an error when none is registered.')
  .action(async () => {
    const { autostart } = buildAutostartContext();
    console.log(await runAutostartDisableCommand(autostart));
  });

autostartCommand
  .command('status')
  .description(
    'Show whether autostart is enabled, disabled, or enabled but pointing at a path that no ' +
      'longer exists. Read-only. Same result as the autostart line in "seeya status".',
  )
  .action(async () => {
    const { autostart } = buildAutostartContext();
    console.log(await runAutostartStatusCommand(autostart));
  });

program
  .command('snooze')
  .description(
    "Push back today's scheduled end-of-day closure by a fixed increment (D-006). Works with " +
      'or without the daemon running — the change is persisted to disk and picked up on its next poll.',
  )
  .argument('<increment>', 'One of +15m, +30m, +1h.')
  .action(async (increment: string) => {
    const context = await buildSnoozeContext();
    console.log(await runSnoozeCommand(context, increment));
  });

program
  .command('skip-today')
  .description(
    "Skip today's automatic end-of-day closure entirely (D-006); it resumes tomorrow. Works " +
      'with or without the daemon running.',
  )
  .action(async () => {
    const context = await buildSnoozeContext();
    console.log(await runSkipTodayCommand(context));
  });

const configCommand = program
  .command('config')
  .description(
    'Read and write ~/.seeya/config.json: end-of-day time, lead times, project policy, capture ' +
      'model and limits.',
  );

configCommand
  .command('get')
  .description('Print the current config, or a single key.')
  .argument('[key]', 'A single config key to print, e.g. endOfDayTime.')
  .action(async (key: string | undefined) => {
    const context = buildConfigContext();
    console.log(await runConfigGetCommand(context, key));
  });

configCommand
  .command('set')
  .description(
    'Set one config key. Validated before writing — an unknown key or an invalid value is refused.',
  )
  .argument('<key>', 'A config key, e.g. endOfDayTime, leadTimesInMinutes, captureModel.')
  .argument(
    '<value>',
    'The new value. Comma-separate list values (e.g. "30,15" for leadTimesInMinutes).',
  )
  .action(async (key: string, value: string) => {
    const context = buildConfigContext();
    console.log(await runConfigSetCommand(context, key, value));
  });

configCommand
  .command('policy')
  .description(
    "Show or update one project's termination/deep-capture policy, keyed by cwd (D-002, D-011).",
  )
  .argument('<cwd>', 'The project working directory this policy applies to.')
  .option(
    '--can-terminate <bool>',
    "true or false — allow seeya to terminate this project's live session after a successful handoff.",
  )
  .option(
    '--deep-capture <bool>',
    'true or false — use the deep --resume capture for this project instead of the lean default.',
  )
  .action(async (cwd: string, options: { canTerminate?: string; deepCapture?: string }) => {
    const context = buildConfigContext();
    console.log(
      await runConfigPolicyCommand(context, cwd, {
        // `exactOptionalPropertyTypes`: only set a key when commander actually parsed that flag.
        ...(options.canTerminate !== undefined ? { canTerminate: options.canTerminate } : {}),
        ...(options.deepCapture !== undefined ? { deepCapture: options.deepCapture } : {}),
      }),
    );
  });

const projectCommand = program
  .command('project')
  .description(
    'Manage the workspace (V2-T27): a single local git repository holding every project — a ' +
      'persistent context directory (AGENTS.md, INDEX.md, seeya.json, ' +
      'decisions/plans/status/journal/references) that outlives any one harness session.',
  );

projectCommand
  .command('create')
  .description(
    'Create a new, empty project in the workspace: writes its skeleton and commits it. The ' +
      'workspace itself is created (as a local git repository, no remote) the first time this runs.',
  )
  .argument('<id>', 'Lowercase letters, digits and hyphens only, e.g. "auth-hardening".')
  .action(async (id: string) => {
    const context = buildProjectContext();
    console.log(await runProjectCreateCommand(context, id));
  });

projectCommand
  .command('list')
  .description('List every project in the workspace. Read-only.')
  .action(async () => {
    const context = buildProjectContext();
    console.log(await runProjectListCommand(context));
  });

projectCommand
  .command('show')
  .description('Show one project: its default harness, associated repositories and trackers.')
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .action(async (id: string) => {
    const context = buildProjectContext();
    console.log(await runProjectShowCommand(context, id));
  });

projectCommand
  .command('add-repo')
  .description(
    'Associate a local git clone with a project: reads its remote (git remote get-url origin), ' +
      "records the identity in seeya.json, and the local path in this device's repository map " +
      '(V2-T28). Adding the same repository twice reports that it is already associated.',
  )
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .argument('<path>', 'Local path to the repository clone, e.g. "../app-api".')
  .action(async (id: string, repoPath: string) => {
    const context = buildProjectContext();
    console.log(await runProjectAddRepoCommand(context, id, repoPath));
  });

projectCommand
  .command('open')
  .description(
    'Open a harness (only "claude" for now) with the project directory as cwd and every ' +
      'associated repository still resolvable on this device released via --add-dir (V2-T28).',
  )
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .option('--with <harness>', "Harness to open instead of the project's own default.")
  .action(async (id: string, options: { with?: string }) => {
    const context = buildProjectContext();
    const deps = await buildProjectOpenDeps(context);
    const exitCode = await runProjectOpenCommand(deps, id, options.with, {
      stdin: process.stdin,
      stdout: process.stdout,
      isTTY: process.stdin.isTTY === true,
    });
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });

projectCommand
  .command('audit')
  .description(
    "Check a project's commit history since the last audit against the same rules the " +
      'workspace\'s own git hook enforces (D-047), and report what escaped it. "seeya project ' +
      'open\" already runs this same check before taking the lock — this is for checking a ' +
      'project without opening it.',
  )
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .action(async (id: string) => {
    const context = buildProjectContext();
    const deps = buildProjectAuditDeps(context);
    console.log(await runProjectAuditCommand(deps, id));
  });

projectCommand
  .command('verify-commit')
  .description(
    "Internal: called by the workspace's own commit-msg git hook (D-047, V2-T34) with the path " +
      'git hands it — not meant to be run by hand.',
  )
  .argument('<messageFile>', 'Path to the commit message file git hands the hook.')
  .action(async (messageFile: string) => {
    const deps = buildVerifyCommitDeps();
    const exitCode = await runProjectVerifyCommitCommand(
      deps,
      process.cwd(),
      messageFile,
      process.stderr,
    );
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });

projectCommand
  .command('verify-bash-command')
  .description(
    "Internal: called by a project's own Claude Code hook (D-047, V2-T34) — reads the " +
      'PreToolUse payload from stdin, not meant to be run by hand.',
  )
  .action(async () => {
    const exitCode = await runProjectVerifyBashCommandCommand(process.stdin, process.stdout);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });

projectCommand
  .command('adopt')
  .description(
    'Adopt an existing session into a project: resumes a FORK of it interactively (the ' +
      'original is never touched), in its own directory, with the project released via ' +
      '--add-dir. Creates the project first if it does not exist yet. Nothing is committed ' +
      'until you confirm what the session wrote (V2-T29, D-047 item 6).',
  )
  .argument(
    '<session>',
    'The session, by the name "seeya sessions" shows, a sessionId (or prefix), or its cwd.',
  )
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .action(async (session: string, id: string) => {
    const context = await buildProjectAdoptContext();
    const deps = await buildProjectAdoptDeps(context);
    const exitCode = await runProjectAdoptCommand(context.sessionProvider, deps, session, id, {
      stdin: process.stdin,
      stdout: process.stdout,
      isTTY: process.stdin.isTTY === true,
    });
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });

projectCommand
  .command('remove')
  .description(
    'Remove a project from the workspace and commit the removal (V2-T32). Not destructive: the ' +
      "content stays in the workspace's own git history. Never touches an associated " +
      'repository, a discovered session or a transcript.',
  )
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .action(async (id: string) => {
    const context = buildProjectContext();
    const deps = await buildProjectRemoveDeps(context);
    const exitCode = await runProjectRemoveCommand(deps, id, {
      stdin: process.stdin,
      stdout: process.stdout,
      isTTY: process.stdin.isTTY === true,
    });
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });

projectCommand
  .command('remove-repo')
  .description(
    'Remove a repository association from a project and commit it (V2-T32). The local clone ' +
      "itself is never touched — only seeya.json's own record, and this device's repository " +
      'map when no other project still uses the same identity.',
  )
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .argument('<name>', 'The repository name, as "seeya project show" lists it.')
  .action(async (id: string, name: string) => {
    const context = buildProjectContext();
    const deps = await buildProjectRemoveRepoDeps(context);
    console.log(await runProjectRemoveRepoCommand(deps, id, name));
  });

projectCommand
  .command('revert-adoption')
  .description(
    "Revert an adopted session's own commits from a project, newest to oldest (V2-T32, D-047 " +
      'item 4). Refuses if a later commit from a different session touched the same files. The ' +
      'original session becomes adoptable again; the adopted copy is deleted only if it never ' +
      'wrote anything after being adopted, or with explicit confirmation otherwise.',
  )
  .argument('<id>', 'The project id, e.g. "auth-hardening".')
  .argument(
    '[session]',
    "Required only when the project has more than one adoption — the original session's or the " +
      "adopted copy's own session id (or a prefix of either).",
  )
  .action(async (id: string, session: string | undefined) => {
    const context = buildProjectContext();
    const deps = await buildProjectRevertAdoptionDeps(context);
    const exitCode = await runProjectRevertAdoptionCommand(deps, id, session, {
      stdin: process.stdin,
      stdout: process.stdout,
      isTTY: process.stdin.isTTY === true,
    });
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`seeya: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
