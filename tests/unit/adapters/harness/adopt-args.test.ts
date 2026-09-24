/**
 * `buildAdoptArgs` (V2-T29, `packages/engine/src/adapters/harness/adopt-args.ts`) — same
 * "`--add-dir` swallows the next positional argument without a `--` terminator" gotcha
 * `args.test.ts` already proves for `buildOpenArgs` (`docs/spikes/N-adocao-de-sessao.md`'s Achado
 * 1), now for the three-flag combination `--resume` + `--fork-session` + `--session-id`.
 */
import { describe, expect, it } from 'vitest';
import { buildAdoptArgs } from '@seeya-ai/engine/adapters/harness/adopt-args.js';
import { ADOPTION_INSTRUCTION } from '@seeya-ai/engine/adapters/harness/adopt-instruction.js';

const ORIGINAL_SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FORK_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_DIR = '/seeya/workspace/auth-hardening';

describe('buildAdoptArgs', () => {
  it('resumes the original into the fork, with the project dir released and the instruction last', () => {
    expect(buildAdoptArgs(ORIGINAL_SESSION_ID, FORK_SESSION_ID, [PROJECT_DIR])).toEqual([
      '--resume',
      ORIGINAL_SESSION_ID,
      '--fork-session',
      '--session-id',
      FORK_SESSION_ID,
      '--add-dir',
      PROJECT_DIR,
      '--',
      ADOPTION_INSTRUCTION,
    ]);
  });

  it('several directories: all listed, THEN the terminator, THEN the instruction', () => {
    const args = buildAdoptArgs(ORIGINAL_SESSION_ID, FORK_SESSION_ID, [
      PROJECT_DIR,
      '/code/app-api',
    ]);
    expect(args).toEqual([
      '--resume',
      ORIGINAL_SESSION_ID,
      '--fork-session',
      '--session-id',
      FORK_SESSION_ID,
      '--add-dir',
      PROJECT_DIR,
      '/code/app-api',
      '--',
      ADOPTION_INSTRUCTION,
    ]);
  });

  /** The test that would fail without the explicit `--` terminator (same proof `args.test.ts`
   * gives for `buildOpenArgs`): asserting on the exact position, not just presence. */
  it('the instruction always comes right after a lone "--" terminator', () => {
    const args = buildAdoptArgs(ORIGINAL_SESSION_ID, FORK_SESSION_ID, [PROJECT_DIR]);
    const terminatorIndex = args.indexOf('--');
    expect(terminatorIndex).toBeGreaterThan(0);
    expect(args.filter((arg) => arg === '--')).toHaveLength(1);
    expect(args[terminatorIndex + 1]).toBe(ADOPTION_INSTRUCTION);
    expect(args[args.length - 1]).toBe(ADOPTION_INSTRUCTION);
  });

  it('no directories at all: --add-dir is never emitted, but the terminator still precedes the instruction', () => {
    expect(buildAdoptArgs(ORIGINAL_SESSION_ID, FORK_SESSION_ID, [])).toEqual([
      '--resume',
      ORIGINAL_SESSION_ID,
      '--fork-session',
      '--session-id',
      FORK_SESSION_ID,
      '--',
      ADOPTION_INSTRUCTION,
    ]);
  });
});

describe('ADOPTION_INSTRUCTION', () => {
  it('names the target files explicitly, never the bare word "memory" (Spike N Pergunta 2)', () => {
    expect(ADOPTION_INSTRUCTION).toContain('AGENTS.md');
    expect(ADOPTION_INSTRUCTION).toContain('INDEX.md');
    expect(ADOPTION_INSTRUCTION).toContain('status/');
    expect(ADOPTION_INSTRUCTION).toContain('decisions/');
    expect(ADOPTION_INSTRUCTION).toContain('context/know-how.md');
    expect(ADOPTION_INSTRUCTION.toLowerCase()).not.toContain('memory');
  });

  it('tells secrets by path, never by value', () => {
    expect(ADOPTION_INSTRUCTION).toMatch(/never its value/);
  });

  it('stays well under the measured Windows command-line ceiling (D-015)', () => {
    expect(ADOPTION_INSTRUCTION.length).toBeLessThan(2000);
  });
});
