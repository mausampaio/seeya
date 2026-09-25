/**
 * Plain-English text for `seeya project adopt`'s two confirmations (V2-T29 items 4/8), shared by
 * `cli/` and `app/` (V2-T30) — the same movement V2-T35 made for the project lock's own warning
 * (`project-lock-message.ts`). Both functions return the explanation lines WITHOUT an
 * interface-specific prompt suffix: `cli/format-project.ts` appends its own `"...[Y/n] "`/
 * `"...[y/N] "` for `readline`, and the app's own adoption dialogs
 * (`packages/app/src/electron/project-panel-view.ts`) show the same lines above their own
 * Proceed/Decline and Commit/Discard buttons.
 */

/**
 * The explanation `adopt` shows and waits on BEFORE creating anything (item 8) — where the copy
 * opens and why, where the project lives, and the `project open` follow-up for afterward.
 *
 * @example
 * renderAdoptionLaunchExplanationLines('/code/app', '/seeya/workspace/auth-hardening', 'auth-hardening')
 */
export function renderAdoptionLaunchExplanationLines(
  originalCwd: string,
  projectDir: string,
  projectId: string,
): string[] {
  return [
    `The copy will open in ${originalCwd} — that is where its own instructions and memory ` +
      'live, and it needs them to pass this work on.',
    `The project lives at ${projectDir}; that is where it will write.`,
    `Afterward, to work on the project itself, reopen it from there: seeya project open ` +
      `${projectId} (that is where the project's own memory applies).`,
  ];
}

/**
 * The question `adopt` asks once the fork's interactive session has closed and something inside
 * the project actually changed (item 4) — one line per changed file, shown before asking whether
 * to commit.
 *
 * @example
 * renderAdoptionCommitChangedFilesLines(['AGENTS.md', 'INDEX.md'])
 */
export function renderAdoptionCommitChangedFilesLines(changedFiles: readonly string[]): string[] {
  return [
    'The session wrote the following inside the project:',
    ...changedFiles.map((file) => `  ${file}`),
  ];
}
