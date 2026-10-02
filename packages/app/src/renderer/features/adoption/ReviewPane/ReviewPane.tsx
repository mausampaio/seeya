/**
 * V2-T70 (`docs/INTERFACE.md` § 7 item 2): step 2 — the files the fork wrote inside the project,
 * each with its type (added/modified/deleted) and line counts
 * (`WorkspaceRepository.listChangedFilesWithStats`, via `state/adoption-review.ts`). Reuses
 * `StatusList` (`renderer/components/StatusList/`, V2-T69) rather than a bespoke row component —
 * the same "a name, a path, a state" shape End day's own lists already use.
 */
import type { JSX } from 'preact';
import { Stack } from '../../../components/Stack/index.js';
import { StatusList, type StatusListItem } from '../../../components/StatusList/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { AdoptionReviewRow } from '../../../../state/adoption-review.js';
import type { ChangedFileStatsEntry } from '@seeya-ai/engine/core/ports.js';

export interface ReviewPaneProps {
  readonly rows: readonly AdoptionReviewRow[];
}

const KIND_LABEL: Record<ChangedFileStatsEntry['kind'], string> = {
  added: MESSAGES.adoptReviewKindAdded,
  modified: MESSAGES.adoptReviewKindModified,
  deleted: MESSAGES.adoptReviewKindDeleted,
};

const KIND_TONE: Record<ChangedFileStatsEntry['kind'], 'success' | 'info' | 'error'> = {
  added: 'success',
  modified: 'info',
  deleted: 'error',
};

function toReviewItem(row: AdoptionReviewRow): StatusListItem {
  return {
    id: row.path,
    title: row.path,
    // `exactOptionalPropertyTypes`: `detail` only present when there IS a line summary — same
    // conditional-spread discipline `Button.tsx`'s own `buttonRef`/`title` props already follow.
    ...(row.linesSummary === undefined ? {} : { detail: row.linesSummary }),
    badges: [{ label: KIND_LABEL[row.kind], tone: KIND_TONE[row.kind] }],
  };
}

export function ReviewPane(props: ReviewPaneProps): JSX.Element {
  return (
    <Stack gap="md">
      <StatusList items={props.rows.map(toReviewItem)} emptyMessage={MESSAGES.adoptReviewEmpty} />
    </Stack>
  );
}
