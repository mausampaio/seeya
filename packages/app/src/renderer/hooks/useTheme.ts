/**
 * D-052 (V2-T75): the window's own effective theme (`'light' | 'dark'`, resolved by
 * `main/main.ts` from `Config.theme` plus the OS's live signal — never decided here), as reactive
 * state for a component that needs the VALUE (e.g. to pick a logo/icon variant in JS rather than
 * `:global([data-theme='dark'])` CSS, `renderer/features/sidebar/Sidebar.module.css`'s own
 * approach). Deliberately narrower than `renderer/legacy/theme-view.ts#wireTheme`, which ALSO
 * applies side effects this hook never touches (`data-theme` on `documentElement`, the open
 * terminals' own colours) — that module keeps doing both for as long as it's the one thing that
 * runs once, at startup, before any component tree exists; this hook is for a component that
 * mounts later and only needs to read the fact.
 *
 * @example
 * const theme = useTheme();
 * <img src={theme === 'dark' ? logoOnDark : logo} />
 */
import { useEffect, useState } from 'preact/hooks';
import { getSeeyaApi } from '../ipc/client.js';
import type { EffectiveTheme } from '../../theme/resolve-theme.js';

export function useTheme(): EffectiveTheme | null {
  const [theme, setTheme] = useState<EffectiveTheme | null>(null);
  const api = getSeeyaApi();

  useEffect(() => {
    let cancelled = false;
    void api.getEffectiveTheme().then((event) => {
      if (!cancelled) {
        setTheme(event.effectiveTheme);
      }
    });
    const unsubscribe = api.onThemeUpdate((event) => setTheme(event.effectiveTheme));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [api]);

  return theme;
}
