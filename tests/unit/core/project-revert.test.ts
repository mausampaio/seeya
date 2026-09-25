/**
 * `planAdoptionRevert` (V2-T32, `packages/engine/src/core/project-revert.ts`) — pure over
 * `RevertCommitInfo[]`.
 */
import { describe, expect, it } from 'vitest';
import { planAdoptionRevert } from '@seeya-ai/engine/core/project-revert.js';
import type { RevertCommitInfo } from '@seeya-ai/engine/core/ports.js';

describe('planAdoptionRevert', () => {
  it('is nothingToRevert when the session never committed inside the project', () => {
    expect(planAdoptionRevert([], [])).toStrictEqual({ kind: 'nothingToRevert' });
  });

  it('proceeds, newest first, when nothing came after and nothing overlaps', () => {
    const sessionCommits: RevertCommitInfo[] = [
      { hash: 'a', files: ['auth-hardening/AGENTS.md'] },
      { hash: 'b', files: ['auth-hardening/INDEX.md'] },
    ];
    expect(planAdoptionRevert(sessionCommits, [])).toStrictEqual({
      kind: 'proceed',
      commitsNewestFirst: ['b', 'a'],
    });
  });

  it('proceeds when a later commit exists but touches different files', () => {
    const sessionCommits: RevertCommitInfo[] = [{ hash: 'a', files: ['auth-hardening/AGENTS.md'] }];
    const laterCommits: RevertCommitInfo[] = [{ hash: 'c', files: ['auth-hardening/INDEX.md'] }];
    expect(planAdoptionRevert(sessionCommits, laterCommits)).toStrictEqual({
      kind: 'proceed',
      commitsNewestFirst: ['a'],
    });
  });

  it("is blocked when a later commit touched a file any of the session's own commits touched", () => {
    const sessionCommits: RevertCommitInfo[] = [
      { hash: 'a', files: ['auth-hardening/AGENTS.md'] },
      { hash: 'b', files: ['auth-hardening/INDEX.md'] },
    ];
    const laterCommits: RevertCommitInfo[] = [
      { hash: 'c', files: ['auth-hardening/other.md'] },
      { hash: 'd', files: ['auth-hardening/AGENTS.md'] },
    ];
    expect(planAdoptionRevert(sessionCommits, laterCommits)).toStrictEqual({
      kind: 'blocked',
      blockingCommit: 'd',
    });
  });

  it('names the FIRST (earliest) later commit that overlaps, not a later one that also does', () => {
    const sessionCommits: RevertCommitInfo[] = [{ hash: 'a', files: ['auth-hardening/AGENTS.md'] }];
    const laterCommits: RevertCommitInfo[] = [
      { hash: 'c', files: ['auth-hardening/AGENTS.md'] },
      { hash: 'd', files: ['auth-hardening/AGENTS.md'] },
    ];
    expect(planAdoptionRevert(sessionCommits, laterCommits)).toStrictEqual({
      kind: 'blocked',
      blockingCommit: 'c',
    });
  });
});
