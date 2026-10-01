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
 *   disabled={false} onChooseCwd={setChosenCwd} />
 */
import type { JSX } from 'preact';
import type { CwdHistoryEntry } from '@seeya-ai/engine/application/cwd-history.js';
import styles from './CwdChangeNotice.module.css';
import { cx } from '../../../components/css-class.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import { Text } from '../../../components/Text/index.js';
import { Select } from '../../../components/Select/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { defaultResumeInCwd } from '../../../../state/today-panel.js';

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
}

export function CwdChangeNotice(props: CwdChangeNoticeProps): JSX.Element {
  const existing = props.history.filter((entry) => entry.exists);
  const selected = props.chosenCwd ?? defaultResumeInCwd(props.history) ?? '';
  return (
    <InfoBox tone="info" className={cx(styles, 'notice')}>
      <Text as="p" variant="body-sm">
        {MESSAGES.todayCwdHistoryNote(props.history)}
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
          disabled={props.disabled}
          options={existing.map((entry) => ({ value: entry.cwd, label: entry.cwd }))}
          onChange={(cwd) => props.onChooseCwd(props.sessionId, cwd)}
        />
      )}
    </InfoBox>
  );
}
