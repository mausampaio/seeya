/**
 * V2-T65 (PO review, `docs/INTERFACE.md` § 8): the version Settings' own General section shows —
 * `scripts/build.mjs` reads `@seeya-ai/app`'s own `package.json` `"version"` at BUILD time and
 * bakes it into `main.js` via esbuild's `define`, never `app.getVersion()` (which falls back to
 * Electron's own runtime version, e.g. "44.3.0", for every unpackaged launch — `npm run app`
 * included). `tsc -b` never sees a real value for this constant (there is none at type-check
 * time); this ambient declaration is only what lets `main.ts` reference it without "cannot find
 * name" — same pattern `renderer/css-modules.d.ts` already uses for a different build-time-only
 * binding.
 */
declare const __SEEYA_APP_VERSION__: string;
