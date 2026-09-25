/**
 * `core/workspace-hooks.ts` (V2-T34 item 1). Pure text — the real execution proof (the hook
 * actually refusing/allowing real `git commit`s in a disposable repository) lives in
 * `tests/integration/workspace/commit-msg-hook.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { buildCommitMsgHookScript } from '@seeya-ai/engine/core/workspace-hooks.js';

describe('buildCommitMsgHookScript', () => {
  it('is a POSIX shell script calling back into "project verify-commit" with the message file', () => {
    const script = buildCommitMsgHookScript('/usr/bin/node', '/opt/seeya/dist/index.js');
    expect(script.startsWith('#!/bin/sh\n')).toBe(true);
    expect(script).toContain(
      'exec "/usr/bin/node" "/opt/seeya/dist/index.js" project verify-commit "$1"',
    );
  });

  it('prefixes extra env assignments before exec, for a caller that needs them (the app)', () => {
    const script = buildCommitMsgHookScript('/path/to/electron', '/opt/seeya/dist/index.js', {
      ELECTRON_RUN_AS_NODE: '1',
    });
    expect(script).toContain('ELECTRON_RUN_AS_NODE=1 exec "/path/to/electron"');
  });

  it('never prepends anything when no extra env is given', () => {
    const script = buildCommitMsgHookScript('/usr/bin/node', '/opt/seeya/dist/index.js');
    expect(script).toContain('then exec "/usr/bin/node"');
  });

  it('checks both paths exist before calling them, with a clear message and exit 1 when missing (PO review)', () => {
    const script = buildCommitMsgHookScript('/usr/bin/node', '/opt/seeya/dist/index.js');
    expect(script).toContain('if [ -f "/usr/bin/node" ] && [ -f "/opt/seeya/dist/index.js" ]');
    expect(script).toContain('seeya project open <id>');
    expect(script).toContain('exit 1');
    // No unescaped double quote inside the echoed message itself — it would end the outer
    // double-quoted echo string early (this test is the regression proof: it failed before the
    // fix, when the message wrapped each path in its own literal double quotes).
    const echoLine = script.split('\n').find((line) => line.includes('echo "seeya:'));
    expect(echoLine).toBeDefined();
    const messageBody = echoLine?.slice(
      echoLine.indexOf('echo "') + 'echo "'.length,
      echoLine.lastIndexOf('" >&2'),
    );
    expect(messageBody).toBeDefined();
    expect(messageBody).not.toContain('"');
  });
});
