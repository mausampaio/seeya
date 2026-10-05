/**
 * Payload shapes of the schedule strip, daemon, autostart, Settings and ownership-transition channels (V2-T51: split out of `ipc/channels.ts`, which still re-exports every
 * one of them, so no importer changed). Pure types — no `electron` import.
 */
import type { ScheduleStripData } from '../state/schedule-strip.js';
import type { DaemonControlAvailability } from '../state/daemon-control-panel.js';
import type { AutostartControlAvailability } from '../state/autostart-control-panel.js';
import type { SettingsRow, ProjectPolicyLine } from '../state/settings-panel.js';

/** `CHANNELS.scheduleUpdate`'s payload and `CHANNELS.snoozeToday`/`CHANNELS.skipToday`'s response
 * — the exact shape `state/schedule-strip.ts#buildScheduleStripData` produces (V2-T5b item 1). */
export type ScheduleUpdateEvent = ScheduleStripData;

/** `CHANNELS.getScheduleStrip`'s response — same shape as `ScheduleUpdateEvent`, fetched instead
 * of pushed (V2-T75 PO review, round 3). */
export type ScheduleStripResponse = ScheduleUpdateEvent;

/** `CHANNELS.snoozeToday`'s payload — D-006's three named increments
 * (`@seeya-ai/engine/application/schedule-adjustments.js#SNOOZE_INCREMENTS`'s own values), never a
 * free-form number: the faixa only ever offers these three buttons. */
export interface SnoozeTodayRequest {
  readonly minutes: 15 | 30 | 60;
}

/** `CHANNELS.daemonAvailabilityUpdate`'s payload — the exact shape
 * `state/daemon-control-panel.ts#resolveDaemonControlAvailability` produces. */
export type DaemonAvailabilityUpdateEvent = DaemonControlAvailability;

/** `CHANNELS.getDaemonAvailability`'s response — same shape as `DaemonAvailabilityUpdateEvent`,
 * fetched instead of pushed (V2-T75 PO review, round 3). */
export type DaemonAvailabilityResponse = DaemonAvailabilityUpdateEvent;

/** `CHANNELS.daemonControl`'s payload. `action` is `'start'` when the button last showed "Start
 * daemon", `'stop'` otherwise — decided renderer-side from its own `DaemonControlAvailability`
 * (never re-derived by `electron/main.ts`, which has no logic of its own, D-041). */
export interface DaemonControlRequest {
  readonly action: 'start' | 'stop';
}

/** `CHANNELS.daemonControl`'s response — the literal text `AppContext#startDaemon`/`#stopDaemon`
 * already produces (D-039: the same text the CLI would print for the equivalent action).
 *
 * **`availability` (V2-T21 item 1).** The recomputed `DaemonControlAvailability`, from a fresh
 * `checkLiveLock` the handler runs right after the action — never the request's own `action`
 * flipped by hand, and never left for the next ambient tick to supply. Same "the action's own
 * response carries the state that follows from it" rule `snoozeToday`/`skipToday` already follow
 * for the faixa de horário (V2-T5b). */
export interface DaemonControlResponse {
  readonly resultText: string;
  readonly availability: DaemonControlAvailability;
}

/** `CHANNELS.getSettingsPanel`'s response (V2-T14 item 1) — `rows` is
 * `state/settings-panel.ts#buildSettingsRows`'s own output; `projectPolicyLines` is
 * `buildProjectPolicyLines`'s own output, shown read-only (the plan entry's own "o que não
 * entra": `projectPolicy` isn't scalar, so it never gets an editable row). */
export interface SettingsPanelResponse {
  readonly rows: readonly SettingsRow[];
  readonly projectPolicyLines: readonly ProjectPolicyLine[];
}

/** `CHANNELS.saveSetting`'s payload (V2-T14 item 2). `key`/`rawValue` are untyped strings, not
 * `EditableConfigKey` — the renderer only ever offers one of the sixteen rows it was just handed,
 * but the SAME validation the CLI's `seeya config set` runs
 * (`parseConfigFieldUpdate`/`applyConfigFieldUpdate`) is what decides whether a key/value is
 * accepted, in `electron/main.ts`'s own handler — never a second, renderer-side check of its own. */
export interface SaveSettingRequest {
  readonly key: string;
  readonly rawValue: string;
}

/** `CHANNELS.saveSetting`'s response — a discriminated union (D-024, "nada achatado"): a rejected
 * value carries `error` (`parseConfigFieldUpdate`'s own message, AGENTS.md § "Mensagens de erro" —
 * the raw value and the expected shape) and nothing else, never a half-updated `rows`/`schedule`
 * next to it. A saved value carries the freshly re-read `rows` (so every row's own `origin` stays
 * correct, not just the one that changed) and the freshly recomputed `schedule` (V2-T14 item 3 —
 * the faixa de horário updates immediately, without waiting for the next ambient refresh tick). */
export type SaveSettingResponse =
  | {
      readonly ok: true;
      readonly rows: readonly SettingsRow[];
      readonly schedule: ScheduleStripData;
    }
  | { readonly ok: false; readonly error: string };

/** `CHANNELS.autostartAvailabilityUpdate`'s payload — the exact shape
 * `state/autostart-control-panel.ts#resolveAutostartControlAvailability` produces (V2-T13 item 4). */
export type AutostartAvailabilityUpdateEvent = AutostartControlAvailability;

/** `CHANNELS.getAutostartAvailability`'s response — same shape as `AutostartAvailabilityUpdateEvent`,
 * fetched instead of pushed (V2-T65), same "first paint without waiting for the ambient tick"
 * reasoning as `getDaemonAvailability`/`getScheduleStrip` above. */
export type AutostartAvailabilityResponse = AutostartAvailabilityUpdateEvent;

/** `CHANNELS.autostartControl`'s payload. `action` is `'enable'` when the button last showed
 * "Enable autostart", `'disable'` otherwise — decided renderer-side from its own
 * `AutostartControlAvailability` (never re-derived by `electron/main.ts`, D-041). */
export interface AutostartControlRequest {
  readonly action: 'enable' | 'disable';
}

/** `CHANNELS.autostartControl`'s response — the literal text
 * `cli/autostart-command.ts#runAutostartEnableCommand`/`runAutostartDisableCommand` already
 * produces for the equivalent CLI action (D-039), rendered by `AppContext.enableAppAutostart`/
 * `context.autostart.disable` through the same wording.
 *
 * **`availability` (V2-T21 item 1).** The recomputed `AutostartControlAvailability`, from a fresh
 * `Autostart.status()` the handler forces right after the action (also refreshing
 * `state/autostart-cache.ts`'s own 60s cache — otherwise the next ambient tick would still hand
 * back the pre-click value). The measured defect this fixes: without this, the button stayed
 * mislabeled for up to a minute AND a click in that window sent the stale action ("Autostart was
 * already disabled. Nothing changed."). */
export interface AutostartControlResponse {
  readonly resultText: string;
  readonly availability: AutostartControlAvailability;
}

/** `CHANNELS.getDaemonOwnershipTransitionOffer`'s response (V2-T13 item 5, D-045 item 1).
 * `launchPath` is only meaningful when `shouldOffer` is `true` (the app's own installed path,
 * shown in the dialog's body) — empty string otherwise, never read by the renderer in that case. */
export interface DaemonOwnershipTransitionOfferResponse {
  readonly shouldOffer: boolean;
  readonly launchPath: string;
}

/** `CHANNELS.answerDaemonOwnershipTransition`'s payload (V2-T13 item 5). */
export interface AnswerDaemonOwnershipTransitionRequest {
  readonly answer: 'accepted' | 'declined';
}
