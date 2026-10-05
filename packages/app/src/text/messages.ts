import { PROJECT_DETAILS_MESSAGES } from './project-details-messages.js';
import { PROJECT_ARCHIVE_MESSAGES } from './project-archive-messages.js';
import { TABS_MESSAGES } from './messages-tabs.js';
import { TODAY_MESSAGES } from './messages-today.js';
import { END_DAY_MESSAGES } from './messages-end-day.js';
import { SCHEDULE_DAEMON_MESSAGES } from './messages-schedule-daemon.js';
import { SETTINGS_MESSAGES } from './messages-settings.js';
import { SIDEBAR_MESSAGES } from './messages-sidebar.js';
import { PROJECTS_MESSAGES } from './messages-projects.js';
import { SESSIONS_MESSAGES } from './messages-sessions.js';

export { formatPlanAge } from './format-plan-age.js';

/**
 * Every string the interface shows a person, concentrated here (D-028: English; AGENTS.md §
 * "Texto voltado ao usuário" — the same discipline `packages/cli/src` already follows for CLI
 * output, applied to the renderer instead of a terminal). No imports on purpose (unlike `state/`,
 * which imports THIS module) — `endDayCostCeiling` below takes a structural shape matching
 * `state/end-day-preview.ts#EndDayCostCeiling` rather than importing that type, so `text/` never
 * depends on `state/`. (V2-T51: the strings themselves live in `text/messages-*.ts`, one file per
 * region, spread below; the only imports are those sibling string files.)
 */
export const MESSAGES = {
  ...TABS_MESSAGES,
  ...TODAY_MESSAGES,
  ...END_DAY_MESSAGES,
  ...SCHEDULE_DAEMON_MESSAGES,
  ...SETTINGS_MESSAGES,
  ...SIDEBAR_MESSAGES,
  ...PROJECTS_MESSAGES,
  ...SESSIONS_MESSAGES,
  ...PROJECT_DETAILS_MESSAGES,
  ...PROJECT_ARCHIVE_MESSAGES,
} as const;
