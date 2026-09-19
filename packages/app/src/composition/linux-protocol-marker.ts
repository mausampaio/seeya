/**
 * V2-T8 item 4: whether this run of the packaged app has good reason to believe `seeya://` is
 * registered on Linux — the fact `linux-notify-send.ts`'s own click-action gate reads through
 * `Storage.readActiveProtocolScheme()` (D-025, reshaped from a boolean by V2-T10 item 2 — always
 * `'seeya'` on Linux, never `'seeya-dev'`, see this file's own docstring below).
 *
 * **Why this can't be the same mechanism as Windows.** `electron/main.ts#registerProtocolHandler`
 * calls `app.setAsDefaultProtocolClient(scheme)` and trusts its own boolean return — Electron
 * itself performs the registration AND reports whether it worked. On Linux, Electron's own docs
 * are explicit that this method "is only implemented on macOS and Windows"; registration there
 * comes entirely from the package's own `.desktop` file (`MimeType=x-scheme-handler/seeya;`),
 * written once, at INSTALL time, by `dpkg` — not by this process, and not at any point this
 * process could observe directly. There is no API this file can call to ask "did that already
 * happen".
 *
 * **What this infers instead, and why it's an inference, not a measurement (flagged in
 * docs/QUESTOES.md Q-078 for the maintainer).** This project ships exactly two packaged Linux
 * formats (D-041's own scope): `.deb`, which DOES carry the `.desktop` file (`electron-builder`'s
 * `deb` target writes it from this project's own `protocols` config, item 1 of this same task),
 * and `AppImage`, which installs NOTHING system-wide — no `.desktop` file exists unless the person
 * separately runs an integration tool (`AppImageLauncher` or similar), which is outside this
 * project's control and this task's scope. Telling the two apart at runtime uses the AppImage
 * runtime's own documented convention: an AppImage sets `APPIMAGE` in its own process's
 * environment before running the wrapped binary. So "packaged, `APPIMAGE` unset" reads as "this is
 * the `.deb` build" — true for this project's only two packaged shapes today, false the day a
 * third one is added without updating this function.
 *
 * `platform !== 'linux'` and an unpackaged dev launch (`npm run app`) both return `false` outright
 * — dev has no `.desktop` file to begin with (same reasoning `registerProtocolHandler`'s own
 * docstring gives for skipping Windows registration there).
 *
 * @example
 * shouldMarkLinuxProtocolRegistered({ platform: 'linux', isPackaged: true, appImageEnv: undefined })
 * // → true (.deb install, inferred)
 * shouldMarkLinuxProtocolRegistered({ platform: 'linux', isPackaged: true, appImageEnv: '/x.AppImage' })
 * // → false (AppImage — nothing registered it)
 */
export interface LinuxProtocolMarkerInputs {
  readonly platform: NodeJS.Platform;
  readonly isPackaged: boolean;
  /** `process.env.APPIMAGE` — the AppImage runtime's own marker of its own execution, present only
   * when THIS process was launched from inside an AppImage. */
  readonly appImageEnv: string | undefined;
}

export function shouldMarkLinuxProtocolRegistered(inputs: LinuxProtocolMarkerInputs): boolean {
  return inputs.platform === 'linux' && inputs.isPackaged && inputs.appImageEnv === undefined;
}
