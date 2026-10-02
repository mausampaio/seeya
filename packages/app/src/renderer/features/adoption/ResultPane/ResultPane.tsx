/**
 * V2-T70 (`docs/INTERFACE.md` § 7 item 3): the adoption's own outcome — success or failure, never
 * closing in silence (V2-T34's own production-defect rule, still honored here: `useAdoption.ts`'s
 * own `.catch()` reaches this same pane for a genuinely unexpected rejection too). A failure's own
 * `outcomeText` often carries a raw adapter message (`commitAll`'s own thrown text, which now
 * includes git's stderr) — `summarizeErrorReason` (`state/error-reason-summary.ts`, V2-T69) gives
 * the short, `~`-abbreviated line the dialog shows, with the complete message one hover away via
 * `title`, the same split the Projects tab's own "Ignored projects" reason already uses.
 */
import type { JSX } from 'preact';
import { Stack } from '../../../components/Stack/index.js';
import { Text } from '../../../components/Text/index.js';
import { InfoBox } from '../../../components/InfoBox/index.js';
import type { PathPlatformHint } from '@seeya-ai/engine/core/cwd-normalization.js';
import { summarizeErrorReason } from '../../../../state/error-reason-summary.js';

export interface ResultPaneProps {
  readonly outcomeText: string;
  readonly adopted: boolean;
  readonly homeDir: string;
  readonly platformHint: PathPlatformHint;
}

export function ResultPane(props: ResultPaneProps): JSX.Element {
  if (props.adopted) {
    return (
      <InfoBox tone="success">
        <Text as="p" variant="body-sm">
          {props.outcomeText}
        </Text>
      </InfoBox>
    );
  }
  const summary = summarizeErrorReason(props.outcomeText, props.homeDir, props.platformHint);
  return (
    <InfoBox tone="error">
      <Stack gap="xs">
        <Text
          as="p"
          variant="body-sm"
          title={summary.text !== summary.fullText ? summary.fullText : undefined}
        >
          {summary.text}
        </Text>
      </Stack>
    </InfoBox>
  );
}
