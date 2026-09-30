/**
 * `MANIFEST_OWNERSHIP_NOTE` (V2-T72 item 3) — "texto num lugar só": proves the identical sentence
 * shows up, verbatim, in both places a session reads it from (`core/project-working-rules.ts`'s
 * own working rules for `open`, and `adapters/harness/adopt-instruction.ts`'s own first turn for
 * `adopt`), so a change to the wording can never drift between the two.
 */
import { describe, expect, it } from 'vitest';
import { MANIFEST_OWNERSHIP_NOTE } from '@seeya-ai/engine/core/project-manifest-ownership.js';
import { buildProjectWorkingRulesText } from '@seeya-ai/engine/core/project-working-rules.js';
import { buildAdoptionInstruction } from '@seeya-ai/engine/adapters/harness/adopt-instruction.js';

describe('MANIFEST_OWNERSHIP_NOTE', () => {
  it('names seeya.json and points to "seeya project add-repo"', () => {
    expect(MANIFEST_OWNERSHIP_NOTE).toContain('seeya.json');
    expect(MANIFEST_OWNERSHIP_NOTE).toContain('seeya project add-repo');
  });

  it('appears verbatim in the working rules given to every "open"', () => {
    expect(buildProjectWorkingRulesText('auth-hardening')).toContain(MANIFEST_OWNERSHIP_NOTE);
  });

  it("appears verbatim in the adoption fork's own first-turn instruction", () => {
    expect(buildAdoptionInstruction('/seeya/workspace/auth-hardening')).toContain(
      MANIFEST_OWNERSHIP_NOTE,
    );
  });
});
