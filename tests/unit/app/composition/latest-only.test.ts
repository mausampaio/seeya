import { describe, expect, it } from 'vitest';
import { deliverLatestOnly } from '../../../../packages/app/src/composition/latest-only.js';

/** A compute whose result the test releases by hand, in any order. */
class ManualCompute {
  private readonly resolvers: Array<(value: string) => void> = [];
  readonly run = (): Promise<string> =>
    new Promise<string>((resolve) => {
      this.resolvers.push(resolve);
    });
  release(index: number, value: string): void {
    this.resolvers[index]?.(value);
  }
}

describe('deliverLatestOnly (V2-T83)', () => {
  it('delivers a lone call', async () => {
    const delivered: string[] = [];
    const push = deliverLatestOnly(
      () => Promise.resolve('only'),
      (value) => delivered.push(value),
    );
    await push();
    expect(delivered).toEqual(['only']);
  });

  it('regression: an older call that finishes AFTER a newer one never overwrites it', async () => {
    const compute = new ManualCompute();
    const delivered: string[] = [];
    const push = deliverLatestOnly(compute.run, (value) => delivered.push(value));

    const older = push(); // an ambient tick that read the lock as held
    const newer = push(); // the action's own push, after the lock was released
    compute.release(1, 'fresh');
    await newer;
    compute.release(0, 'stale');
    await older;

    expect(delivered).toEqual(['fresh']);
  });

  it('an older call that finishes BEFORE the newer one is dropped too — the newer one delivers fresher data', async () => {
    const compute = new ManualCompute();
    const delivered: string[] = [];
    const push = deliverLatestOnly(compute.run, (value) => delivered.push(value));

    const older = push();
    const newer = push();
    compute.release(0, 'older');
    await older;
    compute.release(1, 'newer');
    await newer;

    expect(delivered).toEqual(['newer']);
  });

  it('sequential calls each deliver', async () => {
    const delivered: number[] = [];
    let counter = 0;
    const push = deliverLatestOnly(
      () => Promise.resolve((counter += 1)),
      (value) => delivered.push(value),
    );
    await push();
    await push();
    expect(delivered).toEqual([1, 2]);
  });
});
