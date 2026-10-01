import { describe, expect, it } from 'vitest';
import { resolveSessionStateTone } from '../../../../packages/app/src/state/session-state-tone.js';

describe('resolveSessionStateTone', () => {
  it('alive is success', () => {
    expect(resolveSessionStateTone('alive')).toBe('success');
  });

  it('idle is warning', () => {
    expect(resolveSessionStateTone('idle')).toBe('warning');
  });

  it('ended is neutral', () => {
    expect(resolveSessionStateTone('ended')).toBe('neutral');
  });

  it('unknown is neutral — D-025, no evidence never upgrades to a more alarming tone', () => {
    expect(resolveSessionStateTone('unknown')).toBe('neutral');
  });
});
