/**
 * Projects `@seeya-ai/engine/application/types.js#EndDayResult` into the structured rows End day's
 * preview/result views render (V2-T69, `docs/INTERFACE.md` § 6) — never the CLI's own literal
 * `formatEndDayReport` text (principle 5: "nada de texto da CLI despejado na tela"). Pure: no I/O,
 * no Electron — `homeDir`/`platform` are passed in (`main.ts`'s own `AppContext.homeDir`/
 * `platformHint`), never read here (same discipline `sidebar/project-sessions.ts` already follows
 * for the identical reason).
 *
 * Every field a view needs is computed ONCE here, from the SAME `EndDayResult` the dry-run/real
 * run already produced — a view that needs a fact this module doesn't yet expose grows a field
 * here (D-024), never a second read of `EndDayResult` reshaped ad hoc in a component.
 */
import type { EndDayResult } from '@seeya-ai/engine/application/types.js';
import type {
  CaptureMode,
  Handoff,
  SessionListing,
  SessionState,
} from '@seeya-ai/engine/core/types.js';
import { formatSessionDirectory } from '../sidebar/directory-label.js';
import { CLOSED_SESSION_REASON, formatIneligibilityReasons } from './end-day-reasons.js';

export type EndDayDirectoryPlatform = 'win32' | 'posix';

/** A session that passed (or, for `result.captured`, DID) capture — `docs/INTERFACE.md` § 6's own
 * "nome, diretório, estado e modo (lean/deep)". */
export interface EndDaySessionSummaryRow {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
  readonly state: SessionState;
  readonly mode: CaptureMode;
}

/** D-024: the three different reasons a session can be absent from `captured` are never folded
 * into one string without saying which kind it is — `closed` sessions never went through
 * eligibility at all (D-031), unlike `ineligible`/`failed`, and the running view (`sessionStarted`
 * only ever fires for the latter two, never for a `closed` one) needs this to seed its own tracked
 * session list correctly. */
export type EndDayNotCapturedKind = 'ineligible' | 'closed' | 'failed';

export interface EndDayNotCapturedRow {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
  readonly kind: EndDayNotCapturedKind;
  readonly reason: string;
}

/** A session's final fate once a REAL run has actually finished — `failed`/`skipped` share this
 * shape (name, directory, one reason sentence); `EndDayNotCapturedKind` doesn't matter anymore once
 * the run is over, so it's dropped here rather than carried for no reader. */
export interface EndDayReasonRow {
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
  readonly reason: string;
}

export interface EndDayPreviewRows {
  readonly willBeCaptured: readonly EndDaySessionSummaryRow[];
  readonly notCaptured: readonly EndDayNotCapturedRow[];
}

export interface EndDayResultRows {
  readonly captured: readonly EndDaySessionSummaryRow[];
  readonly failed: readonly EndDayReasonRow[];
  readonly skipped: readonly EndDayReasonRow[];
}

function toSummaryRow(
  handoff: Handoff,
  homeDir: string,
  platform: EndDayDirectoryPlatform,
): EndDaySessionSummaryRow {
  return {
    sessionId: handoff.sessionId,
    name: handoff.name,
    cwd: formatSessionDirectory(handoff.cwd, homeDir, platform),
    state: handoff.sessionState,
    mode: handoff.captureMode,
  };
}

/** @example toReasonRow('s1', 'alpha', '/home/x/alpha', '/home/x', 'posix', 'timed out') */
function toReasonRow(
  sessionId: string,
  name: string,
  cwd: string,
  homeDir: string,
  platform: EndDayDirectoryPlatform,
  reason: string,
): EndDayReasonRow {
  return { sessionId, name, cwd: formatSessionDirectory(cwd, homeDir, platform), reason };
}

function toListedReasonRow(
  listing: SessionListing,
  homeDir: string,
  platform: EndDayDirectoryPlatform,
): EndDayReasonRow {
  return toReasonRow(
    listing.sessionId,
    listing.name,
    listing.cwd,
    homeDir,
    platform,
    CLOSED_SESSION_REASON,
  );
}

/**
 * `result.captured` (D-025: a dry-run preview with `skipGeneration` still runs evidence-gathering
 * and the cheap+full eligibility checks for real — `capture-session.ts`'s own docstring — only the
 * WRITE is skipped, so these rows describe real, current facts, never a guess) plus every other
 * bucket, each tagged with why it isn't captured.
 *
 * @example
 * const { willBeCaptured, notCaptured } = buildEndDayPreviewRows(previewResult, homeDir, 'win32');
 */
export function buildEndDayPreviewRows(
  result: EndDayResult,
  homeDir: string,
  platform: EndDayDirectoryPlatform,
): EndDayPreviewRows {
  const willBeCaptured = result.captured.map((captured) =>
    toSummaryRow(captured.handoff, homeDir, platform),
  );
  const notCaptured: EndDayNotCapturedRow[] = [
    ...result.ineligible.map((item) => ({
      sessionId: item.sessionId,
      name: item.name,
      cwd: formatSessionDirectory(item.cwd, homeDir, platform),
      kind: 'ineligible' as const,
      reason: formatIneligibilityReasons(item.reasons),
    })),
    ...result.listedSessions.map((item) => ({
      sessionId: item.sessionId,
      name: item.name,
      cwd: formatSessionDirectory(item.cwd, homeDir, platform),
      kind: 'closed' as const,
      reason: CLOSED_SESSION_REASON,
    })),
    ...result.failedCaptures.map((item) => ({
      sessionId: item.sessionId,
      name: item.name,
      cwd: formatSessionDirectory(item.cwd, homeDir, platform),
      kind: 'failed' as const,
      reason: item.reason,
    })),
  ];
  return { willBeCaptured, notCaptured };
}

/**
 * The same three buckets, once a REAL run has finished (`endDayRun`) — `captured` reuses
 * `buildEndDayPreviewRows`'s own row shape (it's the identical fact, now actually written),
 * `failed`/`skipped` collapse to a plain reason sentence each (`EndDayReasonRow`).
 */
export function buildEndDayResultRows(
  result: EndDayResult,
  homeDir: string,
  platform: EndDayDirectoryPlatform,
): EndDayResultRows {
  const captured = result.captured.map((item) => toSummaryRow(item.handoff, homeDir, platform));
  const failed = result.failedCaptures.map((item) =>
    toReasonRow(item.sessionId, item.name, item.cwd, homeDir, platform, item.reason),
  );
  const skipped = [
    ...result.ineligible.map((item) =>
      toReasonRow(
        item.sessionId,
        item.name,
        item.cwd,
        homeDir,
        platform,
        formatIneligibilityReasons(item.reasons),
      ),
    ),
    ...result.listedSessions.map((item) => toListedReasonRow(item, homeDir, platform)),
  ];
  return { captured, failed, skipped };
}
