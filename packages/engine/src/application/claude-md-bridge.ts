/**
 * (Re)installs a project's own generated `CLAUDE.md` bridge (D-050/V2-T61) — the same
 * "reinstalled by every open, unless the project owns its own" discipline
 * `application/harness-hook.ts#ensureHarnessHookInstalled` gives the harness hook, applied here
 * with one difference: a project whose `CLAUDE.md` is already versioned (created before this task
 * shipped) keeps it untouched (item 2's own D-025 — "não sobrescreve nem apaga"). Called from
 * `application/project-open.ts#openProject`, right alongside `ensureHarnessHookInstalled`.
 */
import type { WorkspaceRepository } from '../core/ports.js';
import { buildGeneratedClaudeMd } from '../core/project-claude-md.js';

/** D-024: never a boolean — a caller (`cli/format-project.ts#formatClaudeMdLines`) needs to tell
 * "seeya wrote it" from "seeya left a person's own file alone" to decide whether there's anything
 * worth printing at all. */
export type ClaudeMdInstallOutcome =
  { readonly kind: 'written' } | { readonly kind: 'skippedVersioned' };

/**
 * @example
 * const outcome = await ensureGeneratedClaudeMdInstalled(workspace, root, 'auth-hardening');
 * outcome.kind; // 'written' | 'skippedVersioned'
 */
export async function ensureGeneratedClaudeMdInstalled(
  workspace: WorkspaceRepository,
  root: string,
  projectId: string,
): Promise<ClaudeMdInstallOutcome> {
  if (await workspace.isClaudeMdVersioned(root, projectId)) {
    return { kind: 'skippedVersioned' };
  }
  await workspace.installGeneratedClaudeMd(root, projectId, buildGeneratedClaudeMd());
  return { kind: 'written' };
}
