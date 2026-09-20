/**
 * `adapters/autostart/env.ts` (V2-T23) — the pure allowlist filter, tested in isolation from any
 * of the three OS adapters that call it (`macos.test.ts`/`linux.test.ts`/`windows.test.ts` each
 * have their own end-to-end case proving the SAME filtering happens once it reaches the written
 * file/unit/script).
 */
import { describe, expect, it } from 'vitest';
import {
  AUTOSTART_ENV_VAR_ALLOWLIST,
  AUTOSTART_OUTPUT_LOG_FILE_NAME,
  buildAutostartEnv,
} from '@seeya-ai/engine/adapters/autostart/env.js';

describe('buildAutostartEnv', () => {
  it('keeps ELECTRON_RUN_AS_NODE and PATH when both are present', () => {
    expect(buildAutostartEnv({ ELECTRON_RUN_AS_NODE: '1', PATH: '/usr/bin:/bin' })).toEqual({
      ELECTRON_RUN_AS_NODE: '1',
      PATH: '/usr/bin:/bin',
    });
  });

  it('keeps only the entries present — PATH alone, with no ELECTRON_RUN_AS_NODE key at all', () => {
    expect(buildAutostartEnv({ PATH: '/usr/bin:/bin' })).toEqual({ PATH: '/usr/bin:/bin' });
  });

  // The measured Mac defect (docs/PLANO-DE-ENTREGA.md V2-T23): a live-spawn environment carries
  // far more than the allowlist, and none of it may survive — SSH_AUTH_SOCK is the specific
  // variable the plan entry calls out as the most dangerous to keep.
  it('drops every variable outside the allowlist, even a large realistic photograph of a live login', () => {
    const liveLoginPhotograph: Record<string, string> = {
      ELECTRON_RUN_AS_NODE: '1',
      PATH: '/usr/bin:/bin',
      SSH_AUTH_SOCK: '/private/tmp/com.apple.launchd.deadSocket/Listeners',
      TMPDIR: '/var/folders/dead-login-temp-dir/',
      XPC_SERVICE_NAME: 'com.seeya.app',
      XPC_FLAGS: '0x0',
      __CFBundleIdentifier: 'com.seeya.app',
      __CF_USER_TEXT_ENCODING: '0x1F5:0x0:0x0',
      MallocNanoZone: '0',
      COMMAND_MODE: 'unix2003',
      USER: '<usuario>',
      LOGNAME: '<usuario>',
      HOME: '/Users/<usuario>',
      SHELL: '/bin/zsh',
    };

    expect(buildAutostartEnv(liveLoginPhotograph)).toEqual({
      ELECTRON_RUN_AS_NODE: '1',
      PATH: '/usr/bin:/bin',
    });
  });

  it('an empty candidate env → an empty result, never a guessed value', () => {
    expect(buildAutostartEnv({})).toEqual({});
  });

  // `NodeJS.ProcessEnv`'s own index signature allows `string | undefined` — a caller handing in
  // `daemonLaunchTarget.env` directly (V2-T23's own fix in `packages/app/src/composition/
  // index.ts#enableAppAutostart`) needs this handled without a separate filter pass first.
  it('an allowlisted key present but undefined is treated as absent, never as the literal text "undefined"', () => {
    expect(buildAutostartEnv({ ELECTRON_RUN_AS_NODE: undefined, PATH: '/usr/bin' })).toEqual({
      PATH: '/usr/bin',
    });
  });

  it('the allowlist itself is exactly ELECTRON_RUN_AS_NODE and PATH — nothing more, nothing less', () => {
    expect(AUTOSTART_ENV_VAR_ALLOWLIST).toEqual(['ELECTRON_RUN_AS_NODE', 'PATH']);
  });
});

describe('AUTOSTART_OUTPUT_LOG_FILE_NAME', () => {
  it('is a bare file name, not a path — each adapter joins it onto its own injected seeyaHome', () => {
    expect(AUTOSTART_OUTPUT_LOG_FILE_NAME).toBe('autostart.log');
  });
});
