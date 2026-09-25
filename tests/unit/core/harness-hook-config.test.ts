/**
 * `core/harness-hook-config.ts` (V2-T34 item 2). Pure text generation — the hook script's own
 * runtime behavior (reading stdin, blocking a matching command) is proven by executing it directly
 * with `node` in `tests/integration/workspace/harness-hook.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  HARNESS_HOOK_SCRIPT_RELATIVE_PATH,
  HARNESS_SETTINGS_RELATIVE_PATH,
  buildHarnessHookScript,
  buildHarnessSettingsJson,
} from '@seeya-ai/engine/core/harness-hook-config.js';

describe('buildHarnessSettingsJson', () => {
  it('registers a PreToolUse hook matched on the exact "Bash" tool name', () => {
    const settings: unknown = JSON.parse(buildHarnessSettingsJson());
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

  it("points the hook command at the script's own relative path via ${CLAUDE_PROJECT_DIR}", () => {
    const settings = JSON.parse(buildHarnessSettingsJson()) as {
      hooks: { PreToolUse: { hooks: { command: string }[] }[] };
    };
    const command = settings.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
    expect(command).toContain('${CLAUDE_PROJECT_DIR}');
    expect(command).toContain(HARNESS_HOOK_SCRIPT_RELATIVE_PATH);
  });

  it('is valid, parseable JSON with a trailing newline', () => {
    const text = buildHarnessSettingsJson();
    expect(text.endsWith('\n')).toBe(true);
    expect(() => {
      JSON.parse(text);
    }).not.toThrow();
  });
});

describe('buildHarnessHookScript', () => {
  it('is a Node script, not a shell script', () => {
    expect(buildHarnessHookScript().startsWith('#!/usr/bin/env node\n')).toBe(true);
  });

  it('references the two forbidden patterns the task specifies: --no-verify and hooksPath', () => {
    const script = buildHarnessHookScript();
    expect(script).toContain('--no-verify');
    expect(script).toContain('hooksPath');
  });
});

describe('relative path constants', () => {
  it('the settings and hook script live under .claude/, never ~/.claude (D-030)', () => {
    expect(HARNESS_SETTINGS_RELATIVE_PATH.startsWith('.claude/')).toBe(true);
    expect(HARNESS_HOOK_SCRIPT_RELATIVE_PATH.startsWith('.claude/')).toBe(true);
  });
});
