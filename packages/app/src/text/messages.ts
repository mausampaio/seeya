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

  // V2-T4 item 3 — the fallback confirmation dialog (S5-T9's "warn BEFORE, and ask", as a dialog
  // instead of the CLI's readline question). `reasonText` itself comes from
  // `resume/fallback-confirmer.ts` (core/resume-notice.ts#describeFallbackReason, the exact same
  // wording the CLI shows) — never duplicated here.
  fallbackDialogTitle: (sessionName: string): string => `Could not resume "${sessionName}" as-is`,
  fallbackDialogBody:
    'Opening a new session there would start a FRESH conversation: it would not have this ' +
    "session's full history.",
  fallbackDialogOpen: 'Open a fresh session',
  fallbackDialogSkip: 'Skip',
} as const;
