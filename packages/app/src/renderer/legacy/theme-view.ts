/**
 * V2-T62 (D-051): applies the window's effective theme (`'light' | 'dark'`, resolved by
 * `electron/main.ts` from `Config.theme` plus the OS's live signal — never decided here) to the
 * two things that read it: the `data-theme` attribute `tokens.css` keys off, and every open
 * terminal's own colours (`tabs-view.ts#setActiveTerminalTheme`, which also updates any tab
 * mounted AFTER this point with the same theme — `docs/INTERFACE.md` princípio 1: "o terminal
 * segue o tema").
 */
import { resolveTerminalTheme } from '../../state/terminal-theme.js';
import type { ThemeUpdateEvent } from '../../ipc/channels.js';
import { setActiveTerminalTheme } from './tabs-view.js';

// `Window.seeya` is declared once, globally, by `renderer.ts` (the module every other view file
// here is imported from) — every file in this program shares that one augmentation.
function applyEffectiveTheme(event: ThemeUpdateEvent): void {
  document.documentElement.dataset.theme = event.effectiveTheme;
  setActiveTerminalTheme(resolveTerminalTheme(event.effectiveTheme));
}

/** Fetches the theme once (before any tab can be mounted — `main()`'s own ordering) and applies
 * every live update after that, for as long as the window stays open. */
export async function wireTheme(): Promise<void> {
  applyEffectiveTheme(await window.seeya.getEffectiveTheme());
  window.seeya.onThemeUpdate(applyEffectiveTheme);
}
