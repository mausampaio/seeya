/**
 * The one Node error-code idiom this adapter needs: telling "nothing here yet" apart from a real
 * failure. Deliberately its own tiny copy, not an import of `adapters/storage/fs-errors.ts` —
 * that file's own comment already settled this once (for `adapters/discovery/fs-errors.ts`'s
 * identical copy): reaching into a sibling adapter's internals to save four lines is a tighter
 * coupling than the duplication it avoids.
 */
export function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
