import { describe, expect, it } from 'vitest';
import { defaultShellCommand } from '../../../../packages/app/src/pty/default-shell.js';

describe('defaultShellCommand', () => {
  it('Windows: uses COMSPEC when set', () => {
    expect(defaultShellCommand('win32', { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' })).toEqual({
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: [],
    });
  });

  it('Windows: falls back to cmd.exe when COMSPEC is unset', () => {
    expect(defaultShellCommand('win32', {})).toEqual({ command: 'cmd.exe', args: [] });
  });

  it('POSIX (linux/darwin): uses SHELL when set', () => {
    expect(defaultShellCommand('linux', { SHELL: '/usr/bin/zsh' })).toEqual({
      command: '/usr/bin/zsh',
      args: [],
    });
    expect(defaultShellCommand('darwin', { SHELL: '/bin/zsh' })).toEqual({
      command: '/bin/zsh',
      args: [],
    });
  });

  it('POSIX: falls back to /bin/sh when SHELL is unset', () => {
    expect(defaultShellCommand('linux', {})).toEqual({ command: '/bin/sh', args: [] });
  });
});
