<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/seeya-logo-on-dark.svg">
    <img src="design/seeya-logo.svg" alt="seeya" width="280">
  </picture>
</h1>

The day ends with several AI sessions in progress, across different projects. The next day, the
expensive part isn't resuming the work — it's rebuilding the context for each one.

**seeya** ("see you tomorrow") discovers the Claude Code sessions on your machine, captures the state of
each one at the end of the day, generates a plan for tomorrow, and resumes right where you left
off the next day.

The command is called **`seeya`**.

```bash
seeya sessions    # what's open right now
seeya end-day     # captures everything and plans tomorrow
seeya start-day   # resumes where you left off
```

> **Status: early development (Sprint 3 done).** `sessions`, `status`, `end-day` and
> `start-day` work. The daemon, notifications and `snooze`/`skip-today` are Sprint 4 and don't
> exist yet, so today the two day commands are run by hand. Nothing has been published to npm —
> see Install below. Follow along in [`docs/PLANO-DE-ENTREGA.md`](docs/PLANO-DE-ENTREGA.md).

## How it works

Claude Code registers live sessions in `~/.claude/sessions/` and keeps each one's transcript in
`~/.claude/projects/`. `seeya` reads both sources — plus each project's git state, worktrees
included — to assemble a handoff per session: what was being worked on, what's left pending, and
what to do tomorrow.

It **never talks to the live session**. There's no channel to inject a command into a running
interactive session, so the capture happens from the outside, in a headless process that sees the
whole conversation. This works even for sessions that have already died, and it doesn't spend the
open session's context. The reasoning is in [`docs/DECISOES.md`](docs/DECISOES.md), D-001.

Everything `seeya` writes lives in `~/.seeya/`. It never writes inside your repositories nor
inside `~/.claude/`.

## Requirements

- Node.js >= 22
- Claude Code installed and authenticated

## Install

**Not published to npm yet.** Until it is, install from a clone. This is a monorepo
(`npm workspaces`, D-043): `npm ci`/`npm run build` run at the root and cover both packages, but
`npm link` runs inside `packages/cli` — that's the package with the `seeya` binary.

```bash
git clone https://github.com/<owner>/seeya.git
cd seeya
npm ci
npm run build
cd packages/cli
npm link
```

`npm link` puts a global `seeya` on your PATH pointing at this checkout, so a later
`npm run build` (from the repo root) takes effect without linking again. Check it:

```bash
seeya --version
seeya sessions
```

To remove it: `npm unlink -g @seeya-ai/cli`.

If you'd rather install nothing, run the compiled entry point directly — `node
packages/cli/dist/index.js sessions` does the same thing.

**On PATH.** `npm link` writes into npm's global prefix (`npm config get prefix`). If `seeya`
isn't found afterwards, that directory isn't on your PATH — add it, or use the `node dist/...`
form above.

## Development

```bash
npm install
npm run verificar   # the gate: types + lint + layers + build + coverage
```

The other commands:

```bash
npm run build          # compiles TypeScript (tsc -b) to each package's own dist/
npm test               # unit + integration
npm run test:e2e       # end-to-end
npm run test:contrato  # against the real ~/.claude; doesn't run in standard CI
npm run lint           # eslint
npm run dependencias   # dependency-cruiser: validates layer boundaries
npm run cobertura      # tests with coverage and per-directory thresholds
npm run verificar:linux  # the gate inside a Linux container (node:22-bookworm)
```

### Linux pre-flight via Docker

CI runs on three OSes (ubuntu, windows, macos). A real Linux bug once escaped until after the
push because there was no way to reproduce the Linux job locally on a Windows machine. Run:

```bash
npm run verificar:linux
```

This runs `npm ci && npm run verificar` inside `node:22-bookworm`, reproducing CI's Linux job.
The host's `node_modules` is **never** mounted into the container — `vitest`, `esbuild` and
`rollup` ship platform-native binaries, and a `node_modules` installed on Windows breaks
instantly inside Linux. Instead, the script uses a named Docker volume, isolated from the host,
populated by `npm ci` running inside the container. The first run reinstalls everything;
subsequent ones reuse the volume and are fast.

The volume name is `seeya-node-modules-<hash>`, where `<hash>` derives from the repository's
absolute path — **one volume per repository/worktree, never a single global one**. It was proven
that a single volume breaks under concurrency: two simultaneous `npm ci` runs (two worktrees
running the pre-flight at the same time — a common scenario here) writing to the same volume make
one of them lose the race with `ENOENT: Cannot cd into '/app/node_modules/...'`. It's a
false-negative, not a false-positive, and the volume doesn't get corrupted — but it's a failure
unrelated to the dev's code. The path-based hash eliminates the race without needing a lock: each
worktree has its own volume, and the main repository keeps reusing the same one across runs (same
path every time), preserving the cache gain.

Cost: an orphaned volume is left behind when a worktree is removed. To clean up:

```bash
docker volume ls --filter name=seeya-node-modules-   # lists the project's volumes
docker volume rm seeya-node-modules-<hash>            # removes a specific worktree's
```

Requires Docker Desktop installed and running; the script detects when the daemon doesn't
respond and warns instead of failing with a cryptic error.

**Honest limit: there's no macOS coverage here.** There's no macOS container — the XNU kernel and
Apple's license require Apple hardware. This command only covers CI's Linux job; CI on all 3 OSes
and the manual S5-T4 pass remain mandatory.

### The interface (`@seeya-ai/app`, early skeleton)

```bash
npm run app
```

Builds the engine, bundles the three Electron targets (`packages/app/scripts/build.mjs`, esbuild),
and launches the real Electron binary. **The first run downloads that binary (~160 MB)**: the
`electron` package no longer does it at `npm ci` time, so the script runs its installer once when
`node_modules/electron/path.txt` is missing. A window opens with the discovered-session list on the
side, a status panel matching `seeya status`, and a "+" button that opens a command bar (command
and working directory — never a native `prompt()`) for a tab backed by an embedded terminal
(`@xterm/xterm` + `node-pty`).

**Installing it, instead of running from a checkout (V2-T8).** `npm run dist` (root, or
`packages/app`'s own `npm run dist`) builds an installer for the current OS with
`electron-builder`: Windows gets a per-user NSIS installer (no admin, Start Menu shortcut,
uninstaller); Linux gets a `.deb` (the everyday format — installing it also registers `seeya://`
system-wide via the package's own `.desktop` file) and an `AppImage` (no install, no
`seeya://` registration — nothing writes anything system-wide); macOS gets a `.dmg`, built by CI
only, not covered by this task's own acceptance. **No code signing** — Windows SmartScreen and any
future macOS Gatekeeper warning are the accepted cost (a certificate is a future decision).
Installing/uninstalling never touches `~/.seeya/` — an installed app and a dev checkout share the
same data directory and the same daemon lock, exactly like today. `.github/workflows/dist.yml`
(`workflow_dispatch`, manual) builds all three from CI and attaches them to the run as workflow
artifacts, never as a GitHub Release (that publication boundary is a v2-wide decision, not this
task's).

**The PATH a menu launch sees, on Linux/macOS (V2-T8).** An app opened from a graphical menu
inherits the desktop session's own `PATH`, not a login shell's — usually missing `~/.local/bin`,
`nvm`, or a global npm prefix, exactly where `claude`/`codex` tend to live (the same long-standing
issue VS Code has under this name). The interface reads `$SHELL -lic`'s own `PATH` once at
startup, with a short timeout, and uses it for resolving a harness command and for every tab's
spawn environment; on any failure it keeps the inherited `PATH`, unchanged from before. Windows
has no such split and isn't affected.

**Not published, no framework in the renderer (D-041: minimum first).** See
[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) § "A segunda raiz de composição" for how the
interface composes `@seeya-ai/engine` in-process, independently from `@seeya-ai/cli`.

**Terminal font (V2-T3).** Two config keys control it: `terminalFontFamily` (a CSS font-family
stack) and `terminalFontSize` (pixels) — read and write them with `seeya config get/set`, same as
every other config key. The interface embeds FiraCode Nerd Font Mono (Regular weight,
[nerd-fonts](https://github.com/ryanoasis/nerd-fonts) v3.5.1, SIL OFL 1.1 —
`packages/app/assets/fonts/`) as a guaranteed fallback, so a prompt that uses Nerd Font glyphs
(`oh-my-posh`, `starship`, `powerlevel10k`) renders correctly even with no such font installed on
the machine. **The interface reads config once at startup**: changing either key takes effect on
the next `npm run app`, not live — close and reopen the interface after `seeya config set
terminalFontFamily`/`terminalFontSize`.

**Resuming the day, in tabs (V2-T4).** The sidebar's "Today" section shows the same pending
briefing `seeya start-day` would find — the day, which sessions still need resuming, and (for
each one) its name, working directory and the first line of its plan. Check the ones you want and
click **Resume selected**: each one opens in its own tab, labeled with the session's name, running
`claude --resume` with yesterday's plan as the first message — the interface's own `SessionResumer`
implementation, over a tab instead of the CLI's inherited terminal, but calling the exact same
`resumeSessions` the CLI does. If a plan is too long to pass safely to an interactive session, a
dialog asks before doing anything else, mirroring `seeya start-day`'s own "warn BEFORE, and ask":
**Resume without the plan** (the default — the session comes back with its real history intact,
and the plan stays readable in today's briefing either way), **Open a fresh session** (starts
clean, losing history), or **Skip**. Closing the dialog without choosing counts as **Resume
without the plan**. A `--resume` that fails outright (not a long plan — the process itself exiting
non-zero) only ever offers **Open a fresh session** or **Skip**, same as before — there is no
free option to fall back to when `--resume` itself is what broke. The interface never starts this
on its own; it only ever runs after that click.

**Ending the day, with a preview as the confirmation (V2-T5a).** The status panel has an "End
day…" button. Clicking it never writes or terminates anything, and never calls the model either —
unlike `seeya end-day --dry-run` (which still calls the real generator for lean captures, its own
long-standing contract), the interface's own preview costs nothing: it shows a dry run of what
would happen — how many sessions are in scope, which would be captured, which would be terminated
by policy (`canTerminate`), which are left out and why — plus an honest cost ceiling for actually
running it ("up to N × `budgetPerSessionUsd`", never an estimate — it's the ceiling the capture
itself enforces) and a line saying plainly that the preview itself cost nothing. Only clicking
**Run end-day now** actually runs it, one at a time, showing "capturing N of M: name" as it goes;
**Cancel**, closing the dialog, or Escape all count as cancelling. On completion the dialog shows
the real report — the same text `seeya end-day` prints — the same notification `seeya end-day`
sends fires, and the "Today" panel refreshes to reflect what was just written. `--session` (a
single session, not the full day) is still CLI-only.

**The schedule strip, and starting/stopping the daemon (V2-T5b).** Below the status panel, a
one-line strip shows the same `seeya status`-style schedule fact by name — "End of day at 19:30 —
in 2h 13min", "End of day in 12 min" once a lead-time warning fires, "End of day: due now — the
daemon acts on its next poll", "End of day: skipped today", "End of day: already ran today", or
"End of day: not configured" — recomputed every refresh tick from the exact `decideSchedule` the
daemon itself polls. **Snooze +15m/+30m/+1h** and **Skip today** appear whenever the schedule is
still live, and update the strip immediately, without waiting for the next tick — the same
`seeya snooze`/`seeya skip-today` orchestration, shared with the CLI (`application/
schedule-adjustments.ts`). A second button, **Start daemon**/**Stop daemon**, follows the daemon's
own liveness the same way `seeya daemon --status` reports it — starting spawns the daemon as a
real, detached process (the interface's own runtime resolves `@seeya-ai/cli`'s compiled entry
point and spawns it with `ELECTRON_RUN_AS_NODE=1`, never depending on a `node` found on `PATH`);
stopping reuses the exact same stop sequence `seeya daemon --stop` runs. The interface never acts
on the schedule by itself (D-039) — the daemon is still what closes the day when nobody clicks
anything.

**A toast click brings the window to front (Windows, V2-T5b; Linux, V2-T8).** The interface
registers itself as the `seeya://` protocol handler on startup (`app.setAsDefaultProtocolClient`)
and requests the single-instance lock, so a `seeya://` activation — including a click on the
daemon's own toast — focuses the already-open window instead of starting a second one. The
daemon's Windows toast only carries the clickable `launch="seeya://open"` attribute once the
interface has registered itself at least once on the machine (a small marker file records this,
D-025: no marker, plain toast as before). On Linux, an installed (`.deb`) run infers the same
marker from the package's own `.desktop` registration (there is no API to ask the OS directly, the
way Windows' own `setAsDefaultProtocolClient` reports back); once marked, the daemon's
`notify-send` toast offers `--action=default=Open` (still a click on the toast body, never a
button — D-034), which a background process listens for and opens `seeya://open` via `xdg-open`
without blocking the toast itself. An `AppImage` run never gets the marker — nothing registered
`seeya://` for it to click into. macOS gets its own `seeya://` handler from the installer's
`Info.plist`, but no click mechanism this task adds — `osascript` cannot deliver a click back to
the process that showed the notification.

### Before writing code

Read [`AGENTS.md`](AGENTS.md). It's the project's work contract: layer boundaries, code style,
what never to do, and when to stop and ask instead of deciding alone. It applies to agents and
humans alike. `CLAUDE.md` just points to it.

## Documentation

| File                                                   | What it is                                         |
| ------------------------------------------------------ | -------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                               | Work contract, non-negotiable rules and code style |
| [`docs/DECISOES.md`](docs/DECISOES.md)                 | Locked decisions, numbered and with the reasoning  |
| [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md)       | Behavior of each command                           |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)           | Layers and the allowed-dependency matrix           |
| [`docs/TESTES.md`](docs/TESTES.md)                     | The test pyramid and the contract track            |
| [`docs/PLANO-DE-ENTREGA.md`](docs/PLANO-DE-ENTREGA.md) | Sprint-by-sprint, task-by-task roadmap             |
| [`docs/FORA-DE-ESCOPO.md`](docs/FORA-DE-ESCOPO.md)     | What v1 deliberately doesn't do                    |
| [`docs/spikes/`](docs/spikes/)                         | Experiments, with raw output and the verdict       |

This project depends on internal, undocumented Claude Code structures. When they change, the
contract suite is what will warn us — see [`docs/TESTES.md`](docs/TESTES.md).

## License

MIT
