/**
 * The one sentence telling a session working inside a project never to write `seeya.json` itself
 * (V2-T72 item 3) — reused verbatim by `adapters/harness/adopt-instruction.ts` (the adoption's
 * first turn) and `core/project-working-rules.ts` (every `open`), so the rule exists in exactly
 * one place instead of two copies that could drift.
 *
 * **What prompted this.** The maintainer's own finding in production (task-62, 2026-09-30, on
 * Ubuntu): an adoption session committed the work it did — which D-047 item 4 expects ("quem
 * segura o lock commita") — but along the way it also edited `seeya.json` itself, filling
 * `repositories`/`trackers` in a shape the schema doesn't accept, which made the whole project
 * disappear from `seeya project list`/the window (`RejectedDiscoveryRecord`, D-022). `seeya.json`
 * is written only by `seeya` itself (`application/workspace.ts#createProject`,
 * `application/repository-association.ts#addRepository`) — a session editing it by hand is always
 * a mistake, whatever shape it writes.
 */
export const MANIFEST_OWNERSHIP_NOTE =
  '"seeya.json" in this project is maintained by seeya itself — never write to it by hand, ' +
  'even to fix it. To add a repository, tell the person to run "seeya project add-repo" from a ' +
  'real terminal.';

/**
 * The manifest's own file name, relative to a project's own directory — fixed here (V2-T73) so
 * `core/workspace-commit-guard.ts` (deciding which staged path IS the manifest) and
 * `adapters/workspace/project-manifest-files.ts` (writing/reading it) never spell the literal
 * `'seeya.json'` independently, which would risk the two drifting apart (AGENTS.md: "nada de
 * duplicação").
 */
export const PROJECT_MANIFEST_FILE_NAME = 'seeya.json';
