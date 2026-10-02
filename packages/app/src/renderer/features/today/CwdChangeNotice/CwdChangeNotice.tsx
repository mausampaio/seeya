/**
 * D-052 (V2-T66, `docs/INTERFACE.md` § 3): "sessão que mudou de diretório: dentro do cartão, uma
 * caixa informativa com o histórico e a frase de que memória e configuração são por diretório,
 * mais o seletor `Resume in`". Replaces `renderer/legacy/today-panel-view.ts
 * #renderCwdHistoryNote`/`renderResumeInSelect` (apagados by this task).
 *
 * Only ever rendered by `SessionCard` when `history.length > 1` (its own docstring on why) — this
 * component itself has no opinion on when to appear, same split `InfoBox` draws between tone and
 * container.
 *
 * @example
 * <CwdChangeNotice sessionId="s1" history={row.cwdHistory} chosenCwd={undefined}
 *   disabled={false} onChooseCwd={setChosenCwd} homeDir={homeDir} platformHint={platformHint} />
 */
import type { JSX } from 'preact';
import type { CwdHistoryEntry } from '@seeya-ai/engine/application/cwd-history.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import styles from './CwdChangeNotice.module.css';
import { cx } from '../../../components/css-class.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import { Text } from '../../../components/Text/index.js';
import { Select } from '../../../components/Select/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { defaultResumeInCwd } from '../../../../state/today-panel.js';
import { formatDirectoryPathForDisplay } from '../../../../sidebar/directory-label.js';

export interface CwdChangeNoticeProps {
  readonly sessionId: string;
  readonly history: readonly CwdHistoryEntry[];
  /** The directory explicitly chosen so far (hook state in `useToday.ts`) — `undefined` means
   * "nobody has touched the selector yet", which `defaultResumeInCwd` resolves for DISPLAY here,
   * the exact same default `useToday.ts#resumeSelected` falls back to for SUBMISSION (D-041: one
   * function, two call sites that must agree). */
  readonly chosenCwd: string | undefined;
  readonly disabled: boolean;
  readonly onChooseCwd: (sessionId: string, cwd: string) => void;
  /** PO review of V2-T66, item 2 — the person's own home directory and the platform it was read
   * on, so every `cwd` this notice shows (the sentence, each "Resume in" option) can be
   * abbreviated to `~`/end-shortened instead of a long absolute path. */
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}

export function CwdChangeNotice(props: CwdChangeNoticeProps): JSX.Element {
  const format = (cwd: string): string =>
    formatDirectoryPathForDisplay(cwd, props.homeDir, props.platformHint);
  const existing = props.history.filter((entry) => entry.exists);
  const selected = props.chosenCwd ?? defaultResumeInCwd(props.history) ?? '';
  // The sentence shown is built from the SAME history, with each entry's `cwd` replaced by its
  // display form — `MESSAGES.todayCwdHistoryNote` itself is untouched, it just formats whatever
  // `cwd` string each entry carries. The full, unabbreviated sentence goes in `title` (D-025's own
  // "never lost", `shortenDirectoryPath`'s own precedent), a hover away.
  const displayHistory = props.history.map((entry) => ({ ...entry, cwd: format(entry.cwd) }));
  return (
    <InfoBox tone="info" className={cx(styles, 'notice')}>
      <Text as="p" variant="body-sm" title={MESSAGES.todayCwdHistoryNote(props.history)}>
        {MESSAGES.todayCwdHistoryNote(displayHistory)}
      </Text>
      <Text as="p" variant="body-sm">
        {MESSAGES.todayCwdHistoryExplanation}
      </Text>
      {/* Same condition the legacy `renderResumeInSelect` used: offered whenever at least ONE
       * directory in the history still exists — even a single option is worth showing, because it
       * confirms WHICH directory this session will resume in, rather than leaving that implicit. */}
      {existing.length > 0 && (
        <Select
          id={`today-resume-in-${props.sessionId}`}
          label={MESSAGES.todayResumeInLabel}
          value={selected}
          monospace
          fullWidth
          disabled={props.disabled}
          options={existing.map((entry) => ({
            value: entry.cwd,
            label: format(entry.cwd),
            title: entry.cwd,
          }))}
          onChange={(cwd) => props.onChooseCwd(props.sessionId, cwd)}
        />
      )}
    </InfoBox>
  );
}
