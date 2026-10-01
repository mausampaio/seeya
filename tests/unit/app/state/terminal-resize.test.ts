import { describe, expect, it } from 'vitest';
import {
  decideTerminalResize,
  type TerminalDimensions,
} from '../../../../packages/app/src/state/terminal-resize.js';

const VALID: TerminalDimensions = { cols: 80, rows: 24 };
const CLAMPED_MINIMUM: TerminalDimensions = { cols: 2, rows: 1 };

describe('decideTerminalResize', () => {
  it('skips a hidden terminal, even with otherwise valid-looking dimensions', () => {
    expect(decideTerminalResize(true, VALID, null)).toEqual({ kind: 'skip', reason: 'hidden' });
  });

  it('skips a hidden terminal measured at the degenerate 2x1 size the bug report named', () => {
    // Maintainer diagnosis: `FitAddon.proposeDimensions` clamps a `display: none` container's
    // own 0px/0px computed style down to exactly this, rather than refusing outright — `hidden`
    // must win over any dimension check, not just the "too small" one below.
    expect(decideTerminalResize(true, CLAMPED_MINIMUM, null)).toEqual({
      kind: 'skip',
      reason: 'hidden',
    });
  });

  it('skips dimensions below the reasonable minimum (< 2 cols) while visible', () => {
    expect(decideTerminalResize(false, { cols: 1, rows: 24 }, null)).toEqual({
      kind: 'skip',
      reason: 'invalidDimensions',
    });
  });

  it('skips dimensions below the reasonable minimum (< 1 row) while visible', () => {
    expect(decideTerminalResize(false, { cols: 80, rows: 0 }, null)).toEqual({
      kind: 'skip',
      reason: 'invalidDimensions',
    });
  });

  it('skips non-finite dimensions while visible (never NaN/Infinity reaching the pty)', () => {
    expect(decideTerminalResize(false, { cols: NaN, rows: 24 }, null)).toEqual({
      kind: 'skip',
      reason: 'invalidDimensions',
    });
    expect(decideTerminalResize(false, { cols: 80, rows: Infinity }, null)).toEqual({
      kind: 'skip',
      reason: 'invalidDimensions',
    });
  });

  it('accepts exactly the reasonable minimum (2x1) while visible', () => {
    expect(decideTerminalResize(false, CLAMPED_MINIMUM, null)).toEqual({
      kind: 'resize',
      dimensions: CLAMPED_MINIMUM,
    });
  });

  it('skips when unchanged from the previous resize actually sent', () => {
    expect(decideTerminalResize(false, VALID, VALID)).toEqual({
      kind: 'skip',
      reason: 'unchanged',
    });
  });

  it('resizes when dimensions genuinely changed from the previous resize', () => {
    const previous: TerminalDimensions = { cols: 80, rows: 23 };
    expect(decideTerminalResize(false, VALID, previous)).toEqual({
      kind: 'resize',
      dimensions: VALID,
    });
  });

  it('resizes the first time, with no previous resize to compare against', () => {
    expect(decideTerminalResize(false, VALID, null)).toEqual({
      kind: 'resize',
      dimensions: VALID,
    });
  });
});
