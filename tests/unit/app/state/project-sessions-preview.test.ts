import { describe, expect, it } from 'vitest';
import {
  buildProjectSessionsPreview,
  PROJECT_SESSIONS_PREVIEW_LIMIT,
} from '../../../../packages/app/src/state/project-sessions-preview.js';
import type { ProjectPanelSessionRow } from '../../../../packages/app/src/state/projects-panel.js';

function session(id: string, lastActivity: Date | null): ProjectPanelSessionRow {
  return {
    sessionId: id,
    displaySessionId: id,
    name: 'project',
    cwd: '/ws/project',
    state: 'ended',
    stateLabel: 'ended',
    lastActivity,
    matchedTabId: null,
  };
}

describe('buildProjectSessionsPreview (V2-T77)', () => {
  it('orders by last activity, newest first, with unknown activity always last (D-025)', () => {
    const preview = buildProjectSessionsPreview([
      session('unknown', null),
      session('old', new Date('2026-09-01T00:00:00Z')),
      session('new', new Date('2026-10-01T00:00:00Z')),
    ]);
    expect(preview.rows.map((row) => row.sessionId)).toEqual(['new', 'old', 'unknown']);
  });

  it('caps at five and reports how many are hidden', () => {
    const sessions = Array.from({ length: 8 }, (_, index) =>
      session(`s${index}`, new Date(Date.UTC(2026, 9, 1, index))),
    );
    const preview = buildProjectSessionsPreview(sessions);
    expect(PROJECT_SESSIONS_PREVIEW_LIMIT).toBe(5);
    expect(preview.rows).toHaveLength(5);
    expect(preview.rows[0]?.sessionId).toBe('s7');
    expect(preview.totalCount).toBe(8);
    expect(preview.hiddenCount).toBe(3);
  });

  it('exactly five hides nothing, and none is an empty preview', () => {
    const five = Array.from({ length: 5 }, (_, index) => session(`s${index}`, null));
    expect(buildProjectSessionsPreview(five).hiddenCount).toBe(0);
    expect(buildProjectSessionsPreview([])).toEqual({ rows: [], totalCount: 0, hiddenCount: 0 });
  });

  it("does not reorder the caller's own array", () => {
    const input = [session('a', null), session('b', new Date('2026-10-01T00:00:00Z'))];
    buildProjectSessionsPreview(input);
    expect(input.map((row) => row.sessionId)).toEqual(['a', 'b']);
  });
});
