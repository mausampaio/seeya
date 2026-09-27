/**
 * Reasserts the workspace's own local git identity (D-047 emendment, 2026-09-25, V2-T58) —
 * `user.name`/`user.email` set LOCAL to the workspace's `.git/config`, never `--global`, so a
 * commit made without `commitAll`'s own env-var override (a session's own plain `git commit`, as
 * the maintainer's own machine produced) still lands with `seeya`'s identity instead of failing on
 * a machine whose global git identity is missing or incomplete. Called from
 * `application/workspace.ts#createProject` (right after `initialize()`) and
 * `application/project-open.ts#openProject` (at the start of every `open`) — the same "reasserted
 * every time" discipline `ensureWorkspaceHooksInstalled` (this module's own precedent) already has,
 * and never anywhere else, so a read-only command (`list`/`show`) never pays for it.
 */
import type { WorkspaceRepository } from '../core/ports.js';

export async function ensureWorkspaceIdentityConfigured(
  workspace: WorkspaceRepository,
  root: string,
): Promise<void> {
  await workspace.configureIdentity(root);
}
