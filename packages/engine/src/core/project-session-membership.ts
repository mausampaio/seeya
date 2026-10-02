/**
 * Whether a discovered session belongs to a project (V2-T30 item 1's grouping rule, shared with
 * V2-T77's resume refusal so the sidebar/tables and the engine can never disagree about it).
 *
 * **Only by evidence (D-025), never by associated repository** — a repository can serve more than
 * one project, so it carries no membership signal:
 *
 * - its `cwd` is the project's own directory (`core/cwd-normalization.ts`, so a different
 *   separator/case/trailing slash still matches), or
 * - it is the fork session registered in `adoptions.json` for that project (`forkSessionId`, never
 *   `originalSessionId`), or
 * - it holds that project's own lock (`.seeya-lock`'s `sessionId`, when known — an unidentified
 *   holder matches nothing).
 */
import { normalizeCwdForComparison, type PathPlatformHint } from './cwd-normalization.js';
import type { SessionState } from './types.js';

export interface ProjectMembershipEvidence {
  readonly projectDir: string;
  /** `AdoptionRecord.forkSessionId`s registered for this project. */
  readonly forkSessionIds: ReadonlySet<string>;
  readonly lockSessionId: string | undefined;
}

/** The two fields membership reads — a structural subset of `DiscoveredSession`/`SidebarRow`. */
export interface MembershipCandidate {
  readonly sessionId: string;
  readonly cwd: string;
}

export function sessionBelongsToProject(
  session: MembershipCandidate,
  evidence: ProjectMembershipEvidence,
  platform: PathPlatformHint,
): boolean {
  if (
    normalizeCwdForComparison(session.cwd, platform) ===
    normalizeCwdForComparison(evidence.projectDir, platform)
  ) {
    return true;
  }
  if (evidence.forkSessionIds.has(session.sessionId)) {
    return true;
  }
  return evidence.lockSessionId === session.sessionId;
}

/** D-024: why a resume through `open` is refused, never a boolean. */
export type ProjectResumeDecision =
  | { readonly kind: 'eligible' }
  /** Running right now (`alive`/`idle`): resuming would open a second copy of it. */
  | { readonly kind: 'sessionRunning'; readonly state: 'alive' | 'idle' }
  /** No evidence ties it to this project — never guessed (D-025). */
  | { readonly kind: 'notInProject' };

/**
 * @example
 * decideProjectResume(session, 'ended', evidence, 'posix') // { kind: 'eligible' } when it belongs
 */
export function decideProjectResume(
  session: MembershipCandidate,
  state: SessionState,
  evidence: ProjectMembershipEvidence,
  platform: PathPlatformHint,
): ProjectResumeDecision {
  if (state === 'alive' || state === 'idle') {
    return { kind: 'sessionRunning', state };
  }
  if (!sessionBelongsToProject(session, evidence, platform)) {
    return { kind: 'notInProject' };
  }
  return { kind: 'eligible' };
}
