import { describe, expect, it } from 'vitest';
import { formatManifestRestoreSuffix } from '../../../../packages/app/src/state/manifest-restore-suffix.js';

describe('formatManifestRestoreSuffix', () => {
  it('returns an empty string when nothing was restored', () => {
    expect(formatManifestRestoreSuffix({ kind: 'unchanged' })).toBe('');
  });

  it('returns an empty string for a workspace with no committed version at all (D-025)', () => {
    expect(formatManifestRestoreSuffix({ kind: 'noCommittedVersion' })).toBe('');
  });

  it('reports what was discarded, never silently, for a real restore, on one line', () => {
    const suffix = formatManifestRestoreSuffix({
      kind: 'restored',
      diffSummary: 'seeya.json | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)',
    });
    expect(suffix).toContain('restored to the last committed version');
    expect(suffix).not.toContain('\n');
  });
});
