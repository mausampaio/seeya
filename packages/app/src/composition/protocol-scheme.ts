/**
 * V2-T10 item 1: decides WHICH `seeya://`-shaped scheme this process should register with the OS
 * — the only fact that matters is whether this is a packaged (installed) build or an unpackaged
 * dev launch (`app.isPackaged`, read only in `electron/main.ts`, never here: this module stays a
 * pure function of that one boolean, testable without Electron itself, the same seam
 * `linux-protocol-marker.ts`'s own `shouldMarkLinuxProtocolRegistered` already uses for the
 * equivalent Linux decision).
 *
 * **Why two schemes (docs/QUESTOES.md Q-080; the V2-T10 plan entry's own "o achado").** Before
 * this task, the packaged app and a dev launch both registered the identical `seeya://` every
 * time either one started — Windows keeps only the LAST registration, so whichever world started
 * most recently silently stole every future toast click from the other, including the one the
 * maintainer was actually looking at. One scheme per world means the two registrations can never
 * collide again. `ProtocolScheme` itself lives in `@seeya-ai/engine/core/types.js` (not here)
 * because `core/ports.ts#Storage.readActiveProtocolScheme`/`saveActiveProtocolScheme` need the
 * same type on the engine side of the package boundary.
 *
 * @example
 * resolveProtocolScheme(true)  // → 'seeya' (the installed app)
 * resolveProtocolScheme(false) // → 'seeya-dev' (npm run app)
 */
import type { ProtocolScheme } from '@seeya-ai/engine/core/types.js';

export type { ProtocolScheme };

export function resolveProtocolScheme(isPackaged: boolean): ProtocolScheme {
  return isPackaged ? 'seeya' : 'seeya-dev';
}
