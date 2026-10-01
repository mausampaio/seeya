import { describe, expect, it } from 'vitest';
import {
  resolvePageTabIcon,
  resolveTerminalTabIcon,
} from '../../../../packages/app/src/state/tab-strip-icon.js';

describe('resolveTerminalTabIcon (V2-T64)', () => {
  it("maps each origin to the spec's own icon", () => {
    expect(resolveTerminalTabIcon('project')).toBe('folder');
    expect(resolveTerminalTabIcon('session')).toBe('balloon');
    expect(resolveTerminalTabIcon('command')).toBe('terminal');
  });
});

describe('resolvePageTabIcon (V2-T64)', () => {
  it("maps each page kind to the spec's own icon", () => {
    expect(resolvePageTabIcon('today')).toBe('calendar');
    expect(resolvePageTabIcon('projects')).toBe('folder');
    expect(resolvePageTabIcon('sessions')).toBe('balloon');
  });
});
