/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): the Today tab — replaces `renderer/legacy/
 * today-panel-view.ts` entirely (apagado by this task) as the content of the `#page-today` page
 * pane `renderer/features/tabs/TabStrip.tsx` already opens/focuses
 * (`renderer/features/sidebar/useSidebar.ts#openToday`, `page-tab-bridge.ts` — neither touched by
 * this task). Mounted once, as a static child of `#page-today`, for the life of the window — the
 * SAME "mounts once" lifetime `<Sidebar/>`/`<SettingsDialog/>` already have, since `TabStrip.tsx`
 * never conditionally mounts/unmounts a page pane, only toggles its `hidden` attribute.
 *
 * No briefing at all: `EmptyState` with the same combined "either nothing has been captured yet,
 * or everything already resumed" text `MESSAGES.todayNoBriefing` always gave
 * (`docs/INTERFACE.md`'s own "estado vazio com o texto de hoje"). `ResumeProgress`/`ResumeResult`
 * render ABOVE that empty state too, never swallowed by it — a fixture/day with only one pending
 * session resumes into exactly this shape (the day has nothing left pending the instant that one
 * session is marked resumed), and `docs/INTERFACE.md` § 3's own "aparecem na própria aba, acima
 * dos cartões" promises the result stays visible regardless of whether any card is left under it
 * (confirmed by a real capture during this task's own verification — the earlier version of this
 * component returned the empty state unconditionally before ever checking `controls.result`,
 * which silently dropped a genuinely successful resume's own confirmation).
 *

 * `disabledReason` for "Resume selected" is decided HERE, not inside `SelectionFooter` (D-041):
 * `hasResumable === false` means every row is already `runningNow` (nothing resumable at all,
 * `MESSAGES.todayAllSessionsRunning`); `hasResumable === true` with nothing checked yet means
 * `MESSAGES.todaySelectNoneReason` — two different facts a single disabled state can't tell apart
 * on its own.
 *
 * @example
 * <Today/>
 */
import type { JSX } from 'preact';
import styles from './Today.module.css';
import { cx } from '../../components/css-class.js';
import { Stack } from '../../components/Stack/index.js';
import { EmptyState } from '../../components/EmptyState/index.js';
import { MESSAGES } from '../../../text/messages.js';
import { PlanHeader } from './PlanHeader/index.js';
import { SessionCard } from './SessionCard/index.js';
import { SelectionFooter } from './SelectionFooter/index.js';
import { ResumeProgress } from './ResumeProgress/index.js';
import { ResumeResult } from './ResumeResult/index.js';
import { useToday } from './useToday.js';

export function Today(): JSX.Element {
  const controls = useToday();
  const { data } = controls;

  const disabledReason =
    data.kind === 'pending' && !controls.hasResumable
      ? MESSAGES.todayAllSessionsRunning
      : data.kind === 'pending' && controls.selectedCount === 0
        ? MESSAGES.todaySelectNoneReason
        : undefined;

  return (
    <div class={cx(styles, 'today')}>
      <div class={cx(styles, 'scroll')}>
        <ResumeProgress progress={controls.progress} />
        {controls.result !== null && <ResumeResult result={controls.result} />}
        {data.kind === 'noBriefing' ? (
          <EmptyState title={MESSAGES.todayCardNothingToResume} description={data.message} />
        ) : (
          <>
            <PlanHeader
              day={data.day}
              daysAgo={data.daysAgo}
              capturedAt={data.capturedAt}
              sessionCount={data.rows.length}
            />
            <Stack gap="sm">
              {data.rows.map((row) => (
                <SessionCard
                  key={row.sessionId}
                  row={row}
                  checked={controls.selectedSessionIds.has(row.sessionId)}
                  disabled={controls.resuming}
                  chosenCwd={controls.chosenCwdBySessionId.get(row.sessionId)}
                  onToggle={controls.toggleSession}
                  onChooseCwd={controls.setChosenCwd}
                />
              ))}
            </Stack>
          </>
        )}
      </div>
      {data.kind === 'pending' && (
        <SelectionFooter
          selectedCount={controls.selectedCount}
          resuming={controls.resuming}
          disabledReason={disabledReason}
          onClearSelection={controls.clearSelection}
          onResumeSelected={controls.resumeSelected}
        />
      )}
    </div>
  );
}
