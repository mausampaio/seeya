import { describe, expect, it } from 'vitest';
import { isSidebarToggleShortcut } from '../../../../packages/app/src/state/sidebar-toggle-shortcut.js';

describe('isSidebarToggleShortcut (maintainer acceptance, 2026-09-25)', () => {
  it('Ctrl+B is the shortcut', () => {
    expect(
      isSidebarToggleShortcut({ key: 'b', ctrlKey: true, metaKey: false, altKey: false }),
    ).toBe(true);
  });

  it('the key is matched case-insensitively (Shift+Ctrl+B sends an uppercase "B")', () => {
    expect(
      isSidebarToggleShortcut({ key: 'B', ctrlKey: true, metaKey: false, altKey: false }),
    ).toBe(true);
  });

  it('Cmd+B is the shortcut too, for macOS parity', () => {
    expect(
      isSidebarToggleShortcut({ key: 'b', ctrlKey: false, metaKey: true, altKey: false }),
    ).toBe(true);
  });

  it('plain "b", with no modifier, is not the shortcut', () => {
    expect(
      isSidebarToggleShortcut({ key: 'b', ctrlKey: false, metaKey: false, altKey: false }),
    ).toBe(false);
  });

  it('a different letter with Ctrl held is not the shortcut', () => {
    expect(
      isSidebarToggleShortcut({ key: 'c', ctrlKey: true, metaKey: false, altKey: false }),
    ).toBe(false);
  });

  it('Ctrl+Alt+B is not the shortcut — Alt changes the chord entirely on some layouts', () => {
    expect(isSidebarToggleShortcut({ key: 'b', ctrlKey: true, metaKey: false, altKey: true })).toBe(
      false,
    );
  });
});
