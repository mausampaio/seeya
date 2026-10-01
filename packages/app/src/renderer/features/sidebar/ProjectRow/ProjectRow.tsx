/**
 * D-052 (V2-T75), PO review (2026-10-01): the single row shape Favorites and Recent both render.
 * Before this, Recent showed only a folder icon and a name — a project open in this window read
 * as a plain, inactive row there, with none of the highlight/lock status/indented sessions the
 * exact same project already carried in Favorites. The two lists now render through this one
 * component off the same `ProjectSidebarRow` shape (`state/sidebar-summary.ts`); only the leading
 * icon/action differs (`leading`, a discriminated union so a plain folder row can never
 * accidentally receive a favorite-toggle handler it has no button for, D-024).
 *
 * Icon column alignment (PO review): `.main`'s own padding/gap match `NavItem.module.css`'s
 * `.navItem` exactly (`var(--seeya-space-2)` for both) — the earlier per-list CSS (Recent had no
 * left padding at all, Favorites' gap was `space-1`) is what put the three lists' leading icons in
 * three different columns in a real capture.
 *
 * @example
 * <ProjectRow projectId="auth" name="Auth hardening" badge="openHere" sessions={sessions}
 *   leading={{ kind: 'folder' }} onOpenProject={open}/>
 */
import type { JSX } from 'preact';
import styles from './ProjectRow.module.css';
import { cx, mergeClassName } from '../../../components/css-class.js';
import { Text } from '../../../components/Text/index.js';
import { FolderIcon, LockIcon, StarIcon } from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { FavoriteLockBadge } from '../../../../state/sidebar-summary.js';
import type { ProjectPanelSessionRow } from '../../../../state/projects-panel.js';
import { resolveSessionStateTone } from '../../../../state/session-state-tone.js';
import type { Tone } from '../../../components/props.js';

/** Which leading glyph/action this row shows. A boolean `favorited` flag plus an optional
 * toggle callback would let a caller pass the star without a handler, or a handler without the
 * star — this union makes that combination unrepresentable (D-024). Recent rows are never
 * favoritable from here (`kind: 'folder'`); Favorites rows are always filled (only favorited
 * projects reach that list) and always carry the un-favorite action. */
export type ProjectRowLeading =
  | { readonly kind: 'folder' }
  | {
      readonly kind: 'favoriteStar';
      readonly onToggleFavorite: (projectId: string, favorite: boolean) => void;
    };

export interface ProjectRowProps {
  readonly projectId: string;
  readonly name: string;
  readonly badge: FavoriteLockBadge;
  readonly sessions: readonly ProjectPanelSessionRow[];
  readonly leading: ProjectRowLeading;
  /** PO review (2026-10-01), `docs/INTERFACE.md` § 1's own "três estados visuais na linha de
   * projeto": whether THIS project's own open tab is the one currently showing in the strip —
   * `state/sidebar-summary.ts#hasActiveTabSession`'s own evidence, distinct from `badge ===
   * 'openHere'` (which only means a tab is open SOMEWHERE, not that it's the one on screen right
   * now). Optional, same defensive default as `NavItem`'s own `active?: boolean` — every existing
   * caller that doesn't care about this state keeps working unchanged. */
  readonly activeTab?: boolean;
  readonly onOpenProject: (projectId: string) => void;
}

/** `tone`'s own text-colour token (`Chip.module.css`'s own `.outline.*` rules map the same six
 * values the same way) — the state dot borrows that palette via `currentColor` instead of
 * duplicating a second tone→token table. */
const DOT_TONE_CLASS: Record<Tone, string> = {
  neutral: 'dotNeutral',
  brand: 'dotBrand',
  success: 'dotSuccess',
  info: 'dotInfo',
  warning: 'dotWarning',
  error: 'dotError',
};

function SessionRow(props: { readonly session: ProjectPanelSessionRow }): JSX.Element {
  const { session } = props;
  const tone = resolveSessionStateTone(session.state);
  return (
    <li class={cx(styles, 'sessionRow')}>
      <span class={cx(styles, 'dot', DOT_TONE_CLASS[tone])} aria-hidden="true" />
      <Text
        as="span"
        variant="body-sm"
        tone="secondary"
        truncate
        className={cx(styles, 'sessionName')}
      >
        {session.name}
      </Text>
      <Text as="span" variant="caption" tone="tertiary" className={cx(styles, 'sessionId')}>
        {session.displaySessionId}
      </Text>
    </li>
  );
}

function LockStatus(props: { readonly badge: FavoriteLockBadge }): JSX.Element | null {
  if (props.badge === 'none') {
    return null;
  }
  const openHere = props.badge === 'openHere';
  return (
    <span class={cx(styles, 'lock', openHere ? 'lockOpenHere' : 'lockLocked')}>
      <LockIcon size={14} />
      {/* `span.lockLabelXxx` in ProjectRow.module.css beats `Text`'s own `.tonePrimary` by CSS
       * specificity (element+class vs. class alone) regardless of stylesheet order — see that
       * file's own comment. `Text` still owns the SIZE here (identity's own `caption`); this is
       * the only place that overrides the colour for a semantic (non-typographic) reason. */}
      <Text
        as="span"
        variant="caption"
        className={cx(styles, openHere ? 'lockLabelOpenHere' : 'lockLabelLocked')}
      >
        {openHere ? MESSAGES.sidebarFavoriteOpenHere : MESSAGES.sidebarFavoriteLocked}
      </Text>
    </span>
  );
}

export function ProjectRow(props: ProjectRowProps): JSX.Element {
  const hasOpenTab = props.badge === 'openHere';
  // `=== true`, not a bare boolean coercion: `activeTab` is optional (`undefined` for every
  // caller that hasn't computed it), same defensive pattern `NavItem.tsx`'s own `active === true`
  // already uses.
  const isActiveTab = props.activeTab === true;
  const { leading } = props;
  return (
    <li
      class={mergeClassName(
        cx(styles, 'row', hasOpenTab && 'rowOpenHere', isActiveTab && 'rowActiveTab'),
      )}
    >
      <div class={cx(styles, 'main')}>
        {leading.kind === 'favoriteStar' ? (
          <button
            type="button"
            class={cx(styles, 'icon', 'star')}
            aria-pressed="true"
            aria-label={MESSAGES.sidebarFavoriteStarLabel(true, props.name)}
            onClick={(event) => {
              event.stopPropagation();
              leading.onToggleFavorite(props.projectId, false);
            }}
          >
            <StarIcon filled />
          </button>
        ) : (
          <span class={cx(styles, 'icon')} aria-hidden="true">
            <FolderIcon />
          </span>
        )}
        <button
          type="button"
          class={cx(styles, 'name')}
          onClick={() => props.onOpenProject(props.projectId)}
        >
          <Text
            as="span"
            variant="body-sm"
            truncate
            title={props.name}
            className={cx(styles, 'nameText')}
            {...(hasOpenTab ? { weight: 500 as const } : {})}
          >
            {props.name}
          </Text>
        </button>
        <LockStatus badge={props.badge} />
      </div>
      {props.sessions.length > 0 && (
        <ul class={cx(styles, 'sessions')}>
          {props.sessions.map((session) => (
            <SessionRow key={session.sessionId} session={session} />
          ))}
        </ul>
      )}
    </li>
  );
}
