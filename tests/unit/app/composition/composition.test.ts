import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildAppContext, resolveAppHome } from '../../../../packages/app/src/composition/index.js';

describe('resolveAppHome', () => {
  it('mirrors packages/cli/src/composition.ts#resolveCliHome: .claude and .seeya under the given home', () => {
    const home = resolveAppHome(path.join('C:', 'Users', 'someone'));

    expect(home.claudeHome).toBe(path.join('C:', 'Users', 'someone', '.claude'));
    expect(home.seeyaHome).toBe(path.join('C:', 'Users', 'someone', '.seeya'));
  });
});

describe('buildAppContext', () => {
  it('builds every field without touching the real filesystem (no config read, unlike buildCliContext)', () => {
    const context = buildAppContext(path.join('C:', 'Users', 'someone'));

    expect(context.homeDir).toBe(path.join('C:', 'Users', 'someone'));
    expect(context.home.seeyaHome).toBe(path.join('C:', 'Users', 'someone', '.seeya'));
    expect(typeof context.clock.now).toBe('function');
    expect(typeof context.defaultShell.command).toBe('string');
  });

  it('tabEnv is buildResumptionEnv(process.env) — D-017 session variables stripped', () => {
    const originalValue = process.env.CLAUDE_CODE_CHILD_SESSION;
    process.env.CLAUDE_CODE_CHILD_SESSION = 'contaminated';
    try {
      const context = buildAppContext(path.join('C:', 'Users', 'someone'));
      expect(context.tabEnv.CLAUDE_CODE_CHILD_SESSION).toBeUndefined();
    } finally {
      if (originalValue === undefined) {
        delete process.env.CLAUDE_CODE_CHILD_SESSION;
      } else {
        process.env.CLAUDE_CODE_CHILD_SESSION = originalValue;
      }
    }
  });

  it('buildPtyManager wires the callbacks it is given (no real pty spawned by this alone)', () => {
    const context = buildAppContext(path.join('C:', 'Users', 'someone'));
    const onData = vi.fn();
    const onExit = vi.fn();

    const manager = context.buildPtyManager({ onData, onExit });

    expect(manager.hasTab('anything')).toBe(false);
  });
});
