/**
 * V2-T62 (D-051): applies the window's effective theme (`'light' | 'dark'`, resolved by
 * `electron/main.ts` from `Config.theme` plus the OS's live signal — never decided here) to the
 * two things that read it: the `data-theme` attribute `tokens.css` keys off, and every open
 * terminal's own colours (`features/tabs/terminal-theme-registry.ts#setActiveTerminalTheme`,
 * moved out of the deleted `tabs-view.ts` by V2-T64 — still updates any tab mounted AFTER this
 * point with the same theme, `docs/INTERFACE.md` princípio 1: "o terminal segue o tema").
 *
 * PO review (2026-10-01): the terminal's colours now come from `getComputedStyle` on
 * `<html>` — `readCssToken` below — AFTER `data-theme` is set on the line above it, so the
 * computed values are always the NEW theme's, never a stale one from before this call. This is
 * the only DOM access in the whole terminal-theme feature on purpose
 * (`state/terminal-theme.ts`'s own docstring: the rest of that module stays pure).
 */
import { buildTerminalThemeFromTokens } from '../../state/terminal-theme.js';
import type { ThemeUpdateEvent } from '../../ipc/channels.js';
import { setActiveTerminalTheme } from '../features/tabs/index.js';

/** Reads a `tokens.css` custom property's current, resolved value off `<html>` — whatever
 * `[data-theme='dark']`/`:root` currently has it set to, trimmed (browsers pad the raw
 * `getPropertyValue` string with the whitespace the declaration itself had around the value). */
function readCssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// `Window.seeya` is declared once, globally, by `renderer.ts` (the module every other view file
// here is imported from) — every file in this program shares that one augmentation.
function applyEffectiveTheme(event: ThemeUpdateEvent): void {
  document.documentElement.dataset.theme = event.effectiveTheme;
  setActiveTerminalTheme(
    buildTerminalThemeFromTokens({
      background: readCssToken('--seeya-background'),
      text: readCssToken('--seeya-text'),
      brandSoft: readCssToken('--seeya-brand-soft'),
    }),
  );
}

/** Fetches the theme once (before any tab can be mounted — `main()`'s own ordering) and applies
 * every live update after that, for as long as the window stays open. */
export async function wireTheme(): Promise<void> {
  applyEffectiveTheme(await window.seeya.getEffectiveTheme());
  window.seeya.onThemeUpdate(applyEffectiveTheme);
}
