/**
 * The "Today" panel (V2-T4 item 1 and following — split out of the former single-file
 * `renderer.ts` by V2-T62/D-051). Excluded from `packages/app/src`'s coverage floor with
 * everything else in `electron/` (it cannot run without a display).
 */
import { MESSAGES } from '../../text/messages.js';
import {
  hasResumableSession,
  offersResumeCheckbox,
  type TodayPanelData,
  type TodaySessionRow,
} from '../../state/today-panel.js';
import type { ResumeSummaryResponse } from '../../ipc/channels.js';

function todayPanel(): HTMLElement {
  return document.getElementById('today-panel') as HTMLElement;
}

/** V2-T9 item 2: the directory-changed note + the explanatory line, shown only when the session's
 * own history actually records a change — "sem histórico é sem nota" (D-025), a single-entry
 * history says nothing extra rather than affirming "no change". */
function renderCwdHistoryNote(history: TodaySessionRow['cwdHistory']): HTMLElement | null {
  if (history.length <= 1) {
    return null;
  }
  const container = document.createElement('div');
  const note = document.createElement('p');
  note.textContent = MESSAGES.todayCwdHistoryNote(history);
  container.appendChild(note);
  const explanation = document.createElement('p');
  explanation.textContent = MESSAGES.todayCwdHistoryExplanation;
  container.appendChild(explanation);
  return container;
}

/** V2-T9 item 2: "Resume in" — offered only when there's something to choose (more than one
 * directory recorded, and at least one still exists), the most recent EXISTING one preselected —
 * "é o comportamento de hoje" (the plan's own wording): a directory nobody touches here resumes
 * exactly where it already would have. The interface never picks silently otherwise (D-039):
 * every other option stays one click away. */
function renderResumeInSelect(
  sessionId: string,
  history: TodaySessionRow['cwdHistory'],
): HTMLElement | null {
  if (history.length <= 1) {
    return null;
  }
  const existing = history.filter((entry) => entry.exists);
  if (existing.length === 0) {
    return null;
  }
  const label = document.createElement('label');
  label.className = 'today-resume-in-label';
  label.append(`${MESSAGES.todayResumeInLabel}: `);
  const select = document.createElement('select');
  select.className = 'today-session-resume-in';
  select.dataset.sessionId = sessionId;
  for (const entry of existing) {
    const option = document.createElement('option');
    option.value = entry.cwd;
    option.textContent = entry.cwd;
    select.appendChild(option);
  }
  select.value = existing[existing.length - 1]?.cwd ?? '';
  label.appendChild(select);
  return label;
}

/** One session row in the "Today" panel (V2-T4 item 1, checkbox rule reshaped by V2-T9 item 4,
 * `runningNow`/otherwise split fixed by V2-T18 item 1) — a checkbox for any session that isn't
 * running right now, or a plain note for one that is. The branch itself is
 * `offersResumeCheckbox` (`state/today-panel.ts`, D-041: the ONE decision this file makes here),
 * never re-derived inline — the bug this task fixes was exactly a second, inconsistent version of
 * this same condition living only in this function, grouping `resumedEarlier` with `runningNow`
 * and losing the checkbox for a session already resumed once today and then closed. */
function renderTodaySessionRow(row: TodaySessionRow): HTMLLIElement {
  const item = document.createElement('li');
  if (!offersResumeCheckbox(row.resumeStatus)) {
    item.textContent = `${row.name} (${row.cwd}) — ${MESSAGES.todayRunningNow}`;
    if (row.resumeStatus.kind === 'runningNow' && row.resumeStatus.matchedTabId !== null) {
      item.classList.add('matched');
    }
    return item;
  }
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'today-session-checkbox';
  checkbox.value = row.sessionId;
  label.appendChild(checkbox);
  // V2-T18 item 1: `resumedEarlier` keeps saying so — the checkbox coming back doesn't erase the
  // information that this session already ran once today, it only stops that fact from blocking
  // a second resume.
  const statusSuffix =
    row.resumeStatus.kind === 'resumedEarlier' ? ` — ${MESSAGES.todayResumedEarlier}` : '';
  label.append(
    ` ${row.name} (${row.cwd}) — ${row.firstPlanLine ?? MESSAGES.todayNoPlanRecorded}${statusSuffix}`,
  );
  item.appendChild(label);
  const cwdHistoryNote = renderCwdHistoryNote(row.cwdHistory);
  if (cwdHistoryNote !== null) {
    item.appendChild(cwdHistoryNote);
  }
  const resumeInSelect = renderResumeInSelect(row.sessionId, row.cwdHistory);
  if (resumeInSelect !== null) {
    item.appendChild(resumeInSelect);
  }
  return item;
}

/**
 * Renders the whole "Today" panel from scratch — called once at startup (`main` below), again
 * after "Resume selected"/"Run end-day now" finish, and now on every ambient refresh tick
 * (V2-T18 item 2, via `renderTodayPanelPreservingSelections` below). Simpler than patching the
 * existing DOM in place for a list this small, and it's what keeps the resume button's own click
 * handler always closed over the CURRENT `data.day` rather than a stale one from an earlier
 * render. Never called directly from the refresh tick — see
 * `renderTodayPanelPreservingSelections`'s own docstring for why.
 */
function renderTodayPanel(data: TodayPanelData): void {
  const panel = todayPanel();
  panel.textContent = '';
  if (data.kind === 'noBriefing') {
    const message = document.createElement('p');
    message.textContent = data.message;
    panel.appendChild(message);
    return;
  }

  const title = document.createElement('p');
  title.textContent = MESSAGES.todayPlanTitle(data.day, data.daysAgo);
  panel.appendChild(title);

  const list = document.createElement('ul');
  for (const row of data.rows) {
    list.appendChild(renderTodaySessionRow(row));
  }
  panel.appendChild(list);

  // V2-T21 item 2 — the measured defect: with every row already `runningNow` (D-041's own rule:
  // resuming what's already open would just open a second copy), no row offers a checkbox, but
  // "Resume selected" stayed there anyway, clickable and doing nothing. A disabled button with the
  // reason visible reads as "nothing to do here", never as "the app broke" (the mantenedor's own
  // words for what he saw).
  const resumable = hasResumableSession(data.rows);
  if (!resumable) {
    const explanation = document.createElement('p');
    explanation.textContent = MESSAGES.todayAllSessionsRunning;
    panel.appendChild(explanation);
  }

  const resumeButton = document.createElement('button');
  resumeButton.type = 'button';
  resumeButton.textContent = MESSAGES.todayResumeSelected;
  resumeButton.disabled = !resumable;
  if (resumable) {
    resumeButton.addEventListener('click', () => void handleResumeSelected(data.day));
  }
  panel.appendChild(resumeButton);

  const progress = document.createElement('p');
  progress.id = 'today-progress';
  panel.appendChild(progress);

  const result = document.createElement('p');
  result.id = 'today-result';
  panel.appendChild(result);
}

interface TodayPanelSelections {
  readonly checkedSessionIds: ReadonlySet<string>;
  readonly resumeInBySessionId: ReadonlyMap<string, string>;
}

/** V2-T18 item 2 — captures what the person has checked/chosen in the CURRENT panel DOM before a
 * refresh tick rebuilds it from scratch: a checked checkbox (by `sessionId`, the checkbox's own
 * `value`) and a chosen "Resume in" directory (by `sessionId`, the select's own
 * `dataset.sessionId`) — `renderResumeInSelect`'s own docstring has why it's keyed that way. */
function snapshotTodayPanelSelections(): TodayPanelSelections {
  const checkedSessionIds = new Set<string>();
  for (const checkbox of todayPanel().querySelectorAll<HTMLInputElement>(
    '.today-session-checkbox:checked',
  )) {
    checkedSessionIds.add(checkbox.value);
  }
  const resumeInBySessionId = new Map<string, string>();
  for (const select of todayPanel().querySelectorAll<HTMLSelectElement>(
    '.today-session-resume-in',
  )) {
    const sessionId = select.dataset.sessionId;
    if (sessionId !== undefined) {
      resumeInBySessionId.set(sessionId, select.value);
    }
  }
  return { checkedSessionIds, resumeInBySessionId };
}

/** The other half of `snapshotTodayPanelSelections`, applied AFTER `renderTodayPanel` has already
 * rebuilt the DOM — so it only ever restores onto a row the fresh data still offers a
 * checkbox/select for. A session that stopped offering one (it just started running) simply has
 * nothing to restore onto, which is correct: resuming no longer makes sense for it. A chosen
 * directory that no longer appears in the fresh options (the history changed) is left at
 * whatever `renderResumeInSelect` already preselected, never forced onto a stale value. */
function restoreTodayPanelSelections(selections: TodayPanelSelections): void {
  for (const checkbox of todayPanel().querySelectorAll<HTMLInputElement>(
    '.today-session-checkbox',
  )) {
    checkbox.checked = selections.checkedSessionIds.has(checkbox.value);
  }
  for (const select of todayPanel().querySelectorAll<HTMLSelectElement>(
    '.today-session-resume-in',
  )) {
    const sessionId = select.dataset.sessionId;
    const chosen =
      sessionId === undefined ? undefined : selections.resumeInBySessionId.get(sessionId);
    const stillOffered =
      chosen !== undefined && Array.from(select.options).some((option) => option.value === chosen);
    if (stillOffered) {
      select.value = chosen;
    }
  }
}

/**
 * V2-T18 item 2 — the panel's own re-render, safe to call on every ambient refresh tick
 * (`onTodayUpdate` below): snapshots whatever the person just checked/chose, lets
 * `renderTodayPanel` rebuild the DOM from scratch as it always has, then restores those
 * selections. Without this, a tick landing between "person checks a box" and "person clicks
 * Resume selected" would silently uncheck it — exactly the hazard the plan entry's own "cuidado
 * ao redesenhar: não apagar caixa ... nem o diretório escolhido" calls out. Also used by the
 * ordinary fetch-and-render callers below (`refreshTodayPanel`); harmless there since there is
 * nothing yet to preserve on a fresh panel.
 */
export function renderTodayPanelPreservingSelections(data: TodayPanelData): void {
  const selections = snapshotTodayPanelSelections();
  renderTodayPanel(data);
  restoreTodayPanelSelections(selections);
}

export async function refreshTodayPanel(): Promise<void> {
  renderTodayPanelPreservingSelections(await window.seeya.getTodayPanel());
}

/** One labeled `<ul>` of `name (cwd)` lines — the shared shape every section of the summary below
 * uses (V2-T4 item 4), same repeated structure `cli/format-start-day.ts`'s own
 * `formatResumedSection`/`formatSkippedSection`/etc. already have, just built as DOM instead of
 * joined lines. `null` when `sessions` is empty, so an empty section never renders as a bare
 * heading with nothing under it. */
function renderSummarySection(
  heading: string,
  sessions: readonly {
    readonly name: string;
    readonly cwd: string;
    readonly note?: string | undefined;
  }[],
): HTMLElement | null {
  if (sessions.length === 0) {
    return null;
  }
  const section = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = heading;
  section.appendChild(title);
  const list = document.createElement('ul');
  for (const session of sessions) {
    const item = document.createElement('li');
    item.textContent =
      session.note === undefined
        ? `${session.name} (${session.cwd})`
        : `${session.name} (${session.cwd}) — ${session.note}`;
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

/** V2-T7: the resumed section's own note, per `ResumeSummaryOutcome`'s three forms — `undefined`
 * for a plain `resumed` (nothing to add), and the matching `MESSAGES` wrapper for the other two,
 * never the raw `noteText` unwrapped (that's `state/resume-summary.ts`'s bare fact; the sentence
 * around it lives in `text/messages.ts`, D-041). */
function resumeOutcomeNote(outcome: ResumeSummaryResponse['resumed'][number]): string | undefined {
  if (outcome.kind === 'resumed') {
    return undefined;
  }
  return outcome.kind === 'resumedWithoutPlan'
    ? MESSAGES.todaySummaryResumedWithoutPlanNote(outcome.noteText)
    : MESSAGES.todaySummaryFallbackNote(outcome.noteText);
}

/** Renders `response` into `#today-result` (V2-T4 item 4) — same four sections
 * `cli/format-start-day.ts#formatStartDaySummary` shows (resumed, skipped, invalid fallback
 * answers, not-yet-attempted/stopped-early), built from `ResumeSummaryResponse`
 * (`state/resume-summary.ts`'s own output) rather than any text reused literally (Q-073). */
function renderResumeSummary(response: ResumeSummaryResponse): void {
  const resultLine = document.getElementById('today-result');
  if (resultLine === null) {
    return;
  }
  resultLine.textContent = '';
  const sections = [
    renderSummarySection(
      MESSAGES.todaySummaryResumedHeading,
      response.resumed.map((outcome) => ({
        name: outcome.name,
        cwd: outcome.cwd,
        note: resumeOutcomeNote(outcome),
      })),
    ),
    renderSummarySection(
      MESSAGES.todaySummarySkippedHeading,
      response.skipped.map((session) => ({
        name: session.name,
        cwd: session.cwd,
        note: session.reasonText,
      })),
    ),
    renderSummarySection(
      MESSAGES.todaySummaryInvalidHeading,
      response.invalidFallbackAnswers.map((session) => ({
        name: session.name,
        cwd: session.cwd,
        note: session.reason,
      })),
    ),
    renderSummarySection(MESSAGES.todaySummaryRemainingHeading, response.remaining),
  ];
  for (const section of sections) {
    if (section !== null) {
      resultLine.appendChild(section);
    }
  }
  if (response.stoppedEarly !== false) {
    const note = document.createElement('p');
    note.textContent = MESSAGES.todaySummaryStoppedEarly(
      response.stoppedEarly.session.name,
      response.stoppedEarly.message,
    );
    resultLine.appendChild(note);
  }
}

/** "Resume selected" (V2-T4 items 1/2/3/4): reads the checked boxes straight from the DOM (the
 * panel's own render is the single source of truth for what's currently offered — no separate
 * selection state to keep in sync with it), calls the main process, renders the structured
 * summary, then refreshes the panel so newly-resumed sessions stop offering a checkbox. */
async function handleResumeSelected(day: string): Promise<void> {
  const checked = todayPanel().querySelectorAll<HTMLInputElement>(
    '.today-session-checkbox:checked',
  );
  const sessionIds = [...checked].map((checkbox) => checkbox.value);
  const resultLine = document.getElementById('today-result');
  if (sessionIds.length === 0) {
    if (resultLine !== null) {
      resultLine.textContent = MESSAGES.todayNothingSelected;
    }
    return;
  }
  // V2-T9 item 2: whatever "Resume in" currently shows for each session that has one — read
  // straight from the DOM, same "the panel's own render is the single source of truth" reasoning
  // this function's own docstring already gives the checkboxes above.
  const chosenCwdBySessionId: Record<string, string> = {};
  for (const select of todayPanel().querySelectorAll<HTMLSelectElement>(
    '.today-session-resume-in',
  )) {
    const sessionId = select.dataset.sessionId;
    if (sessionId !== undefined) {
      chosenCwdBySessionId[sessionId] = select.value;
    }
  }
  const response = await window.seeya.resumeSelected({ day, sessionIds, chosenCwdBySessionId });
  // Refresh FIRST: renderTodayPanel rebuilds #today-panel from scratch (including a fresh, empty
  // #today-result), so the summary has to be painted AFTER it — painting it before would just get
  // wiped out by the refresh immediately following.
  await refreshTodayPanel();
  renderResumeSummary(response);
}

/** Wired once, at startup — the Today-specific slice of what used to be `wireIncomingEvents`. */
export function wireTodayIncomingEvents(): void {
  // V2-T18 item 2: a session opened outside the window now shows "running now" on its own,
  // without reopening.
  window.seeya.onTodayUpdate((data) => {
    renderTodayPanelPreservingSelections(data);
  });
  window.seeya.onResumeProgress(({ index, total, name }) => {
    const progress = document.getElementById('today-progress');
    if (progress !== null) {
      progress.textContent = MESSAGES.todayResumeProgress(index, total, name);
    }
  });
}
