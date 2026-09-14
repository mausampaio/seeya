/**
 * Every string the interface shows a person, concentrated here (D-028: English; AGENTS.md §
 * "Texto voltado ao usuário" — the same discipline `packages/cli/src` already follows for CLI
 * output, applied to the renderer instead of a terminal).
 */
export const MESSAGES = {
  windowTitle: 'seeya',
  newTabButton: '+',
  commandBarCommandLabel: 'Command',
  commandBarCommandPlaceholder: 'claude, codex, or leave blank for a shell',
  commandBarCwdLabel: 'Directory',
  commandBarCwdPlaceholder: 'Working directory',
  commandBarSubmit: 'Open',
  commandBarCancel: 'Cancel',
  sidebarHeading: 'Sessions',
  sidebarEmpty: 'No sessions discovered on this machine.',
  statusHeading: 'Status',
  tabExited: (exitCode: number): string => `exited (code ${exitCode})`,
} as const;
