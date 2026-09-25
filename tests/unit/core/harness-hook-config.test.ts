/**
 * `core/harness-hook-config.ts` (V2-T34 item 2, PO review). Pure text generation — the real
 * end-to-end proof (Claude Code actually running the generated command and blocking a
 * `--no-verify`) is in `docs/QUESTOES.md`/the task's own implementation notes (a disposable
 * session, measured directly — see that module's own docstring for the exact method).
 */
import { describe, expect, it } from 'vitest';
import {
  HARNESS_SETTINGS_RELATIVE_PATH,
  buildHarnessSettingsJson,
  decideBashCommandGuard,
} from '@seeya-ai/engine/core/harness-hook-config.js';

describe('buildHarnessSettingsJson', () => {
  it('registers a PreToolUse hook matched on the exact "Bash" tool name', () => {
    const settings: unknown = JSON.parse(
      buildHarnessSettingsJson('/usr/bin/node', '/opt/seeya/dist/index.js'),
    );
    expect(settings).toMatchObject({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command' }],
          },
        ],
      },
    });
  });

  it('calls back into "seeya project verify-bash-command" by absolute path, never PATH', () => {
    const settings = JSON.parse(
      buildHarnessSettingsJson('/usr/bin/node', '/opt/seeya/dist/index.js'),
    ) as { hooks: { PreToolUse: { hooks: { command: string }[] }[] } };
    const command = settings.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
    expect(command).toContain('"/usr/bin/node"');
    expect(command).toContain('"/opt/seeya/dist/index.js"');
    expect(command).toContain('project verify-bash-command');
  });

  it('checks both paths exist before calling them, with a clear message and exit 2 when missing', () => {
    const settings = JSON.parse(
      buildHarnessSettingsJson('/usr/bin/node', '/opt/seeya/dist/index.js'),
    ) as { hooks: { PreToolUse: { hooks: { command: string }[] }[] } };
    const command = settings.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
    expect(command).toContain('if [ -f "/usr/bin/node" ] && [ -f "/opt/seeya/dist/index.js" ]');
    expect(command).toContain('seeya project open <id>');
    expect(command).toContain('exit 2');
  });

  it('prefixes extra env assignments before the call, for a caller that needs them (the app, or the CLI under Electron)', () => {
    const settings = JSON.parse(
      buildHarnessSettingsJson('/path/to/electron', '/opt/seeya/dist/index.js', {
        ELECTRON_RUN_AS_NODE: '1',
      }),
    ) as { hooks: { PreToolUse: { hooks: { command: string }[] }[] } };
    const command = settings.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
    expect(command).toContain('ELECTRON_RUN_AS_NODE=1 "/path/to/electron"');
  });

  it('checks the .asar file itself, not the unpacked inner path, when cliEntryPath is packaged (production defect, PO review 2026-09-25)', () => {
    const cliEntryPath = '/opt/seeya/resources/app.asar/node_modules/@seeya-ai/cli/dist/index.js';
    const settings = JSON.parse(buildHarnessSettingsJson('/usr/bin/node', cliEntryPath)) as {
      hooks: { PreToolUse: { hooks: { command: string }[] }[] };
    };
    const command = settings.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
    expect(command).toContain(
      'if [ -f "/usr/bin/node" ] && [ -f "/opt/seeya/resources/app.asar" ]',
    );
    // The actual invocation and the missing-verifier message still name the REAL inner path —
    // only the existence check is truncated at the .asar boundary.
    expect(command).toContain(`"/usr/bin/node" "${cliEntryPath}" project verify-bash-command`);
    expect(command).toContain(cliEntryPath);
  });

  it('is valid, parseable JSON with a trailing newline', () => {
    const text = buildHarnessSettingsJson('/usr/bin/node', '/opt/seeya/dist/index.js');
    expect(text.endsWith('\n')).toBe(true);
    expect(() => {
      JSON.parse(text);
    }).not.toThrow();
  });
});

describe('decideBashCommandGuard', () => {
  it('allows an ordinary command', () => {
    expect(decideBashCommandGuard('git commit -m "normal work"')).toEqual({ kind: 'allow' });
  });

  it('blocks a command that bypasses the git hooks with --no-verify', () => {
    const decision = decideBashCommandGuard('git commit --no-verify -m "skip the hook"');
    expect(decision.kind).toBe('block');
    expect(decision.kind === 'block' && decision.reason).toContain('git hooks');
  });

  it('blocks a command that changes where git looks for hooks', () => {
    const decision = decideBashCommandGuard('git config core.hooksPath /tmp/evil-hooks');
    expect(decision.kind).toBe('block');
  });
});

describe('HARNESS_SETTINGS_RELATIVE_PATH', () => {
  it('lives under .claude/, never ~/.claude (D-030)', () => {
    expect(HARNESS_SETTINGS_RELATIVE_PATH.startsWith('.claude/')).toBe(true);
  });
});
