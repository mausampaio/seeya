import { describe, expect, it } from 'vitest';
import { formatManifestRestoreLines } from '../../../packages/cli/src/format-manifest-restore.js';

describe('formatManifestRestoreLines', () => {
  it('returns no lines when nothing was restored', () => {
    expect(formatManifestRestoreLines({ kind: 'unchanged' })).toEqual([]);
  });

  it('returns no lines for a workspace with no committed version at all (D-025)', () => {
    expect(formatManifestRestoreLines({ kind: 'noCommittedVersion' })).toEqual([]);
  });

  it('reports what was discarded, never silently, for a real restore', () => {
    const lines = formatManifestRestoreLines({
      kind: 'restored',
      diffSummary:
        'auth-hardening/seeya.json | 4 +++-\n 1 file changed, 3 insertions(+), 1 deletion(-)',
    });
    expect(lines[0]).toContain('restored to the last committed version');
    expect(lines.slice(1)).toEqual([
      '  auth-hardening/seeya.json | 4 +++-',
      // `git diff --stat`'s own second line already starts with one space of its own — this
      // function prefixes two more, uniformly, rather than trimming what git already formatted.
      '   1 file changed, 3 insertions(+), 1 deletion(-)',
    ]);
  });

  it('drops blank lines from the diff summary', () => {
    const lines = formatManifestRestoreLines({
      kind: 'restored',
      diffSummary: 'auth-hardening/seeya.json | 1 +\n\n',
    });
    expect(lines).toEqual([
      'seeya: "seeya.json" had uncommitted changes — restored to the last committed version. ' +
        'Discarded:',
      '  auth-hardening/seeya.json | 1 +',
    ]);
  });
});
