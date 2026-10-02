import { describe, expect, it } from 'vitest';
import {
  resolveWindowSize,
  WINDOW_DEFAULT_HEIGHT,
  WINDOW_DEFAULT_WIDTH,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
} from '../../../../packages/app/src/composition/window-size.js';

describe('resolveWindowSize (V2-T77)', () => {
  it('the floor is 1200px wide — the width below which the tables become unreadable', () => {
    expect(WINDOW_MIN_WIDTH).toBe(1200);
  });

  it('a normal run (no override) opens at the default size, which is never below the floor', () => {
    const size = resolveWindowSize(undefined, undefined);
    expect(size).toEqual({
      width: WINDOW_DEFAULT_WIDTH,
      height: WINDOW_DEFAULT_HEIGHT,
      minWidth: WINDOW_MIN_WIDTH,
      minHeight: WINDOW_MIN_HEIGHT,
    });
    expect(WINDOW_DEFAULT_WIDTH).toBeGreaterThanOrEqual(WINDOW_MIN_WIDTH);
    expect(WINDOW_DEFAULT_HEIGHT).toBeGreaterThanOrEqual(WINDOW_MIN_HEIGHT);
  });

  it('honors an override above the floor', () => {
    const size = resolveWindowSize('1600', '900');
    expect(size.width).toBe(1600);
    expect(size.height).toBe(900);
  });

  it('clamps an override below the floor up to it', () => {
    const size = resolveWindowSize('900', '300');
    expect(size.width).toBe(WINDOW_MIN_WIDTH);
    expect(size.height).toBe(WINDOW_MIN_HEIGHT);
  });

  it('the exact floor is allowed, and a value that is not a number falls back to the default', () => {
    expect(resolveWindowSize('1200', String(WINDOW_MIN_HEIGHT))).toMatchObject({
      width: 1200,
      height: WINDOW_MIN_HEIGHT,
    });
    expect(resolveWindowSize('wide', '')).toMatchObject({
      width: WINDOW_DEFAULT_WIDTH,
      height: WINDOW_DEFAULT_HEIGHT,
    });
  });
});
