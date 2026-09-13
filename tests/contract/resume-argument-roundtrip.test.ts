/**
 * Contract test for `claude --resume <id> "<prompt>"` — `buildResumeArgs`'s exact production shape
 * (`src/adapters/resumption/args.ts`), never `-p` (S5-T9, docs/QUESTOES.md Q-069, D-004).
 *
 * **Why this exists.** On 2026-09-13 `start-day` reported a 4,135-character handoff as "too long
 * to pass safely" against the old 4096-character ceiling — 39 characters over, for a plan the
 * project's own real handoffs (1.8k-4k characters) already sit near the middle of. S5-T9 raised
 * `RESUME_PROMPT_ARG_LIMIT_CHARS` to 16,384 against two measurements: a `node`-based binary search
 * for the real Windows command-line ceiling (~32,612-32,656 UTF-16 units), and a one-off manual
 * round trip at 16,384 characters through this exact argv shape. **This file is that manual round
 * trip turned into a permanent, repeatable proof — at the REAL case's length (4,135 characters),
 * not just the new ceiling** — so a future `claude` upgrade that silently starts truncating or
 * mangling long positional arguments fails a test here instead of surfacing again as a maintainer
 * losing a week of session history.
 *
 * **What this test can and cannot prove.** It proves the argv reaches the model intact: a start
 * marker, an end marker, and the hostile characters Spike H already exercised (newline, both quote
 * types, `%`, accented characters, a backtick, a trailing backslash) all survive at the real case's
 * length. **It does not prove interactive delivery** — this machine has no real TTY
 * (`process.stdin.isTTY` is `undefined` here), so per Spike H the call below degrades to a single
 * non-interactive reply instead of opening a resumable session. That degradation is irrelevant to
 * what this test measures: argv fidelity is a property of `spawn(bin, [...args], {shell:false})`
 * itself, identical whether or not a TTY is attached on the other end (Spike H: "a mecânica de
 * passagem de argv é a mesma independente de -p" — the same holds for TTY presence, since neither
 * changes how the OS marshals argv into the child process). A real interactive TTY round trip
 * remains unmeasured — see Q-069 for what the maintainer still needs to close in a real terminal.
 *
 * **Invocation count: exactly 2 real `claude` calls per run** — one to create a disposable,
 * persisted session (needed so there is something to `--resume`), one to resume it with the real
 * case's exact prompt length. `cwd` is a disposable `mkdtemp` folder; the session and its
 * transcript under `~/.claude/projects/<slug>/` are deleted in `afterAll`, never left behind
 * (AGENTS.md § "Sistema de arquivos" doesn't apply to `~/.claude` directly, but the same care that
 * applies to `~/.seeya/` extends to not littering the real machine `test:contrato` runs against).
 * Environment sanitized the same way production does (D-017, reusing
 * `adapters/resumption/env.ts#buildResumptionEnv`, not a second variable list).
 *
 * Doesn't run in standard CI — only via `npm run test:contrato`, same as the rest of this
 * directory (docs/TESTES.md § Contrato).
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildResumeArgs } from '../../src/adapters/resumption/args.js';
import { buildResumptionEnv } from '../../src/adapters/resumption/env.js';
import { getClaudeCodeVersion } from './_support.js';

const version = getClaudeCodeVersion();

/** The 2026-09-13 real case (docs/PLANO-DE-ENTREGA.md S5-T9) that exceeded the old 4096-character
 * ceiling by 39 characters. Not `RESUME_PROMPT_ARG_LIMIT_CHARS` itself — proving the exact case
 * that motivated this task matters more here than proving the ceiling number, which the unit
 * suite (`tests/unit/adapters/resumption/args.test.ts`) already checks arithmetically. */
const REAL_CASE_LENGTH = 4_135;

const START_MARKER = 'SEEYA-CONTRACT-RESUME-START';
const END_MARKER = 'SEEYA-CONTRACT-RESUME-END';

/** Same hostile characters Spike H already measured through this argv shape (newline, both quote
 * types, `%`, accented characters, a backtick, a trailing backslash) — this test isn't proving
 * those survive for the first time, it's proving they STILL survive at the real case's length, on
 * whatever `claude` version is installed now. */
const HOSTILE_MIDDLE =
  '\nline two with "double" and \'single\' quotes, a % sign, acentos (ação, não, café), a backtick ' +
  '` and a trailing backslash\\\n';

function buildHostilePrompt(totalLength: number): string {
  const head = `${START_MARKER}\n`;
  const tail = `\n${END_MARKER}`;
  const fillerLength = totalLength - head.length - HOSTILE_MIDDLE.length - tail.length;
  if (fillerLength < 0) {
    throw new Error(
      `buildHostilePrompt: totalLength ${totalLength} is too short for the fixed head/middle/tail ` +
        `(needs at least ${head.length + HOSTILE_MIDDLE.length + tail.length}).`,
    );
  }
  return head + 'x'.repeat(fillerLength) + HOSTILE_MIDDLE + tail;
}

interface RawCallResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function callClaude(cwd: string, args: readonly string[]): RawCallResult {
  const result = spawnSync('claude', args, {
    cwd,
    env: buildResumptionEnv(process.env),
    encoding: 'utf8',
    shell: false,
    timeout: 120_000,
  });
  return { exitCode: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe(`contract: claude --resume <id> "<prompt>" round-trips the real 4,135-char case (claude ${version})`, () => {
  let cwd: string;
  let sessionId: string;
  let resumed: RawCallResult;
  const prompt = buildHostilePrompt(REAL_CASE_LENGTH);

  beforeAll(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'seeya-contract-resume-roundtrip-'));

    const create = spawnSync(
      'claude',
      ['-p', '--model', 'haiku', '--output-format', 'json', 'Reply with exactly: OK'],
      {
        cwd,
        env: buildResumptionEnv(process.env),
        encoding: 'utf8',
        shell: false,
        timeout: 120_000,
      },
    );
    if (create.status !== 0) {
      throw new Error(
        `Could not create the disposable session this test resumes. exit=${String(create.status)} ` +
          `stdout: ${create.stdout} stderr: ${create.stderr}`,
      );
    }
    sessionId = (JSON.parse(create.stdout) as { session_id: string }).session_id;

    // Exactly `buildResumeArgs`'s own shape — never `-p`. Asked to answer with plain text (not
    // `--output-format json`/`--json-schema`, both of which are `-p`-mode features) so this
    // measures the same non-JSON code path production actually spawns.
    //
    // "the marker at the very start" (not "text between the marker and the newline after it", the
    // first phrasing tried) — that first wording is technically ambiguous, since the marker is
    // immediately followed by a newline with nothing between them, and a real run measured the
    // model taking that literally and replying blank for that field. Asking for the marker itself
    // removed the ambiguity.
    const askSuffix =
      '\n\nReply with EXACTLY, and nothing else, in this order separated by " | ": (1) the exact ' +
      'marker string that appears at the very start of this message, on its own line before ' +
      'anything else; (2) the single word PRESENT if this message contains a percent sign, a ' +
      'backtick, AND the word "café", or MISSING if any of those three is absent; (3) the last 30 ' +
      'characters of this entire message, verbatim.';
    resumed = callClaude(cwd, buildResumeArgs(sessionId, prompt + askSuffix));
  }, 180_000);

  afterAll(async () => {
    const projectsDir = path.join(homedir(), '.claude', 'projects');
    try {
      const entries = await readdir(projectsDir);
      for (const entry of entries) {
        if (entry.toLowerCase().includes(path.basename(cwd).toLowerCase())) {
          await rm(path.join(projectsDir, entry), { recursive: true, force: true });
        }
      }
    } catch {
      // Best-effort: a machine where `~/.claude/projects` doesn't exist or isn't readable leaves
      // nothing of this test's own to clean up either.
    }
    await rm(cwd, { recursive: true, force: true });
  });

  it('exits 0 — the OS and claude both accept a 4,135-character positional argument', () => {
    expect(
      resumed.exitCode,
      `\`claude --resume\` exited non-zero for a ${REAL_CASE_LENGTH}-character prompt. ` +
        `stdout: ${resumed.stdout}\nstderr: ${resumed.stderr}`,
    ).toBe(0);
  });

  it('the start marker, hostile characters, and end marker all survive intact', () => {
    const reply = resumed.stdout;
    expect(
      reply,
      `Expected the start marker in the reply. Full reply:\n${reply}\nstderr: ${resumed.stderr}`,
    ).toContain(START_MARKER);
    // Pins the FACT the model reports (all three hostile characters survived), not the exact
    // words it reports it in — same reasoning `append-system-prompt-file.test.ts
    // #identifiesAsClaudeCode` uses for its own loose match.
    expect(
      reply,
      `Expected "PRESENT" (percent sign + backtick + "café" all survived). Full reply:\n${reply}`,
    ).toContain('PRESENT');
    expect(
      reply,
      `Expected the end marker in the reply — its absence would mean the argument got cut off ` +
        `before the end. Full reply:\n${reply}`,
    ).toContain(END_MARKER);
  });
});
