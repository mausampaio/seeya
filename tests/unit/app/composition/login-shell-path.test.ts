import { describe, expect, it } from 'vitest';
import {
  LOGIN_SHELL_PATH_MARKER,
  buildLoginShellPathArgs,
  parseLoginShellPathOutput,
} from '../../../../packages/app/src/composition/login-shell-path.js';

describe('buildLoginShellPathArgs (V2-T8 item 3)', () => {
  it('asks for a login (-l), interactive (-i) shell running one command (-c)', () => {
    const args = buildLoginShellPathArgs();

    expect(args[0]).toBe('-lic');
    expect(args).toHaveLength(2);
  });

  it('the command printf-echoes the marker followed by $PATH', () => {
    const [, script] = buildLoginShellPathArgs();

    expect(script).toContain(LOGIN_SHELL_PATH_MARKER);
    expect(script).toContain('$PATH');
  });
});

describe('parseLoginShellPathOutput (V2-T8 item 3)', () => {
  it('extracts the PATH value from the marked line, ignoring profile noise around it', () => {
    const stdout = [
      'Welcome to your shell!',
      `${LOGIN_SHELL_PATH_MARKER}:/usr/local/bin:/usr/bin:/bin`,
      '',
    ].join('\n');

    expect(parseLoginShellPathOutput(stdout)).toBe('/usr/local/bin:/usr/bin:/bin');
  });

  it('returns undefined when no line starts with the marker (shell errored before printf ran)', () => {
    const stdout = 'bash: some-broken-profile-script: command not found\n';

    expect(parseLoginShellPathOutput(stdout)).toBeUndefined();
  });

  it('returns undefined for completely empty stdout', () => {
    expect(parseLoginShellPathOutput('')).toBeUndefined();
  });

  it('does not upgrade an explicitly empty PATH into "not found" (D-025)', () => {
    const stdout = `${LOGIN_SHELL_PATH_MARKER}:\n`;

    expect(parseLoginShellPathOutput(stdout)).toBe('');
  });

  it('keeps the LAST marked line, in case profile noise echoes the marker text earlier', () => {
    const stdout = [
      `${LOGIN_SHELL_PATH_MARKER}:/this/is/noise/not/the/real/path`,
      `${LOGIN_SHELL_PATH_MARKER}:/usr/local/bin:/usr/bin`,
    ].join('\n');

    expect(parseLoginShellPathOutput(stdout)).toBe('/usr/local/bin:/usr/bin');
  });

  it('strips a trailing carriage return defensively', () => {
    const stdout = `${LOGIN_SHELL_PATH_MARKER}:/usr/bin\r\n`;

    expect(parseLoginShellPathOutput(stdout)).toBe('/usr/bin');
  });

  it('accepts a custom marker (defaults to LOGIN_SHELL_PATH_MARKER)', () => {
    const stdout = 'custom-marker:/opt/bin\n';

    expect(parseLoginShellPathOutput(stdout, 'custom-marker')).toBe('/opt/bin');
  });
});
