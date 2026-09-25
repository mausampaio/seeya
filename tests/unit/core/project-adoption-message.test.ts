/**
 * `core/project-adoption-message.ts` (V2-T30) — pure text, no I/O. Shared by `cli/format-project.ts`
 * and the app's own adoption dialogs (`packages/app/src/electron/project-panel-view.ts`), the same
 * movement V2-T35 made for `project-lock-message.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  renderAdoptionCommitChangedFilesLines,
  renderAdoptionLaunchExplanationLines,
} from '@seeya-ai/engine/core/project-adoption-message.js';

describe('renderAdoptionLaunchExplanationLines', () => {
  it('names the original cwd, the project directory and the follow-up command', () => {
    const lines = renderAdoptionLaunchExplanationLines(
      '/code/app',
      '/seeya/workspace/auth-hardening',
      'auth-hardening',
    );
    const text = lines.join('\n');
    expect(text).toContain('/code/app');
    expect(text).toContain('/seeya/workspace/auth-hardening');
    expect(text).toContain('seeya project open auth-hardening');
    expect(text).not.toContain('Continue?');
  });
});

describe('renderAdoptionCommitChangedFilesLines', () => {
  it('lists every changed file, one per line', () => {
    const lines = renderAdoptionCommitChangedFilesLines(['AGENTS.md', 'INDEX.md']);
    expect(lines).toEqual([
      'The session wrote the following inside the project:',
      '  AGENTS.md',
      '  INDEX.md',
    ]);
  });

  it('an empty list still names the situation, with no file lines', () => {
    const lines = renderAdoptionCommitChangedFilesLines([]);
    expect(lines).toEqual(['The session wrote the following inside the project:']);
  });
});
