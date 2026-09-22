/**
 * `buildOpenArgs` (V2-T28, `packages/engine/src/adapters/harness/args.ts`) —
 * `docs/PLANO-DE-ENTREGA.md` V2-T28 item 3: "a montagem dos argumentos termina a lista do
 * `--add-dir` explicitamente, com teste que falharia sem isso" (docs/spikes/N-adocao-de-sessao.md's
 * own Achado 1: `--add-dir` is variadic and swallows the next positional argument).
 */
import { describe, expect, it } from 'vitest';
import { buildOpenArgs } from '@seeya-ai/engine/adapters/harness/args.js';

describe('buildOpenArgs', () => {
  it('no directories — no --add-dir at all, nothing to terminate', () => {
    expect(buildOpenArgs([])).toEqual([]);
  });

  it('one directory: --add-dir <dir> --', () => {
    expect(buildOpenArgs(['/code/app-api'])).toEqual(['--add-dir', '/code/app-api', '--']);
  });

  it('several directories: all listed, THEN the terminator', () => {
    expect(buildOpenArgs(['/code/app-api', '/code/app-web'])).toEqual([
      '--add-dir',
      '/code/app-api',
      '/code/app-web',
      '--',
    ]);
  });

  /**
   * The test that would fail without the explicit `--` terminator: a naive implementation that
   * just did `['--add-dir', ...addDirs]` would produce THIS same array minus the last element —
   * asserting on the exact last element (not just `.toContain('--')`, which an array containing
   * `--` as a directory name could also satisfy by accident) is what makes this test actually
   * prove the terminator is there, on purpose, in the right place.
   */
  it('the array always ends with the literal "--" terminator when any directory is present', () => {
    const args = buildOpenArgs(['/code/app-api', '/code/app-web']);
    expect(args[args.length - 1]).toBe('--');
    expect(args.filter((arg) => arg === '--')).toHaveLength(1);
  });
});
