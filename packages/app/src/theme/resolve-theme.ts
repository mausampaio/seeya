/**
 * V2-T62 (D-051): resolves `Config.theme` (`'system' | 'light' | 'dark'`,
 * `@seeya-ai/engine/core/types.js#ThemePreference`) plus the operating system's own live
 * light/dark signal into the single `'light' | 'dark'` value the window actually paints
 * (`electron/renderer.ts` sets this as `data-theme` on `<html>`, the selector `tokens.css`
 * already keys off). Pure: `electron/main.ts` is the only caller, and it is the only place that
 * knows how to ask Electron's `nativeTheme` for the OS's current preference and to keep asking
 * again every time it changes.
 *
 * @example
 * resolveEffectiveTheme('system', true); // 'dark' — the OS is in dark mode
 * resolveEffectiveTheme('light', true); // 'light' — a pinned choice ignores the OS
 */
import type { ThemePreference } from '@seeya-ai/engine/core/types.js';

export type EffectiveTheme = 'light' | 'dark';

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}
