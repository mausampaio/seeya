/**
 * V2-T12 item 2: the guard against the shortcut-icon corruption this task fixed
 * (docs/PLANO-DE-ENTREGA.md V2-T12). `checkDescriptionLength`'s own docstring in
 * `packages/app/scripts/check-package-description.mjs` has the isolated, measured reproduction
 * (a disposable .lnk in $env:TEMP, read back with WScript.Shell — never the maintainer's real
 * installed shortcut) that found the 260-character hard limit this guard's own
 * `DESCRIPTION_LENGTH_LIMIT` sits under with margin.
 *
 * The second test below is the regression proof: it reads the real
 * `packages/app/package.json` and would have failed before this task, when "description" held a
 * ~500-character architectural paragraph — see the git history of that field for the value this
 * test used to reject.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkDescriptionLength,
  DESCRIPTION_LENGTH_LIMIT,
} from '../../../../packages/app/scripts/check-package-description.mjs';

const appPackageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/app/package.json',
);

describe('checkDescriptionLength', () => {
  it('accepts a description at exactly the limit', () => {
    const description = 'x'.repeat(DESCRIPTION_LENGTH_LIMIT);

    expect(checkDescriptionLength(description)).toEqual({ ok: true });
  });

  it('accepts a short, one-line description', () => {
    expect(checkDescriptionLength('Desktop interface for seeya: an embedded terminal.')).toEqual({
      ok: true,
    });
  });

  it('rejects a description one character over the limit, naming the size found and expected', () => {
    const description = 'x'.repeat(DESCRIPTION_LENGTH_LIMIT + 1);

    const result = checkDescriptionLength(description);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected checkDescriptionLength to reject an over-limit description');
    }
    expect(result.reason).toContain(String(DESCRIPTION_LENGTH_LIMIT + 1));
    expect(result.reason).toContain(String(DESCRIPTION_LENGTH_LIMIT));
    expect(result.reason).toContain(description);
  });

  // Regression proof (AGENTS.md § Testes: "o teste falha antes da correção"). The exact text that
  // lived in packages/app/package.json's own "description" before this task, over the
  // 260-character hard limit measured in check-package-description.mjs's own docstring — this
  // guard rejects it, which is what this task's fix (a short description, git history has the
  // old value) had to satisfy.
  it('rejects the ~500-character description packages/app/package.json used to have', () => {
    const formerDescription =
      "Desktop interface for seeya (D-042): an embedded terminal (Electron + @xterm/xterm + node-pty) that shows the sessions this machine discovers and lets a person open the harness in a tab. Second composition root (D-043) — consumes @seeya-ai/engine in-process. V2-T5b: also resolves @seeya-ai/cli's own compiled bin entry point (never imports its source) to spawn the daemon worker as a detached child, the same subprocess @seeya-ai/cli's own `seeya daemon` launches for itself.";

    const result = checkDescriptionLength(formerDescription);

    expect(result.ok).toBe(false);
  });

  // Regression proof (AGENTS.md § Testes: "toda correção de bug tem teste de regressão"). Before
  // this task, packages/app/package.json's own "description" was long enough to corrupt the
  // Windows Start Menu shortcut's icon field — this reads the real, current file, so it would
  // have failed against that value and now passes against the shortened one.
  it('accepts the description currently in packages/app/package.json', () => {
    const appPackageJson = JSON.parse(readFileSync(appPackageJsonPath, 'utf8')) as {
      description: unknown;
    };
    if (typeof appPackageJson.description !== 'string') {
      throw new Error(
        `packages/app/package.json's own "description" is ${typeof appPackageJson.description}, expected a string`,
      );
    }

    const result = checkDescriptionLength(appPackageJson.description);

    expect(result).toEqual({ ok: true });
  });
});
