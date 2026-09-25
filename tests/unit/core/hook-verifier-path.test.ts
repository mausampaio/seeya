/**
 * `core/hook-verifier-path.ts` (V2-T34 production defect, PO review 2026-09-25). Pure —
 * `tests/integration/workspace/commit-msg-hook.test.ts`/`tests/integration/harness/
 * harness-hook-command.test.ts` prove the real shell script passes its `-f` check against a real
 * `.asar` file on disk.
 */
import { describe, expect, it } from 'vitest';
import { resolveHookVerifierCheckPath } from '@seeya-ai/engine/core/hook-verifier-path.js';

describe('resolveHookVerifierCheckPath', () => {
  it('truncates a POSIX path at the .asar segment', () => {
    expect(
      resolveHookVerifierCheckPath(
        '/opt/seeya/resources/app.asar/node_modules/@seeya-ai/cli/dist/index.js',
      ),
    ).toBe('/opt/seeya/resources/app.asar');
  });

  it('truncates a Windows path at the .asar segment', () => {
    expect(
      resolveHookVerifierCheckPath(
        'C:\\Program Files\\seeya\\resources\\app.asar\\node_modules\\@seeya-ai\\cli\\dist\\index.js',
      ),
    ).toBe('C:\\Program Files\\seeya\\resources\\app.asar');
  });

  it('leaves a path with no .asar segment unchanged', () => {
    expect(resolveHookVerifierCheckPath('/opt/seeya/dist/index.js')).toBe(
      '/opt/seeya/dist/index.js',
    );
    expect(resolveHookVerifierCheckPath('C:\\seeya\\dist\\index.js')).toBe(
      'C:\\seeya\\dist\\index.js',
    );
  });

  it('leaves a path that only LOOKS like it has .asar in it unchanged (not a real segment boundary)', () => {
    expect(resolveHookVerifierCheckPath('/opt/seeya/foo.asarchive/index.js')).toBe(
      '/opt/seeya/foo.asarchive/index.js',
    );
  });

  it('returns the path unchanged when it IS exactly the .asar file, with nothing after it', () => {
    expect(resolveHookVerifierCheckPath('/opt/seeya/resources/app.asar')).toBe(
      '/opt/seeya/resources/app.asar',
    );
  });
});
