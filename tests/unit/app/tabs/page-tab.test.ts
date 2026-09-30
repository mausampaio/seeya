import { describe, expect, it } from 'vitest';
import { PAGE_TAB_KINDS, pageTabId } from '../../../../packages/app/src/tabs/page-tab.js';

describe('pageTabId (V2-T63)', () => {
  it('prefixes every kind with "page-"', () => {
    expect(pageTabId('today')).toBe('page-today');
    expect(pageTabId('projects')).toBe('page-projects');
    expect(pageTabId('sessions')).toBe('page-sessions');
  });
});

describe('PAGE_TAB_KINDS', () => {
  it('lists all three kinds, in a fixed order', () => {
    expect(PAGE_TAB_KINDS).toEqual(['today', 'projects', 'sessions']);
  });
});
