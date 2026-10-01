/**
 * Text fragments reused by more than one `seeya project` subcommand's own report (V2-T76 — split
 * out of the former `format-project.ts`, which had grown past AGENTS.md's ~500-line ceiling,
 * Q-100). Kept in a module of its own because each one is shared by at least two of the
 * command-specific files below, so parking it inside one of them would leave the others importing
 * from a file that isn't really "theirs".
 */
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type { ProjectLockStatus } from '@seeya-ai/engine/application/workspace.js';
import { formatLockHolderDescription } from '@seeya-ai/engine/core/project-lock-message.js';

export function formatInvalidIdLine(projectId: string): string {
  return (
    `seeya: "${projectId}" is not a valid project id — use lowercase letters, digits and ` +
    'hyphens only, e.g. "auth-hardening".'
  );
}

/** Shared by `format-project-lifecycle.ts`'s own `formatProjectLine` (list) and
 * `formatShowProjectReport` (show). */
export function formatRepositoriesSummary(manifest: ProjectManifest): string {
  return manifest.repositories.length === 0
    ? 'none'
    : manifest.repositories.map((repository) => repository.name).join(', ');
}

/** `seeya project show <id>`'s own lock line (V2-T33, D-047 item 5) — three states, matching
 * `ProjectLockStatus` (never flattened, D-024): `unlocked` says so plainly; `staleLock` still
 * names who last held it (useful diagnostic — the lock file is still ON DISK), but says clearly
 * that it's reclaimable; `heldByLiveSession` is the one that actually blocks a second `open`.
 *
 * Shared by `format-project-lifecycle.ts`'s own `formatShowProjectReport` and
 * `format-project-open.ts`'s own `formatOpenedReport` — `open`'s closing report repeats the
 * lock's state, read fresh after the harness closes, in the exact words `show` already uses. */
export function formatLockStatusLine(status: ProjectLockStatus): string {
  switch (status.kind) {
    case 'unlocked':
      return 'lock: none';
    case 'staleLock':
      return `lock: stale (last held by ${formatLockHolderDescription(status.lock)}) — reclaimable`;
    case 'heldByLiveSession':
      return `lock: held by ${formatLockHolderDescription(status.lock)}`;
  }
}
