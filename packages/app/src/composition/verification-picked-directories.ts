/**
 * `SEEYA_APP_VERIFY_PICKED_DIRECTORIES` (V2-T83): verification-only stand-in for the OS folder
 * picker. A native dialog never appears in a `webContents.capturePage()` image and cannot be driven
 * by an agent with no mouse, so the "Project details" verification (`main/
 * verification-project-details.ts`) feeds `CHANNELS.pickDirectory` the folders it wants "chosen" —
 * the renderer still calls the real `pickDirectory` IPC and still hands the result to the real
 * `addRepository`; only the dialog itself is replaced.
 *
 * The value is a `|`-separated list of absolute folders (never a JSON document: an env var is not
 * data worth a schema, and no real path contains `|`). Each call returns the next folder and the
 * LAST one repeats forever, so a verification can ask for "the same folder again" (the
 * already-associated case) by listing it once more or simply by clicking again. An empty or unset
 * value means "no stand-in": the real native dialog opens (every normal run).
 *
 * Never read by `npm run app` or the README — same category as every other `SEEYA_APP_*` flag.
 */
export type VerificationDirectoryPicker = () => string | null;

/**
 * @example
 * const next = createVerificationDirectoryPicker('/a|/b');
 * next(); // '/a'
 * next(); // '/b'
 * next(); // '/b'
 */
export function createVerificationDirectoryPicker(
  raw: string | undefined,
): VerificationDirectoryPicker | null {
  const directories = (raw ?? '').split('|').filter((entry) => entry.length > 0);
  if (directories.length === 0) {
    return null;
  }
  let nextIndex = 0;
  return () => {
    const directory = directories[Math.min(nextIndex, directories.length - 1)] ?? null;
    nextIndex += 1;
    return directory;
  };
}
