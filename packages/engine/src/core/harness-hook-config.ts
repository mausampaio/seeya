/**
 * The Claude Code project settings (D-047 item 5, V2-T34 item 2) that refuse the two ways a Bash
 * tool call could bypass the workspace's own git hooks (`core/workspace-commit-guard.ts`):
 * `git commit --no-verify`, and changing where git looks for hooks (`git config core.hooksPath`).
 * Written into a project's own `.claude/settings.json` (project configuration, D-030: never
 * `~/.claude/`).
 *
 * **PO review (V2-T34): regenerated on every `seeya project open`, exactly like the workspace's own
 * commit-msg git hook (`core/workspace-hooks.ts`) — never committed.** The first version of this
 * file did the opposite on both counts, and the maintainer's own review found why that was wrong:
 * - It called a companion `.claude/hooks/verify-bash-command.mjs` script via a bare `node`
 *   invocation. A standalone-binary Claude Code install has no reason to guarantee `node` is on
 *   `PATH`, and a `PreToolUse` hook command that fails for a reason OTHER than its own deliberate
 *   `exit 2` is a WARNING, not a block (`https://code.claude.com/docs/en/hooks.md`) — so the guard
 *   would silently stop existing the moment that assumption broke.
 * - It was written once, at project creation, as part of the TRACKED project skeleton
 *   (`core/project-skeleton.ts`). Fixing the point above means calling `seeya` back by absolute
 *   path (the same fix `core/workspace-hooks.ts` already has) — baking that into committed content
 *   would go stale the moment `seeya` moved or was reinstalled, with no `open`-time refresh to fix
 *   it (unlike the git hook, which already gets exactly that).
 *
 * Both are fixed the same way: this is no longer part of `core/project-skeleton.ts`'s tracked
 * files at all. `application/harness-hook.ts#ensureHarnessHookInstalled` writes it fresh at the
 * start of every `openProject`, the workspace's own `.gitignore` excludes every project's own
 * `.claude/` directory (`adapters/workspace/index.ts`'s own `IGNORED_WORKSPACE_PATTERNS` — a
 * double-asterisk prefix before the slash, confirmed for real: `git status --porcelain
 * --ignored=matching` reports a project's own `.claude/` directory `!!`, ignored, at any project
 * depth — the prefix is needed because a bare `.claude/settings.json` line in the workspace-root
 * `.gitignore` only matches at the root itself, per git's own anchoring rule for a pattern that
 * contains a slash), and the embedded
 * `command` calls back into `seeya project verify-bash-command` the exact same way the git hook
 * calls `seeya project verify-commit`: absolute path, `ELECTRON_RUN_AS_NODE=1` when this `seeya` is
 * itself Electron, and a pre-flight existence check with a clear message when the recorded path
 * has gone stale (same fix as `core/workspace-hooks.ts`'s own missing-verifier check).
 *
 * **Measured, not assumed, that Claude Code's own hook `command` execution supports the same
 * POSIX-shell `KEY=value cmd` env-prefix syntax the git hook already relies on.** A disposable
 * session, a project-local `.claude/settings.json` whose hook command was
 * `"FOO=bar123 node \"...check-env.mjs\""`, the script writing `process.env.FOO` to a marker file:
 * the marker read back `FOO=bar123` — confirms the whole command string is handed to a real shell,
 * not executed as a literal argv array, on Windows.
 *
 * **Measured end to end, not simulated (PO review defect 3's own "meça de novo... que o comando
 * real dispara o gancho e bloqueia um --no-verify").** Two disposable sessions, a real, compiled
 * `packages/cli/dist/index.js`, this exact `buildHarnessSettingsJson` output written to a
 * scratch project's own `.claude/settings.json`: asked to run `git commit --no-verify -m test`,
 * the session reported the hook blocked it ("The git hook blocked this command because
 * `--no-verify` bypasses the project's commit trailers and one-project-per-commit enforcement");
 * asked to run a plain `echo`, the same hook let it through. Both sessions and their transcripts
 * deleted afterward — never a real project or a real session of the maintainer's own.
 *
 * **Measured limit, not assumed (item 2's own "medir primeiro"): this layer does NOT protect
 * `seeya project adopt`.** Claude Code only reads a directory's own `.claude/settings.json` from
 * the session's `cwd`; a directory released only via `--add-dir` is never scanned for its own
 * settings/hooks (`https://code.claude.com/docs/en/permissions.md`: "doesn't discover most
 * `.claude/` configuration from these directories" — confirmed against the shipped documentation,
 * not inferred). `seeya project open` launches WITH the project directory as `cwd`
 * (`application/project-open.ts#openProject`), so this hook is active there. `seeya project adopt`
 * resumes a fork in the ORIGINAL session's own directory and only releases the project via
 * `--add-dir` (`core/ports.ts#SessionAdoptionLauncher`'s own docstring on why, D-047) — this hook
 * never runs for that flow. The git hooks (`core/workspace-commit-guard.ts`) still do, since they
 * run inside the workspace's own repository regardless of which directory a session calls `git`
 * from — this is exactly item 7's own "onde o guarda-corpo termina," for this one layer.
 */

export const HARNESS_SETTINGS_RELATIVE_PATH = '.claude/settings.json';

/** D-024: named, not a boolean — a Bash command is either fine, or blocked with a reason a person
 * (or the session itself) can act on. This is the exact decision `seeya project
 * verify-bash-command` applies to the real `PreToolUse` payload at hook-run time
 * (`packages/cli/src/project-command.ts#runProjectVerifyBashCommandCommand`) — kept here, pure,
 * alongside the settings/command text this whole hook is built from. */
export type BashCommandGuardDecision =
  | { readonly kind: 'allow' }
  | {
      readonly kind: 'block';
      readonly reason: string;
    };

const FORBIDDEN_BASH_COMMAND_PATTERNS: readonly RegExp[] = [/--no-verify\b/, /hooksPath/i];

/**
 * @example
 * decideBashCommandGuard('git commit --no-verify -m "skip the hook"')
 * // { kind: 'block', reason: "This project's git hooks (D-047) enforce ..." }
 * decideBashCommandGuard('git commit -m "normal commit"')
 * // { kind: 'allow' }
 */
export function decideBashCommandGuard(command: string): BashCommandGuardDecision {
  if (!FORBIDDEN_BASH_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    return { kind: 'allow' };
  }
  return {
    kind: 'block',
    reason:
      "This project's git hooks (D-047) enforce commit trailers and one-project-per-commit. " +
      'This command would bypass them. Ask the person running this session before working around it.',
  };
}

// No literal double quotes inside this text — the whole message is wrapped in a double-quoted
// `echo` below (`buildHarnessHookCommand`'s own comment on why that would end the string early);
// 'seeya project open <id>' uses single quotes for exactly that reason.
function missingVerifierMessage(nodePath: string, cliEntryPath: string): string {
  return (
    `seeya: the harness hook can't find its seeya binary (looked for ${nodePath} and ` +
    `${cliEntryPath}). Run 'seeya project open <id>' to reinstall it.`
  );
}

/**
 * The full `PreToolUse` hook command — one POSIX-shell expression (this module's own docstring on
 * why that's a safe assumption for Claude Code's hook execution, measured, not assumed). Checks
 * both `nodePath`/`cliEntryPath` exist before calling them, same "guarda falha fechada, com
 * mensagem clara" fix as `core/workspace-hooks.ts#buildCommitMsgHookScript`'s own missing-verifier
 * check — except this one exits `2` (blocks the tool call) on a missing verifier, never `0`
 * (`PreToolUse`'s own convention: only `2` blocks; any other nonzero is a warning the session can
 * shrug off, `https://code.claude.com/docs/en/hooks.md`).
 */
function buildHarnessHookCommand(
  nodePath: string,
  cliEntryPath: string,
  env: Readonly<Record<string, string>>,
): string {
  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${value} `)
    .join('');
  return (
    `if [ -f "${nodePath}" ] && [ -f "${cliEntryPath}" ]; then ` +
    `${envPrefix}"${nodePath}" "${cliEntryPath}" project verify-bash-command; ` +
    `else echo "${missingVerifierMessage(nodePath, cliEntryPath)}" >&2; exit 2; fi`
  );
}

/**
 * `https://code.claude.com/docs/en/hooks.md`'s own shape: `PreToolUse` hooks, matched on the exact
 * tool name `"Bash"` (case-sensitive), one `command`-type hook running the expression above.
 *
 * @example
 * JSON.parse(buildHarnessSettingsJson('/usr/bin/node', '/opt/seeya/dist/index.js'))
 * // { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'if [ -f ...' }] }] } }
 */
export function buildHarnessSettingsJson(
  nodePath: string,
  cliEntryPath: string,
  env: Readonly<Record<string, string>> = {},
): string {
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            { type: 'command', command: buildHarnessHookCommand(nodePath, cliEntryPath, env) },
          ],
        },
      ],
    },
  };
  return JSON.stringify(settings, null, 2) + '\n';
}
