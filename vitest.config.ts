import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Test projects split by track (see docs/TESTES.md). `unit` and `integration` run in
 * `npm test`; `e2e` and `contract` are opt-in via `npm run test:e2e` / `npm run test:contrato`.
 *
 * `passWithNoTests` (S0-T1) is a global option, not per project, and stays on: `integration` and
 * `e2e` are legitimately empty right now (their adapters/commands haven't landed yet), and
 * turning it off would make `npm test` red for no real defect. What it can't do on its own is
 * tell "legitimately empty" apart from "glob stopped matching by accident" — that gap is exactly
 * what bit S1-T0d (a directory rename before updating this file exited 0 with zero tests run).
 * `tests/integration/guards/test-projects.test.ts` is what closes it: it declares, independently
 * of this file, which project is expected to be empty and why, and fails if any project's real
 * file count disagrees (S1-T0e).
 */
/**
 * `console-signal.ts` (S1-T2b) and `termination-windows.ts` (S1-T12, split out of the old
 * `termination.ts`) are Windows-only by construction: every line in them either builds a
 * PowerShell/P-Invoke script, spawns `powershell.exe` to run one, or only ever executes when
 * `termination.ts`'s dispatcher picks the Windows branch — and that purpose (attaching to
 * another process's console and broadcasting `CTRL_BREAK_EVENT`,
 * docs/spikes/G-ctrl-break-no-windows.md) has no Linux/macOS equivalent to fall back to.
 * `npm run verificar` (this machine) exercises both for real
 * (`tests/integration/process/termination.test.ts`'s Windows describe block). Counting them
 * against `npm run verificar:linux`'s coverage denominator would penalize the project for code
 * that structurally cannot run in that container — not a gap in testing, a gap in what Linux can
 * even attempt. Measured (S1-T2b, `console-signal.ts` alone): leaving it in dropped the Linux
 * run's aggregate to ~74%, below the 80% threshold, entirely from this one file's Windows-only
 * lines.
 */
const WINDOWS_ONLY_SOURCE = [
  'packages/engine/src/adapters/process/console-signal.ts',
  'packages/engine/src/adapters/process/termination-windows.ts',
];

/**
 * The mirror image of `WINDOWS_ONLY_SOURCE` (S1-T12): `termination-posix.ts` only ever executes
 * when `termination.ts`'s dispatcher picks the non-Windows branch (real `SIGTERM`, a POSIX-only
 * concept), so it's structurally unreachable on a Windows coverage run — measured at 0% on this
 * Windows machine before this exclusion existed, which is what made `adapters/process` fail its
 * own per-directory floor here despite `tests/integration/process/termination.test.ts`'s POSIX
 * describe block covering it for real on Linux/macOS. Same shape of problem as
 * `WINDOWS_ONLY_SOURCE`, opposite direction, same fix: exclude it from the denominator of the
 * platform that structurally cannot run it, never from the platform that can.
 */
/**
 * V2-T8 item 3: `packages/app/src/composition/read-login-shell-path.ts` is the mirror image of
 * `termination-posix.ts` above, one composition root down — `composition/index.ts` only ever calls
 * it for `platform !== 'win32'` (there is no login-shell/`PATH`-in-profile-script split on
 * Windows, see that module's own docstring), so it's structurally unreachable on this Windows
 * machine's own `npm run verificar`. `verificar:linux` exercises it for real, against the
 * container's real `/bin/sh`.
 */
const POSIX_ONLY_SOURCE = [
  'packages/engine/src/adapters/process/termination-posix.ts',
  'packages/app/src/composition/read-login-shell-path.ts',
];

/**
 * V2-T2 (docs/PLANO-DE-ENTREGA.md, item 5): `packages/app/src/electron/**` is the main-process
 * entry, preload script and renderer bootstrap — Electron's own wiring, which cannot run without
 * a display the way `packages/cli/src/index.ts` cannot run without a real terminal invocation
 * (both are thin, both are excluded from `coverage.include` entirely rather than carrying a floor
 * they cannot clear in CI). Everything WITH logic (the tab model, session↔pid matching, state
 * assembly, the pty and IPC ports) lives outside `electron/` on purpose, in plain modules
 * `coverage.include` still reaches — see PRODUCTION_DIRECTORY_THRESHOLDS's own
 * `packages/app/src/**` entry below for the floor those modules carry.
 */
const APP_ELECTRON_SOURCE = ['packages/app/src/electron/**'];

/**
 * V2-T2: `packages/app/src/pty/node-pty-adapter.ts` is a two-line pass-through to `node-pty`'s
 * own `spawn` (that file's own docstring) — the ONE function in `packages/app/src` this task
 * leaves unexercised by `vitest`, on purpose, same shape as `packages/cli/src/index.ts` above
 * (thin wiring around a real OS process, "exercised for real" only by this task's own manual
 * aceite — a live pty, a live shell, a captured screenshot — never by an isolated unit test that
 * would otherwise have to launch a real child process just to cover a call it doesn't branch on).
 * `pty/pty-manager.ts`, which DOES have real logic (tab↔handle bookkeeping, event forwarding),
 * stays fully covered via a fake `PtySpawner` — see that file's own tests.
 */
const APP_NODE_PTY_ADAPTER_SOURCE = ['packages/app/src/pty/node-pty-adapter.ts'];

/**
 * These five integration files launch a REAL `powershell.exe` (`adapters/process/proc-start.ts`'s
 * `captureWindows`, `adapters/process/console-signal.ts`'s `sendCtrlBreak`) rather than touching an
 * isolated tmpdir like the rest of `integration/` — they contend for the SAME scarce resource: the
 * OS's capacity to launch a process, measured as 500-880ms per `powershell.exe` launch even WARM
 * (`proc-start.ts`'s own docstring). Under `integration`'s default parallelism every file gets its
 * own concurrent worker; when several of THESE FIVE land in the same batch, their real launches
 * queue behind each other and blow straight through the fixed 5s/8s deadlines the tests carry —
 * not a hang, a resource fight the deadline was never sized to survive.
 *
 * Measured (S4-T10, 2026-09-08, this machine, `git rev-parse HEAD` = the commit right before this
 * task): `npm run verificar` red with 2-3 of these five timing out, a DIFFERENT subset each run,
 * while every other integration file (isolated tmpdir, never launches a real process) stayed green
 * across the same runs. `composition.test.ts` belongs in this group for the identical reason even
 * though an earlier pass at isolating this only named the other four — it calls
 * `captureObservedProcStart` too (see its own `buildCliContext` test) and failed the same way in
 * the baseline run that diagnosed this. See docs/TESTES.md for the full measurement and the
 * before/after total.
 *
 * The OLD comment on the `integration` project below claimed "the rest of integration/ ... doesn't
 * contend for any resource, so it keeps Vitest's default parallelism" — true for 37 of 42 files,
 * false for these five, and that false generality is what sent this investigation looking at the
 * wrong layer first. Corrected in place rather than left to mislead the next reader (AGENTS.md: a
 * comment that asserts beyond its evidence is the same defect D-025 names for data).
 */
const PROCESS_HEAVY_INTEGRATION_FILES = [
  'tests/integration/cli/composition.test.ts',
  'tests/integration/cli/daemon-command.test.ts',
  'tests/integration/process/liveness.test.ts',
  'tests/integration/process/termination.test.ts',
  'tests/integration/scheduler/lock.test.ts',
  // V2-T5b: the same real-daemon-plus-real-CLI-subprocess shape as
  // tests/integration/cli/daemon-command.test.ts above, now exercised through
  // AppContext#startDaemon/#stopDaemon instead of the CLI's own runDaemonLauncher/runDaemonStop.
  'tests/integration/app/daemon-launch.test.ts',
];

/**
 * S4-T11: the SAME resource fight as `PROCESS_HEAVY_INTEGRATION_FILES` above (the OS's capacity
 * to launch a process, against these tests' fixed 5s default deadline), but a different binary.
 * `git-adapter.test.ts` and `primitives.test.ts` build their fixtures through
 * `tests/integration/git/_fixtures.ts#createGitFixture`/`commitAt`/`addWorktree`, each a real
 * `git` subprocess, and `GitAdapter.readFacts` itself spawns 5-8 more per call (branch/status/log/
 * worktree-list, plus a status+log pair per worktree it finds) — measured directly with a
 * `vi.mock('node:child_process')` spy around one representative case of each shape in this file
 * (2026-09-12, this machine, no other load): fixture setup alone is 6 real `git` launches, one
 * plain `readFacts` call is 5 (no other worktree) to 7 (one other worktree), and the heaviest
 * single test in `git-adapter.test.ts` ("never writes to the repository", two `readFacts` calls
 * plus 4 read-only snapshots) reaches 32. Summed over all 14 cases in that file: ~180 real `git`
 * launches. `atomic-write.test.ts`'s two `killMidWrite`-based cases spawn a real `node` child
 * (5 and 3 times respectively, `SIGKILL`ed mid-write) for the same reason `proc-start.ts`'s
 * `captureWindows` does: nothing short of an actual OS process death exercises what's being
 * proven. None of these three files were in the CI evidence `PROCESS_HEAVY_INTEGRATION_FILES`
 * was built from (S4-T10 only looked at `powershell.exe`); S4-T11's own CI evidence (two real
 * windows-latest failures, `docs/PLANO-DE-ENTREGA.md` S4-T11) named them by exit code and file.
 *
 * **What this does NOT explain.** `atomic-write.test.ts`'s first case ("a normal, uninterrupted
 * write", the control case) launches ZERO processes — two plain `writeFileAtomic` calls, 16ms on
 * this machine — and it still hit `Test timed out in 5000ms` in the S4-T11 CI evidence. Moving it
 * here removes it from contending with its OWN file's two process-launching siblings (which used
 * to share a worker with it under `integration`'s default per-file parallelism) but the CI log
 * shows the real cause reaching further than this file: `guards/eslint-restrictions.test.ts` (real
 * ESLint, 70s in that run) and `guards/dependency-cruiser.test.ts`/`layer-matrix.test.ts` (real
 * dependency-cruiser/AST walks, ~40s each) were running at the exact same wall-clock window as the
 * `integration` project's own default-parallel batch. This move narrows the contention THIS
 * project controls (how many of ITS OWN heavy files land in the same batch); it does not, and
 * cannot from here, control what the `guards` project is doing at the same instant — same
 * boundary S4-T10's Q-063 already named for "why did the machine get busier that day".
 */
const REAL_CHILD_PROCESS_GIT_AND_STORAGE_FILES = [
  'tests/integration/git/git-adapter.test.ts',
  'tests/integration/git/primitives.test.ts',
  'tests/integration/storage/atomic-write.test.ts',
];

/**
 * S4-T11: no test here launches a subprocess — the resource these three fight over is real,
 * sustained filesystem I/O instead of the OS's process table. `state-concurrent-write.test.ts`
 * and `config-concurrent-write.test.ts` each run 300 real `writeFileAtomic` calls (write + rename,
 * so ~600 real syscalls) racing 300 real reads, inside their OWN already-generous explicit 30s
 * timeout (Q-056/Q-058) — not the 5s default. `transcript-scan.test.ts`'s "500 stale transcripts"
 * case (also on an explicit 30s budget) does 500 concurrent `mkdir`+`utimes` pairs via a single
 * `Promise.all`, all real fs syscalls Node's default libuv threadpool (4 threads) serializes
 * regardless of the 500-way "parallelism" the test code asks for.
 *
 * **Measured (S4-T11 CI evidence, two windows-latest failures):** both concurrent-write files blew
 * their 30s budget in one run (30722ms/30105ms — the SAME run where the `guards` project's real
 * ESLint pass took 70s instead of its usual ~40s); the transcript-scan case blew it in the other
 * (39090ms). On this machine, isolated, all three finish in under 1.7s. A 30s explicit budget
 * already being generous is exactly why widening it further is not the fix here (AGENTS.md: don't
 * trade away the ability to catch a real hang) — serializing this trio (and the three above) so
 * their own heavy real I/O never piles up in the same instant is the lever this project controls;
 * it does not reach the `guards` project's CPU load happening at the same time (see the caveat on
 * `REAL_CHILD_PROCESS_GIT_AND_STORAGE_FILES` above — same unresolved "why did the runner get
 * busier" this task inherited from S4-T10's Q-063).
 */
const REAL_FS_IO_HEAVY_INTEGRATION_FILES = [
  'tests/integration/storage/state-concurrent-write.test.ts',
  'tests/integration/storage/config-concurrent-write.test.ts',
  'tests/integration/discovery/transcript-scan.test.ts',
];

/** Every file S4-T10/S4-T11 pulled out of `integration`'s default parallelism, for the two places
 * below that need the union: `integration`'s own `exclude` and `integration-process`'s `include`. */
const SERIALIZED_RESOURCE_HEAVY_FILES = [
  ...PROCESS_HEAVY_INTEGRATION_FILES,
  ...REAL_CHILD_PROCESS_GIT_AND_STORAGE_FILES,
  ...REAL_FS_IO_HEAVY_INTEGRATION_FILES,
];

/**
 * Per-directory coverage (docs/TESTES.md): `core/` 95%, every other production directory 80%.
 * One glob key PER directory, not a catch-all `'src/**'` for "everything but core" (S1-T12): a
 * catch-all glob matches every instrumented file, so it computes the exact same number as the
 * unscoped aggregate — measured the day this was found, `'src/**'` read 91.7% (a passing grade)
 * while `adapters/process` sat at 78.19% on its own, below its own 80% floor, carried by
 * everything else's slack. Only a glob scoped to one directory can catch that directory's own
 * decay.
 *
 * This list has to stay exhaustive over every directory `src/` actually has, or a new directory
 * gets silently zero floor — the same shape of gap S1-T0e closed for vitest's test projects.
 * `tests/integration/guards/_coverage-directories.ts` declares that same list independently
 * (never derived from this object) and `coverage-directories.test.ts` fails if the two disagree,
 * in either direction, or if either disagrees with the real `src/` tree.
 *
 * `perFile` (a vitest coverage option) is deliberately NOT used here: it would require every
 * INDIVIDUAL file to clear the threshold, which is a stricter, different promise than the one
 * docs/TESTES.md makes ("per directory"). A directory can be healthy in aggregate while one small
 * file inside it has a single hard-to-reach branch — exactly the shape `spawn-stdout.ts` and
 * `proc-start.ts` are in today — and `perFile` would fail the build on that alone, for a reason
 * disconnected from the actual finding this task fixed (a directory's decay hiding behind
 * others'). Per-directory grouping is the right grain for what was promised; per-file is a
 * different, stricter policy nobody asked for.
 */
const PRODUCTION_DIRECTORY_THRESHOLDS = {
  'packages/engine/src/core/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
  'packages/engine/src/application/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
  'packages/engine/src/scheduler/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
  // packages/cli/src/index.ts alone stays out of coverage.exclude below (thin commander wiring,
  // exercised for real only by the compiled e2e journey, docs/TESTES.md nº1) — but S1-T6 gave
  // cli/ several other files with real branching (composition.ts, session-view.ts,
  // format-sessions.ts, eligibility-view.ts, format-status.ts, the two *-command.ts
  // orchestrators), so the whole package carries the same 80% floor every other adapter does
  // instead of staying uncovered by default. One glob for the whole package (V2-T1, D-043): it
  // has no internal layer subdirectory the way packages/engine/src does — see
  // tests/integration/guards/_coverage-directories.ts.
  'packages/cli/src/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
  // V2-T2: one glob for the whole @seeya-ai/app package, same shape as packages/cli/src's own
  // entry above (app has no internal layer subdirectory the way packages/engine/src does either).
  // packages/app/src/electron/** carries no floor of its own — it's excluded from
  // coverage.include below entirely, same mechanism packages/cli/src/index.ts already uses (thin
  // wiring that cannot run headless), not a second entry in this object.
  'packages/app/src/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
  'packages/engine/src/adapters/autostart/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/clock/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/discovery/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/generation/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/git/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
  'packages/engine/src/adapters/notification/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/process/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/resumption/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/storage/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'packages/engine/src/adapters/transcript/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
};

/**
 * V2-T1 (D-043): every test resolves `@seeya-ai/engine/*` straight to packages/engine/src — never
 * to its built `dist/` — so the suite never depends on a prior build, exactly like it never
 * depended on one before the monorepo split. Mirrors the root tsconfig.json's own "paths"
 * override (same reasoning, same comment there).
 *
 * Needed in THREE places, measured one at a time rather than assumed: the root `resolve.alias`
 * (used by root-scoped files like `tests/_powershell-warmup-global-setup.ts`, which run under the
 * root config, not any one project's), and again inside EACH `projects[]` entry that can import
 * `@seeya-ai/engine` (each project gets its own Vite instance that does NOT inherit the root's
 * `resolve` — confirmed by adding it only at the root first: project test files still failed to
 * resolve `@seeya-ai/engine/...`, while re-adding it per-project fixed those same files).
 * `server.deps.inline` is what makes the alias apply at all: `@seeya-ai/engine` is a real npm
 * workspace package (a node_modules symlink), so without this Vitest's own dependency
 * optimization treats every import of it as "external" and hands it straight to Node's native
 * resolver — which never sees the alias and resolves through the package's real `exports` map
 * into `packages/engine/dist` instead. Measured directly: without `deps.inline`, every test still
 * passed (`dist/` existed from an earlier build) but resolved a DIFFERENT module than the alias
 * intended, and v8 coverage attributed every hit to files under `dist/`, which `coverage.include`
 * (below, scoped to packages/engine/src) can never match — every directory under
 * packages/engine/src read 0% while packages/cli/src (reached only by plain relative imports,
 * never this alias) read its real number.
 */
const ENGINE_ALIAS = {
  resolve: {
    alias: {
      '@seeya-ai/engine': path.resolve(import.meta.dirname, 'packages/engine/src'),
    },
  },
};
const ENGINE_ALIAS_DEPS_INLINE = { server: { deps: { inline: ['@seeya-ai/engine'] } } };

export default defineConfig({
  ...ENGINE_ALIAS,
  test: {
    ...ENGINE_ALIAS_DEPS_INLINE,
    passWithNoTests: true,
    // Q-025: at the ROOT, so every project gets it — not just `integration`, where it started.
    // `powershell.exe` is reachable from `src/adapters/process/` in general, so a future test in
    // any project can spawn it; wired per-project, each such test would hit a cold binary with no
    // warm-up and reopen this same decision from scratch. Measured: a root `globalSetup` runs for
    // projects that declare none, and coexists with a project's own (both fire). See the file's
    // own docstring for the numbers.
    globalSetup: ['tests/_powershell-warmup-global-setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/engine/src/**/*.ts',
        'packages/cli/src/**/*.ts',
        'packages/app/src/**/*.ts',
      ],
      exclude:
        process.platform === 'win32'
          ? [
              'packages/cli/src/index.ts',
              ...APP_ELECTRON_SOURCE,
              ...APP_NODE_PTY_ADAPTER_SOURCE,
              ...POSIX_ONLY_SOURCE,
            ]
          : [
              'packages/cli/src/index.ts',
              ...APP_ELECTRON_SOURCE,
              ...APP_NODE_PTY_ADAPTER_SOURCE,
              ...WINDOWS_ONLY_SOURCE,
            ],
      thresholds: PRODUCTION_DIRECTORY_THRESHOLDS,
    },
    projects: [
      {
        ...ENGINE_ALIAS,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        ...ENGINE_ALIAS,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          // guards/ has its own project (see below) because it writes fixtures into the real
          // src/ tree. `SERIALIZED_RESOURCE_HEAVY_FILES` (S4-T10, extended S4-T11) has its own
          // project too, for a different reason: those files either launch a real subprocess
          // (`powershell.exe`, `git.exe`, a plain `node` child) or hammer real, sustained fs I/O
          // (hundreds of real syscalls per case) — see the three consts' own docstrings above for
          // the measurements. Every OTHER file left in `integration` uses a per-test isolated
          // tmpdir with modest I/O and never launches a real process, so it genuinely doesn't
          // contend for either of those two resources and keeps Vitest's default parallelism.
          // **S4-T11 correction:** this comment used to say "the other 37 integration files" —
          // true right after S4-T10, false now that 6 more files moved out for a related but
          // distinct reason (real fs I/O, not just process launches). Not restated as a fresh
          // fixed count here on purpose, so the next file that needs to move doesn't leave a
          // THIRD stale number behind (AGENTS.md: a comment that asserts beyond its evidence is
          // the same defect D-025 names for data — S4-T10's own docstring above was corrected for
          // exactly this once already).
          exclude: [
            ...configDefaults.exclude,
            'tests/integration/guards/**',
            ...SERIALIZED_RESOURCE_HEAVY_FILES,
          ],
          // S2-T8: pays the `csc.exe` shim compilation exactly ONCE for the whole project run,
          // instead of leaving it to whichever test file's worker hits it first (see that global
          // setup's own comment). Stays here, project-scoped, while its `powershell.exe` sibling
          // moved to the root (Q-025): this one costs seconds rather than milliseconds, and its
          // only consumer is a fixture that is structurally integration-only. No-op on POSIX.
          globalSetup: ['tests/integration/generation/_windows-shim-global-setup.ts'],
        },
      },
      {
        ...ENGINE_ALIAS,
        test: {
          // S4-T10: the five files in `PROCESS_HEAVY_INTEGRATION_FILES` (see that const's own
          // docstring for the measurement) — extended S4-T11 with two more groups that share the
          // same fix even though they don't all share the same resource: three more files that
          // launch a real subprocess (`git.exe`/`node`, `REAL_CHILD_PROCESS_GIT_AND_STORAGE_FILES`)
          // and three that don't spawn anything but hammer real, sustained fs I/O instead
          // (`REAL_FS_IO_HEAVY_INTEGRATION_FILES`). `fileParallelism: false` here — and ONLY here —
          // makes every file in this project run one after another, so none of their real process
          // launches or heavy I/O bursts ever overlaps a sibling's. This is not the same move
          // S1-T0 rejected for `guards/`: that serialization would have HIDDEN a real race in
          // shared fixture state (the bug was the race, not the timing); this one REMOVES real
          // contention for real, measured, scarce resources (the OS's process table; real fs
          // syscall/disk throughput) that the tests' own fixed deadlines were never sized to
          // share. The files left in the `integration` project above never touch either resource
          // at this scale, so they pay none of this cost and keep full default parallelism.
          //
          // **What this project does NOT fix (S4-T11).** The CI evidence that motivated the S4-T11
          // additions showed a spawn-free, near-instant (16ms locally) test timing out at exactly
          // 5000ms alongside these — see `REAL_CHILD_PROCESS_GIT_AND_STORAGE_FILES`'s own
          // docstring. Serializing this project's OWN files removes the contention THIS project
          // controls; it does not reach CPU load the `guards` project's real ESLint/
          // dependency-cruiser runs generate at the same wall-clock instant, in a separate vitest
          // project this file has no scheduling control over. If the CI runner gets busier by a
          // path other than these specific files piling up, the same symptom (fixed deadline,
          // variable-cost operation) can come back through that different path — same residual
          // S4-T10's Q-063 already recorded, still open.
          name: 'integration-process',
          include: SERIALIZED_RESOURCE_HEAVY_FILES,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'guards',
          include: ['tests/integration/guards/**/*.test.ts'],
          // NO fileParallelism: false here, on purpose (S1-T0). S0-T6 serialized this project
          // because the guards write fixtures into the real src/ tree and were contending for
          // the same mutable resource — but serializing only HID a real race (commit 6899f99,
          // CI red on Linux/macOS, green by timing luck on Windows). The real fix was making the
          // tests insensitive to tree state (fixture isolated per test file, dependency-cruiser
          // scoped to its own fixture — see tests/integration/guards/_support.ts), not
          // preventing concurrency from happening. DO NOT reintroduce `fileParallelism: false`
          // to "fix" a failure here: running in parallel, Vitest is what EXPOSES a new race as
          // early as possible; serialized, it sleeps until someone touches this config again,
          // exactly like it happened the first time.
        },
      },
      {
        ...ENGINE_ALIAS,
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
        },
      },
      {
        ...ENGINE_ALIAS,
        test: {
          name: 'contract',
          include: ['tests/contract/**/*.test.ts'],
          /**
           * Writes the installed Claude Code version straight to stdout before any test runs —
           * this is what guarantees docs/TESTES.md ("always log the version") on the default
           * reporter's happy path, which doesn't print test names when everything passes. See
           * tests/contract/_version-global-setup.ts.
           */
          globalSetup: ['tests/contract/_version-global-setup.ts'],
        },
      },
    ],
  },
});
