/**
 * V2-T57: whether THIS window has any business touching protocol registration at all — the OS
 * registration (`electron/main.ts#registerProtocolHandler`, Windows only) and the
 * `~/.seeya/protocol-handler.json` marker (`Storage.saveActiveProtocolScheme`, every platform).
 *
 * Before this task, a verification window launched with `SEEYA_APP_HOME_OVERRIDE` — the
 * instrumentation `docs/FLUXO-DE-AGENTES.md` already documents for proving the window against a
 * disposable home — still registered the scheme and wrote the marker: `SEEYA_APP_HOME_OVERRIDE`
 * only redirects `~/.seeya`/`~/.claude` reads, never OS-level protocol registration, which reads
 * straight from `process.env`/the Windows registry regardless of which home the rest of the window
 * is using. Measured twice (V2-T30, V2-T55, both 2026-09-25): each agent verification left
 * `HKCU\Software\Classes\seeya-dev` pointing at a worktree's Electron binary that was later
 * deleted, and the first one also overwrote the REAL `protocol-handler.json` with
 * `activeScheme: "seeya-dev"` — which would have diverted the maintainer's own installed-app toast
 * clicks to a scheme nothing answers. A verification window never has reason to be the app that
 * owns the person's real notification clicks, so it now skips both writes entirely.
 *
 * Pure function of the one env var that already distinguishes a verification window from a real
 * one (`buildAppContext`'s own home-override parameter) — no Electron API involved, so it is
 * testable without a display and without touching the registry.
 *
 * **Where this stops.** `npm run app` with no `SEEYA_APP_HOME_OVERRIDE` still registers
 * `seeya-dev` exactly as before — that is the maintainer's own development window, and it needs
 * the real registration to test a toast click end to end. Isolation here is scoped to the
 * verification instrumentation, not to development in general.
 *
 * @example
 * shouldRegisterProtocolScheme(undefined) // → true (installed app, or `npm run app`)
 * shouldRegisterProtocolScheme('/tmp/fixture-home') // → false (a verification window)
 */
export function shouldRegisterProtocolScheme(homeOverride: string | undefined): boolean {
  return homeOverride === undefined;
}
