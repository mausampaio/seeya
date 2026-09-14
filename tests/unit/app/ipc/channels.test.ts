import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../../../../packages/app/src/ipc/channels.js';

describe('CHANNELS', () => {
  it('every channel name is namespaced under seeya: (so it can never collide with an Electron built-in channel)', () => {
    for (const name of Object.values(CHANNELS)) {
      expect(name.startsWith('seeya:')).toBe(true);
    }
  });

  it('every channel name is unique', () => {
    const names = Object.values(CHANNELS);
    expect(new Set(names).size).toBe(names.length);
  });
});
