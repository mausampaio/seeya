/**
 * Installs (or reinstalls) the workspace's own `commit-msg` git hook (V2-T34 item 1, D-047 item 5's
 * own "instalados... e reafirmados pelo seeya"). Called from `application/workspace.ts#createProject`
 * (right after the workspace is `initialize()`d) and from `application/project-open.ts#openProject`
 * (at the very start of every `open`, "um gancho apagado volta sozinho") — never anywhere else, so a
 * command that only reads (`list`/`show`) never pays for it.
 */
import type { WorkspaceRepository } from '../core/ports.js';
import { buildCommitMsgHookScript } from '../core/workspace-hooks.js';

export async function ensureWorkspaceHooksInstalled(
  workspace: WorkspaceRepository,
  root: string,
  nodePath: string,
  cliEntryPath: string,
  env: Readonly<Record<string, string>> = {},
): Promise<void> {
  await workspace.installCommitMsgHook(root, buildCommitMsgHookScript(nodePath, cliEntryPath, env));
}
