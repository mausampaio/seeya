/**
 * The strings of the schedule strip and the daemon pill (V2-T51: split out of `text/messages.ts`, which spreads it into
 * `MESSAGES` — the same pattern `project-details-messages.ts` already uses). No imports on
 * purpose, same as `messages.ts`.
 */
export const SCHEDULE_DAEMON_MESSAGES = {
  // V2-T5b item 1 — the faixa de horário (state/schedule-strip.ts). One PAIR of strings per
  // `ScheduleDecision` variant (D-024, "nada achatado") — `primary` (weight 500, left) and
  // `secondary` (tertiary colour, right), the icon+two-text row `docs/INTERFACE.md` § 1 item 7
  // asks for (PO review, 2026-10-01: the earlier single flat `text` string read as loose text with
  // no visual hierarchy between the fact and the detail). Computed on every refresh tick from the
  // same `decideSchedule` the daemon itself polls.
  scheduleStripPrimary: 'End of day',
  scheduleStripWaitingPrimary: (time: string): string => `End of day ${time}`,
  scheduleStripNotConfigured: 'not configured',
  scheduleStripSkippedToday: 'skipped today',
  scheduleStripAlreadyRanToday: 'already ran today',
  scheduleStripRemaining: (remaining: string): string => `in ${remaining}`,
  scheduleStripDueNow: 'due now',
  // V2-T63 (`docs/INTERFACE.md` § 1's own "Snooze ▾ (menu com +15m, +30m, +1h)"): a menu replaces
  // the three always-visible buttons this footer had before. PO review (2026-10-01): the trigger
  // moved from an unstyled native `<select>` to a `Button` with a real `ChevronDownIcon` next to
  // it — the label itself no longer carries the "▾" glyph, the icon draws it now.
  scheduleStripSnoozeMenuLabel: 'Snooze',
  scheduleStripSnooze15: '+15m',
  scheduleStripSnooze30: '+30m',
  scheduleStripSnooze1h: '+1h',
  scheduleStripSkipToday: 'Skip today',
  // V2-T50 (D-006 amendment of 2026-09-24): the item inside the Snooze menu that zeroes today's
  // snooze. `docs/INTERFACE.md` § 1 does not place it; Q-NNN records the choice.
  scheduleStripUndoSnooze: 'Undo snooze',
  scheduleStripUndoSnoozeTooLate: (configuredTime: string): string =>
    `${configuredTime} has already passed`,

  // V2-T5b item 3 — Start/Stop daemon (state/daemon-control-panel.ts). `resultText` is whatever
  // the composition root's own start orchestration or
  // `@seeya-ai/engine/scheduler/daemon-control.js#runDaemonStop` already prints for the CLI's own
  // `seeya daemon`/`seeya daemon --stop` (D-039: literal text, not a second wording).
  // V2-T63 (`docs/INTERFACE.md` § 1's own "pílula do daemon"): the button's own TEXT is now the
  // state ("Daemon running"/"Daemon stopped"), not the action it offers — clicking it still does
  // the opposite of what it says, same as before, just worded as the fact it's reporting.
  daemonPillRunning: 'Daemon running',
  daemonPillStopped: 'Daemon stopped',
  daemonControlUnknown: 'Daemon: cannot verify.',
  daemonControlRunning: 'Working…',
  // Correction (real-window screenshot review): the pill's own icon button needs its own
  // aria-label naming the ACTION it performs (▶/■) — distinct from `daemonPillRunning`/
  // `daemonPillStopped` above, which are the pill's own label text (the fact, not the action).
  daemonControlStartAction: 'Start daemon',
  daemonControlStopAction: 'Stop daemon',

  // V2-T13 item 5 — the ownership-transition dialog (D-045 item 1), shown once per machine.
  daemonOwnershipTransitionTitle:
    'seeya found a daemon or autostart already set up on this machine',
  daemonOwnershipTransitionBody: (launchPath: string): string =>
    `seeya is installed (${launchPath}) and can now own the daemon and autostart on this machine. ` +
    'Accepting stops the daemon that is running (if any), points autostart at this app, and ' +
    'starts its own daemon. Declining changes nothing — whatever runs the daemon and autostart ' +
    // V2-T65: "the button next to Autostart" pointed at the sidebar footer's own autostart button,
    // apagado by this task — the switch now lives in Settings' own General section.
    'today keeps doing it, and you can enable this later from Settings → General → Start with ' +
    'the system. Either way, this is asked only once on this machine.',
  daemonOwnershipTransitionAccept: 'Let seeya take over',
  daemonOwnershipTransitionDecline: 'Leave it as it is',
  daemonOwnershipTransitionApplying: 'Working…',
  // V2-T71 — one line beside each button (`docs/INTERFACE.md` § 9's own "o que cada escolha
  // faz"), on top of the fuller paragraph above.
  daemonOwnershipTransitionAcceptExplanation:
    'Stops the daemon that is running (if any), points autostart at this app, and starts its ' +
    'own daemon.',
  daemonOwnershipTransitionDeclineExplanation:
    'Changes nothing — whatever runs the daemon and autostart today keeps doing it.',
} as const;
