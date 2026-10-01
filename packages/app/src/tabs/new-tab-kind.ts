/**
 * The New tab popover's own command selector (V2-T64, `docs/INTERFACE.md` § 2: "seletor `claude`
 * · `codex` · `Shell` · `Other…`") — pure, no Preact, no Electron (D-041: "tudo que tiver lógica
 * fica fora de electron/"), so the mapping from a chosen segment to the actual command string sent
 * to `CHANNELS.createTab` is unit-tested without mounting anything.
 *
 * A tab opened this way is always the generic "shell/terminal" icon in the strip
 * (`state/tab-strip.ts`), regardless of which kind was picked here — `docs/INTERFACE.md` § 2 lists
 * "projeto"/"sessão retomada ou adotada" as the OTHER two terminal-tab icons, both reserved for
 * tabs `resume/project-tab-launcher.ts`/`resume/tab-session-resumer.ts` open, never one opened from
 * this popover.
 */
export type NewTabKind = 'claude' | 'codex' | 'shell' | 'other';

/** Display order, fixed (`docs/INTERFACE.md` § 2's own literal order) — never reordered by use. */
export const NEW_TAB_KINDS: readonly NewTabKind[] = ['claude', 'codex', 'shell', 'other'];

export const NEW_TAB_KIND_LABEL: Record<NewTabKind, string> = {
  claude: 'claude',
  codex: 'codex',
  shell: 'Shell',
  other: 'Other…',
};

/**
 * The command string `CHANNELS.createTab`'s own `CreateTabRequest.command` expects — empty string
 * means "the default system shell" (`main/main.ts`'s own handler, unchanged by this task).
 * `otherCommand` is only read for `'other'`, trimmed so a popover left with trailing whitespace in
 * the free-text field never becomes part of the command main.ts resolves.
 *
 * @example
 * resolveNewTabCommand('shell', ''); // ''
 * resolveNewTabCommand('other', '  npx tsx  '); // 'npx tsx'
 */
export function resolveNewTabCommand(kind: NewTabKind, otherCommand: string): string {
  switch (kind) {
    case 'claude':
      return 'claude';
    case 'codex':
      return 'codex';
    case 'shell':
      return '';
    case 'other':
      return otherCommand.trim();
  }
}
