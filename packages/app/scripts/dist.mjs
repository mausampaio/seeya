#!/usr/bin/env node
// V2-T8 item 1: wraps `electron-builder` so `npm run dist` is unsigned on every OS by construction
// — never left to whatever a certificate-auto-discovery pass finds lying around on the machine.
//
// **Why this exists instead of just calling `electron-builder` directly from package.json's own
// "dist" script.** First run on this machine printed "signing with signtool.exe" for `seeya.exe`
// and every unpacked `node-pty`/ConPTY binary, right after `certutil -store -user My` had shown
// two self-signed, machine-provisioned certificates neither this project nor its maintainer put
// there — alarming enough to check for real. **Measured, not assumed:**
// `Get-AuthenticodeSignature seeya.exe` on that exact output came back `NotSigned` — the log line
// is printed UNCONDITIONALLY the moment electron-builder enters its Windows signing code path
// (`windowsCodeSign.js#signWindows`), before it has even looked for a certificate; the actual
// "no signing info identified, skipping" decision (`windowsSignToolManager.js#signFile`, no
// `WIN_CSC_LINK`/`CSC_LINK` env var and no `signtoolOptions` configured here) logs at `debug`
// level, invisible at the default log level. So nothing was ever actually signed with those
// certificates — but the log alone can't tell a reader that, and the underlying auto-discovery
// mechanism (`CSC_IDENTITY_AUTO_DISCOVERY`, `flags.js`) is real and DOES change behavior once
// `WIN_CSC_LINK`/a macOS keychain identity is present, which importing this project into a
// different machine or CI environment could introduce without anyone touching this file. Setting
// `CSC_IDENTITY_AUTO_DISCOVERY=false` here makes "unsigned" the actual, enforced behavior instead
// of "unsigned only because nothing happened to be configured this time" — defense in depth, not a
// fix for a defect that turned out not to exist. Not a YAML/JSON config key on purpose: electron-
// builder's own docs keep this env-only, since a shared config file has no business encoding
// "does the machine that happens to run this have a cert". Setting an env var ahead of a plain
// `npm run dist` inline (`VAR=value command`) only works in a POSIX shell — npm's own script
// runner uses cmd.exe on Windows, where that syntax is a parse error — so this file sets it in
// Node (identical on all three OSes) instead of forking the logic per platform.
//
// V2-T8's own contract: "Sem assinatura" — SmartScreen/Gatekeeper warnings are the accepted cost
// this task ships with (a cert is a future decision, registered in Q-078).
//
// console.* solto: this is tooling outside src/, same precedent as scripts/build.mjs (AGENTS.md §
// "Registro e saída").
//
// Usage: `node scripts/dist.mjs [electron-builder args...]` — every argument is forwarded verbatim
// (e.g. `node scripts/dist.mjs --win --dir` for a fast, installer-less packaging pass).

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPlatformSupport } from './dist-platform-check.mjs';
import { checkDescriptionLength } from './check-package-description.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const electronBuilderBin = require.resolve('electron-builder/cli.js');
const packageJson = require(path.join(packageRoot, 'package.json'));

const forwardedArgs = process.argv.slice(2);

// V2-T12 item 3: fail fast, one line, before spending minutes downloading Electron and packaging
// only to hit electron-builder's own raw error partway through — see dist-platform-check.mjs's
// own docstring for the measurement behind each case.
const platformSupport = checkPlatformSupport(forwardedArgs, process.platform);
if (!platformSupport.ok) {
  console.error(platformSupport.message);
  process.exit(1);
}

// V2-T12 item 2: same guard as the regression test in
// tests/unit/app/scripts/check-package-description.test.ts, run again here so a bad description
// never reaches an actual installer even if someone edits package.json without running the test
// suite — see check-package-description.mjs's own docstring for the measurement behind the limit.
const descriptionCheck = checkDescriptionLength(packageJson.description);
if (!descriptionCheck.ok) {
  console.error(descriptionCheck.reason);
  process.exit(1);
}

const result = spawnSync(process.execPath, [electronBuilderBin, ...forwardedArgs], {
  cwd: packageRoot,
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});

if (result.status !== 0) {
  console.error(`electron-builder exited with ${String(result.status)}`);
}
process.exitCode = result.status ?? 1;
