# @seeya-ai/app

Desktop interface for seeya (D-042): an embedded terminal (Electron + `@xterm/xterm` +
`node-pty`) that shows the sessions this machine discovers and lets a person open the harness in
a tab.

Second composition root (D-043) — consumes `@seeya-ai/engine` in-process. V2-T5b: also resolves
`@seeya-ai/cli`'s own compiled bin entry point (never imports its source) to spawn the daemon
worker as a detached child, the same subprocess `@seeya-ai/cli`'s own `seeya daemon` launches for
itself.

Build and run from the repo root (`npm run app`) — see the root [`README.md`](../../README.md).

## Why this note isn't in `package.json`'s `description`

That field used to hold the paragraph above. It's the same field electron-builder writes into the
Windows Start Menu shortcut's description and into the `.deb` package's `Description:` control
field (V2-T12) — and, measured on this machine, a description over ~260 characters corrupts the
shortcut's icon field (`packages/app/electron-builder.yml`'s own comment above `win:`, and
`tests/unit/app/package-description.test.ts`, has the reproduction and the exact threshold). The
`description` field is now a one-line summary sized for a shortcut tooltip and a package manager
listing; this file is where the longer architectural note moved to, since it survives an
`npm install` the way a comment inside `package.json` (which is plain JSON, no comments) could
not.
