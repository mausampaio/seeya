import { describe, expect, it } from 'vitest';
import { ExitListenerRegistry } from '../../../../packages/app/src/resume/exit-listener-registry.js';

describe('ExitListenerRegistry', () => {
  it('fires the listener registered for an id, with the exit code', () => {
    const registry = new ExitListenerRegistry();
    const calls: number[] = [];
    registry.register('tab-1', (exitCode) => calls.push(exitCode));

    registry.fire('tab-1', 7);

    expect(calls).toEqual([7]);
  });

  it('firing an id nobody registered is a silent no-op', () => {
    const registry = new ExitListenerRegistry();

    expect(() => registry.fire('does-not-exist', 0)).not.toThrow();
  });

  it('fires at most once: a second fire for the same id is a no-op (the listener was forgotten)', () => {
    const registry = new ExitListenerRegistry();
    const calls: number[] = [];
    registry.register('tab-1', (exitCode) => calls.push(exitCode));

    registry.fire('tab-1', 1);
    registry.fire('tab-1', 2);

    expect(calls).toEqual([1]);
  });

  it('registering twice before a fire replaces the first listener (last one wins)', () => {
    const registry = new ExitListenerRegistry();
    const firstCalls: number[] = [];
    const secondCalls: number[] = [];
    registry.register('tab-1', (exitCode) => firstCalls.push(exitCode));
    registry.register('tab-1', (exitCode) => secondCalls.push(exitCode));

    registry.fire('tab-1', 3);

    expect(firstCalls).toEqual([]);
    expect(secondCalls).toEqual([3]);
  });

  it('tracks multiple tab ids independently', () => {
    const registry = new ExitListenerRegistry();
    const calls: Record<string, number> = {};
    registry.register('tab-1', (code) => (calls['tab-1'] = code));
    registry.register('tab-2', (code) => (calls['tab-2'] = code));

    registry.fire('tab-2', 9);

    expect(calls).toEqual({ 'tab-2': 9 });
  });
});
