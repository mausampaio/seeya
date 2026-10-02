/**
 * "Only the newest call delivers" (V2-T83). Wraps an async `compute` + a `deliver` so that when two
 * calls overlap, the older one's result is dropped instead of delivered — whichever finishes
 * first. Found in a real capture of the Project details dialog: a write action holds the project
 * lock, an ambient 10s refresh that began meanwhile read "locked", and — computed in parallel with
 * the push the action itself makes right after releasing the lock — could finish LAST and leave
 * that stale reading on screen until the next tick. The newer call always carries data read no
 * earlier than the older one, so dropping the older result can never lose information, only a
 * stale reading of it.
 *
 * Not for a `compute` whose every result must be delivered (a queue of events): an overlapped
 * older call is silently discarded here by design.
 *
 * @example
 * const push = deliverLatestOnly(readPanel, (panel) => window.send('update', panel));
 * await push(); // overlapping calls: only the newest reaches `deliver`
 */
export function deliverLatestOnly<T>(
  compute: () => Promise<T>,
  deliver: (value: T) => void,
): () => Promise<void> {
  let latestSequence = 0;
  return async () => {
    latestSequence += 1;
    const sequence = latestSequence;
    const value = await compute();
    if (sequence === latestSequence) {
      deliver(value);
    }
  };
}
