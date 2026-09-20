// V2-T12 item 3: one guard per platform combination `npm run dist:*` can hit, measured on this
// task, so a developer sees one clear line instead of electron-builder's own multi-line stack
// trace or a silent, half-finished `dist-installer/`.
//
// Linux target from a Windows host — measured directly: `node scripts/dist.mjs --linux`, run on
// this Windows machine with no container, gets all the way through downloading Electron and
// packaging the unpacked app, then fails building the AppImage target with
//   EPERM: operation not permitted, symlink 'usr\share\icons\hicolor\1024x1024\apps\seeya.png'
//   -> '...\dist-installer\__appImage-x64\seeya.png'
// (Windows refuses to create the Unix symlink AppImage packaging needs; the .deb target never
// even runs afterwards — `dist-installer/` was left with only `linux-unpacked/`). This project
// already carries the fix for this class of problem: `scripts/verificar-linux.mjs` runs the
// whole quality gate inside a `node:22-bookworm` container for the same underlying reason
// (native, per-OS filesystem behavior) — this guard points at that same pattern rather than
// reimplementing a container runner here, which is a bigger change than this task's own scope.
//
// macOS .dmg — not independently measured here (this machine is Windows, and `dmg` needs
// `hdiutil`, which only ships on macOS); it is the same fact `electron-builder.yml`'s own `mac:`
// block already documents ("`.dmg` só se constrói no macOS", V2-T8's own scope, CI-only). Guarded
// the same way for consistency, not because this task re-derived it independently.
export function checkPlatformSupport(args, hostPlatform) {
  if (requestsLinux(args) && hostPlatform === 'win32') {
    return {
      ok: false,
      message:
        'dist:linux cannot build the Linux target from a Windows host (measured: EPERM creating a symlink while packaging AppImage) — run it inside a Linux container instead, the same way `npm run verificar:linux` already does.',
    };
  }
  if (requestsMac(args) && hostPlatform !== 'darwin') {
    return {
      ok: false,
      message:
        'dist:mac cannot build the macOS .dmg target outside macOS (it needs `hdiutil`, which only ships there) — build it on macOS, or let the CI macOS job do it.',
    };
  }
  return { ok: true };
}

function requestsLinux(args) {
  return args.some((arg) => arg === '--linux' || arg === '-l' || arg.startsWith('--linux='));
}

function requestsMac(args) {
  return args.some(
    (arg) =>
      arg === '--mac' ||
      arg === '--macos' ||
      arg === '-m' ||
      arg === '-o' ||
      arg.startsWith('--mac=') ||
      arg.startsWith('--macos='),
  );
}
