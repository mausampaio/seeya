/**
 * REAL execution of the harness's own `PreToolUse` hook `command` (V2-T34 item 2, PO review) —
 * not a simulation of `decideBashCommandGuard` (that's `tests/unit/core/harness-hook-config.test.ts`'s
 * job), but the actual generated shell expression, run through a real POSIX shell with a real
 * `PreToolUse` JSON payload on stdin — the exact shape Claude Code itself hands a hook `command`
 * (`core/harness-hook-config.ts`'s own docstring: measured, not assumed, that Claude Code executes
 * `command` through a real shell).
 *
 * Claude Code's own hook mechanism never forwards a git process's stdin (measured for this task:
 * a `pre-commit` hook reading `/dev/null` regardless of what the invoking `git commit` was piped),
 * so this can't reuse `commit-msg-hook.test.ts`'s own "install as a real git hook" trick — instead
 * this resolves the SAME POSIX shell Git for Windows bundles (`git --exec-path`'s own sibling
 * `bin/sh.exe`, confirmed for real against this machine's own git install) and spawns it directly,
 * with the payload written to its stdin.
 *
 * V2-T34 production defect (PO review, 2026-09-25): `cliEntryPath` under a REAL, packaged install
 * lives inside `app.asar` — a real FILE Electron reads through, but an ordinary one to any shell's
 * `[ -f ... ]`. Before the fix, the pre-flight existence check ran against the full, never-real
 * inner path and refused every Bash tool call with "can't find its seeya binary." This proves the
 * fixed check passes against a real `.asar` FILE on disk and lets an allowed command through.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildHarnessSettingsJson } from '@seeya-ai/engine/core/harness-hook-config.js';

const execFileAsync = promisify(execFile);

interface ShellCommandAttempt {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Resolves a real POSIX shell to run a hook `command` expression through — Claude Code's own
 * hook execution supports the same `KEY=value cmd` env-prefix syntax a plain `sh -c` does
 * (`core/harness-hook-config.ts`'s own docstring on that measurement), so this is a faithful
 * stand-in for how Claude Code itself would run this string. On Windows, `sh` is never reliably on
 * `PATH` (measured for this task: a plain `Get-Command sh` finds nothing outside a Git Bash shell
 * session) — `git --exec-path` names `<gitRoot>/mingw64/libexec/git-core`, and Git for Windows
 * always ships its own bundled POSIX shell at `<gitRoot>/bin/sh.exe` (confirmed for real on this
 * machine). Elsewhere, `sh` is always on `PATH`. */
async function resolveShExecutable(): Promise<string> {
  if (process.platform !== 'win32') {
    return 'sh';
  }
  const { stdout } = await execFileAsync('git', ['--exec-path']);
  // `<gitRoot>/mingw64/libexec/git-core` -> `<gitRoot>` (three levels: git-core, libexec, mingw64).
  const gitRoot = path.dirname(path.dirname(path.dirname(stdout.trim())));
  return path.join(gitRoot, 'bin', 'sh.exe');
}

async function runShellCommand(
  shExecutable: string,
  command: string,
  stdin: string,
): Promise<ShellCommandAttempt> {
  return new Promise((resolve) => {
    const child = spawn(shExecutable, ['-c', command], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

function extractHookCommand(settingsJson: string): string {
  const settings = JSON.parse(settingsJson) as {
    hooks: { PreToolUse: { hooks: { command: string }[] }[] };
  };
  const command = settings.hooks.PreToolUse[0]?.hooks[0]?.command;
  if (command === undefined) {
    throw new Error(`no PreToolUse hook command in generated settings: ${settingsJson}`);
  }
  return command;
}

describe('the harness PreToolUse hook command — real execution', () => {
  let dir: string | undefined;
  let shExecutable: string;

  beforeAll(async () => {
    shExecutable = await resolveShExecutable();
  }, 30_000);

  afterEach(async () => {
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  async function makeTmpDir(): Promise<string> {
    const created = await mkdtemp(path.join(tmpdir(), 'seeya-harness-hook-'));
    dir = created;
    return created;
  }

  it('refuses with a clear message (never a raw shell error) when the recorded seeya binary is missing', async () => {
    const scratch = await makeTmpDir();
    const missingNodePath = path.join(scratch, 'this-node-binary-does-not-exist');
    const settings = buildHarnessSettingsJson(missingNodePath, path.join(scratch, 'index.js'));
    const command = extractHookCommand(settings);

    const attempt = await runShellCommand(
      shExecutable,
      command,
      JSON.stringify({ tool_input: { command: 'echo hi' } }),
    );

    expect(attempt.exitCode).toBe(2); // PreToolUse: only exit 2 blocks
    expect(attempt.stderr).toContain(missingNodePath);
    expect(attempt.stderr).toContain('seeya project open');
  }, 30_000);

  it('lets an allowed command through when cliEntryPath is inside a real .asar FILE (V2-T34 production defect, PO review 2026-09-25)', async () => {
    const scratch = await makeTmpDir();
    // A REAL file named exactly like Electron's own asar archive — same production defect as the
    // git hook: `[ -f "$cliEntryPath" ]` on the full inner path always failed against this, even
    // though the .asar file itself is right there.
    const asarPath = path.join(scratch, 'app.asar');
    await writeFile(asarPath, 'not a real asar archive, just needs to exist as a file\n');
    const cliEntryPath = path.join(
      asarPath,
      'node_modules',
      '@seeya-ai',
      'cli',
      'dist',
      'index.js',
    );
    // Stand-in for the packaged `seeya` binary — plain node can never actually read INSIDE a real
    // `.asar` (only Electron's own patched `fs` can); this proves what's actually under test here
    // (the shell's own pre-flight check and argument/stdin plumbing), the same substitution
    // `commit-msg-hook.test.ts`'s own asar test uses for the identical reason. It reads its own
    // stdin (proving the payload really reaches the process this hook launches) and always exits
    // 0 — exactly what an allowed command looks like from the hook's own point of view
    // (`decideBashCommandGuard`'s own decision logic is unit-tested elsewhere).
    const fakeNodePath = path.join(scratch, 'fake-seeya-node');
    await writeFile(fakeNodePath, '#!/bin/sh\ncat >/dev/null\nexit 0\n');
    await chmod(fakeNodePath, 0o755);
    const settings = buildHarnessSettingsJson(fakeNodePath, cliEntryPath);
    const command = extractHookCommand(settings);

    const attempt = await runShellCommand(
      shExecutable,
      command,
      JSON.stringify({ tool_input: { command: 'echo hi' } }),
    );

    // The FIX under test: before it, this always refused with "can't find its seeya binary" and
    // exit 2 — the existence check ran against the full, never-real inner path.
    expect(attempt.stderr).not.toContain("can't find its seeya binary");
    expect(attempt.exitCode).toBe(0);
  }, 30_000);
});
