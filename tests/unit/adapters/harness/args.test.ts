/**
 * `buildOpenArgs` (V2-T28, `packages/engine/src/adapters/harness/args.ts`) —
 * `docs/PLANO-DE-ENTREGA.md` V2-T28 item 3: "a montagem dos argumentos termina a lista do
 * `--add-dir` explicitamente, com teste que falharia sem isso" (docs/spikes/N-adocao-de-sessao.md's
 * own Achado 1: `--add-dir` is variadic and swallows the next positional argument). V2-T35 items
 * 2/4 added `--session-id`/`--append-system-prompt`, always placed BEFORE `--add-dir`.
 */
import { describe, expect, it } from 'vitest';
import { buildOpenArgs } from '@seeya-ai/engine/adapters/harness/args.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

describe('buildOpenArgs', () => {
  it('no directories, no system prompt append — just --session-id', () => {
    expect(buildOpenArgs([], SESSION_ID, null)).toEqual(['--session-id', SESSION_ID]);
  });

  it('one directory: --session-id <id> --add-dir <dir> --', () => {
    expect(buildOpenArgs(['/code/app-api'], SESSION_ID, null)).toEqual([
      '--session-id',
      SESSION_ID,
      '--add-dir',
      '/code/app-api',
      '--',
    ]);
  });

  it('several directories: all listed, THEN the terminator', () => {
    expect(buildOpenArgs(['/code/app-api', '/code/app-web'], SESSION_ID, null)).toEqual([
      '--session-id',
      SESSION_ID,
      '--add-dir',
      '/code/app-api',
      '/code/app-web',
      '--',
    ]);
  });

  it('a system prompt append comes right after --session-id, before --add-dir', () => {
    expect(buildOpenArgs(['/code/app-api'], SESSION_ID, 'Project note')).toEqual([
      '--session-id',
      SESSION_ID,
      '--append-system-prompt',
      'Project note',
      '--add-dir',
      '/code/app-api',
      '--',
    ]);
  });

  it('null system prompt append never adds the flag at all', () => {
    const args = buildOpenArgs([], SESSION_ID, null);
    expect(args).not.toContain('--append-system-prompt');
  });

  /**
   * The test that would fail without the explicit `--` terminator: a naive implementation that
   * just did `['--add-dir', ...addDirs]` would produce THIS same array minus the last element —
   * asserting on the exact last element (not just `.toContain('--')`, which an array containing
   * `--` as a directory name could also satisfy by accident) is what makes this test actually
   * prove the terminator is there, on purpose, in the right place.
   */
  it('the array always ends with the literal "--" terminator when any directory is present', () => {
    const args = buildOpenArgs(['/code/app-api', '/code/app-web'], SESSION_ID, null);
    expect(args[args.length - 1]).toBe('--');
    expect(args.filter((arg) => arg === '--')).toHaveLength(1);
  });
});
