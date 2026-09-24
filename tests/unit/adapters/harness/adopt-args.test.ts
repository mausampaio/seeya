/**
 * `buildAdoptArgs`/`buildAdoptionInstruction` (V2-T29, `packages/engine/src/adapters/harness/
 * adopt-args.ts`/`adopt-instruction.ts`) — same "`--add-dir` swallows the next positional argument
 * without a `--` terminator" gotcha `args.test.ts` already proves for `buildOpenArgs`
 * (`docs/spikes/N-adocao-de-sessao.md`'s Achado 1), now for the three-flag combination `--resume`
 * + `--fork-session` + `--session-id`.
 *
 * The `buildAdoptionInstruction` block below is the regression suite for the gap the maintainer's
 * own acceptance run found (task-23 comment #2): the earlier fixed `ADOPTION_INSTRUCTION` string
 * named files as bare `AGENTS.md`/`context/know-how.md` with no path attached, which a session
 * resumed OUTSIDE the project read as its own `cwd`. Every assertion here checks for the absolute
 * `projectDir` actually being present in front of each file — the exact fact the old string never
 * had, so these fail against that shape and only pass against the fix.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAdoptArgs } from '@seeya-ai/engine/adapters/harness/adopt-args.js';
import { buildAdoptionInstruction } from '@seeya-ai/engine/adapters/harness/adopt-instruction.js';

const ORIGINAL_SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FORK_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_DIR = path.join(path.sep, 'seeya', 'workspace', 'auth-hardening');

describe('buildAdoptArgs', () => {
  it('resumes the original into the fork, with the project dir released and the instruction last', () => {
    expect(buildAdoptArgs(ORIGINAL_SESSION_ID, FORK_SESSION_ID, PROJECT_DIR)).toEqual([
      '--resume',
      ORIGINAL_SESSION_ID,
      '--fork-session',
      '--session-id',
      FORK_SESSION_ID,
      '--add-dir',
      PROJECT_DIR,
      '--',
      buildAdoptionInstruction(PROJECT_DIR),
    ]);
  });

  /** The test that would fail without the explicit `--` terminator (same proof `args.test.ts`
   * gives for `buildOpenArgs`): asserting on the exact position, not just presence. */
  it('the instruction always comes right after a lone "--" terminator', () => {
    const args = buildAdoptArgs(ORIGINAL_SESSION_ID, FORK_SESSION_ID, PROJECT_DIR);
    const terminatorIndex = args.indexOf('--');
    const instruction = buildAdoptionInstruction(PROJECT_DIR);
    expect(terminatorIndex).toBeGreaterThan(0);
    expect(args.filter((arg) => arg === '--')).toHaveLength(1);
    expect(args[terminatorIndex + 1]).toBe(instruction);
    expect(args[args.length - 1]).toBe(instruction);
  });

  it('--add-dir names exactly projectDir, never a different or a second directory', () => {
    const args = buildAdoptArgs(ORIGINAL_SESSION_ID, FORK_SESSION_ID, PROJECT_DIR);
    const addDirIndex = args.indexOf('--add-dir');
    expect(args[addDirIndex + 1]).toBe(PROJECT_DIR);
    expect(args[addDirIndex + 2]).toBe('--');
  });
});

describe('buildAdoptionInstruction', () => {
  it('names the project directory itself, up front — the exact gap the acceptance run found', () => {
    const text = buildAdoptionInstruction(PROJECT_DIR);
    expect(text).toContain(`The project directory is ${PROJECT_DIR}`);
  });

  it('names every target file as an ABSOLUTE path under projectDir, never a bare filename', () => {
    const text = buildAdoptionInstruction(PROJECT_DIR);
    expect(text).toContain(path.join(PROJECT_DIR, 'AGENTS.md'));
    expect(text).toContain(path.join(PROJECT_DIR, 'INDEX.md'));
    expect(text).toContain(path.join(PROJECT_DIR, 'status'));
    expect(text).toContain(path.join(PROJECT_DIR, 'decisions'));
    expect(text).toContain(path.join(PROJECT_DIR, 'context', 'know-how.md'));
  });

  it('closes with "write only inside" the same absolute projectDir', () => {
    const text = buildAdoptionInstruction(PROJECT_DIR);
    expect(text).toMatch(new RegExp(`Write only inside ${escapeRegExp(PROJECT_DIR)}\\.$`));
  });

  it('a session resumed in a DIFFERENT directory than the project can still find the target files — the exact regression', () => {
    // The bug: a fixed instruction naming only "AGENTS.md" (relative) reads, from a session whose
    // own cwd is NOT the project, as "write AGENTS.md in MY cwd" — nothing about the project's own
    // path at all. This asserts the opposite: every file name IS the project's absolute path, so
    // there is nothing left for a session in some other directory to misresolve.
    const originalCwd = path.join(path.sep, 'code', 'some-unrelated-repo');
    const text = buildAdoptionInstruction(PROJECT_DIR);
    expect(text).not.toContain(originalCwd);
    expect(text).toContain(PROJECT_DIR);
    // Every file mention is prefixed by projectDir — a bare "AGENTS.md" with nothing in front of
    // it (the old, broken shape) never appears.
    expect(text).not.toMatch(/(?<!\S)AGENTS\.md/);
  });

  it('mentions memory only as something to carry INTO the named files, never as a bare destination (Spike N Pergunta 2, item 5)', () => {
    // Spike N's own guardrail was against a text built ONLY around the word "memory" with no file
    // named — that reads as "use your own memory mechanism" and writes outside the project
    // entirely. Item 5 (maintainer, 2026-09-24) asks the session to carry ITS OWN local memory and
    // instructions INTO the project instead — "memory" is expected here now, but only ever next to
    // the concrete, named files it has to land in.
    const text = buildAdoptionInstruction(PROJECT_DIR);
    expect(text.toLowerCase()).toContain('memory');
    expect(text).toContain(path.join(PROJECT_DIR, 'AGENTS.md'));
    expect(text).toContain(path.join(PROJECT_DIR, 'context', 'know-how.md'));
  });

  it('tells secrets by path, never by value', () => {
    expect(buildAdoptionInstruction(PROJECT_DIR)).toMatch(/never its value/);
  });

  it('stays well under the measured Windows command-line ceiling (D-015), even with a long path', () => {
    const longProjectDir = path.join(
      path.sep,
      'Users',
      'a-fairly-long-windows-username-example',
      '.seeya',
      'workspace',
      'a-fairly-long-project-identifier-example',
    );
    expect(buildAdoptionInstruction(longProjectDir).length).toBeLessThan(3000);
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
