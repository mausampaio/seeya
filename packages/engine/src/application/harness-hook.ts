/**
 * Installs (regenerates) a project's own Claude Code hook config (V2-T34 item 2, PO review) — the
 * same "reinstalled by every open" discipline `application/workspace-hooks.ts
 * #ensureWorkspaceHooksInstalled` already gives the workspace's own git hook, applied here to
 * `<root>/<projectId>/.claude/settings.json` instead. Called from
 * `application/project-open.ts#openProject`, right alongside that other call.
 */
import type { WorkspaceRepository } from '../core/ports.js';
import { buildHarnessSettingsJson } from '../core/harness-hook-config.js';

export async function ensureHarnessHookInstalled(
  workspace: WorkspaceRepository,
  root: string,
  projectId: string,
  nodePath: string,
  cliEntryPath: string,
  env: Readonly<Record<string, string>> = {},
): Promise<void> {
  await workspace.installHarnessHook(
    root,
    projectId,
    buildHarnessSettingsJson(nodePath, cliEntryPath, env),
  );
}
