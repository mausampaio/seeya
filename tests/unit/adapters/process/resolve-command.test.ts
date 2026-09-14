import { describe, expect, it } from 'vitest';
import {
  resolveCommand,
  type CommandResolutionFs,
} from '../../../../packages/engine/src/adapters/process/resolve-command.js';

/** A named double implementing `CommandResolutionFs` (AGENTS.md § "Testes": "duplo de I/O é
 * classe/objeto nomeado implementando a porta") — an in-memory set of paths that "exist", never a
 * real disk. */
class FakeFs implements CommandResolutionFs {
  constructor(private readonly existingPaths: ReadonlySet<string>) {}

  fileExists(path: string): Promise<boolean> {
    return Promise.resolve(this.existingPaths.has(path));
  }
}

describe('resolveCommand — POSIX (linux/darwin)', () => {
  it('finds the command in the first PATH entry that has it', async () => {
    const fs = new FakeFs(new Set(['/usr/local/bin/claude']));

    const result = await resolveCommand('claude', [], {
      platform: 'linux',
      pathEnv: '/usr/bin:/usr/local/bin',
      pathExtEnv: undefined,
      fs,
    });

    expect(result).toEqual({
      kind: 'resolved',
      resolved: { command: '/usr/local/bin/claude', args: [] },
    });
  });

  it('args pass through unchanged', async () => {
    const fs = new FakeFs(new Set(['/usr/bin/codex']));

    const result = await resolveCommand('codex', ['--resume', 'abc'], {
      platform: 'darwin',
      pathEnv: '/usr/bin',
      pathExtEnv: undefined,
      fs,
    });

    expect(result).toEqual({
      kind: 'resolved',
      resolved: { command: '/usr/bin/codex', args: ['--resume', 'abc'] },
    });
  });

  it('notFound lists every path actually searched, in PATH order — the value and the expected shape (AGENTS.md)', async () => {
    const fs = new FakeFs(new Set());

    const result = await resolveCommand('claude', [], {
      platform: 'linux',
      pathEnv: '/usr/bin:/usr/local/bin',
      pathExtEnv: undefined,
      fs,
    });

    expect(result).toEqual({
      kind: 'notFound',
      unresolved: { searched: ['/usr/bin/claude', '/usr/local/bin/claude'] },
    });
  });

  it('an unset PATH searches nothing and reports notFound with an empty list, never throws', async () => {
    const result = await resolveCommand('claude', [], {
      platform: 'linux',
      pathEnv: undefined,
      pathExtEnv: undefined,
      fs: new FakeFs(new Set()),
    });

    expect(result).toEqual({ kind: 'notFound', unresolved: { searched: [] } });
  });

  it('never appends an extension on POSIX, even when PATHEXT is set (Windows-only concept)', async () => {
    const fs = new FakeFs(new Set(['/usr/bin/claude.exe']));

    const result = await resolveCommand('claude', [], {
      platform: 'linux',
      pathEnv: '/usr/bin',
      pathExtEnv: '.EXE',
      fs,
    });

    // Only the bare name is ever searched on POSIX — "/usr/bin/claude.exe" existing is
    // irrelevant, and this must report notFound, not silently pick it up.
    expect(result).toEqual({ kind: 'notFound', unresolved: { searched: ['/usr/bin/claude'] } });
  });
});

describe('resolveCommand — Windows', () => {
  it('finds a plain .exe by walking PATH x PATHEXT, in order', async () => {
    const fs = new FakeFs(new Set(['C:\\tools\\claude\\claude.EXE']));

    const result = await resolveCommand('claude', [], {
      platform: 'win32',
      pathEnv: 'C:\\tools\\claude',
      pathExtEnv: '.COM;.EXE;.BAT;.CMD',
      fs,
    });

    expect(result).toEqual({
      kind: 'resolved',
      resolved: { command: 'C:\\tools\\claude\\claude.EXE', args: [] },
    });
  });

  it('defaults PATHEXT to .COM;.EXE;.BAT;.CMD when unset — the same default cmd.exe itself uses', async () => {
    const fs = new FakeFs(new Set(['C:\\tools\\claude.BAT']));

    const result = await resolveCommand('claude', [], {
      platform: 'win32',
      pathEnv: 'C:\\tools',
      pathExtEnv: undefined,
      fs,
    });

    expect(result.kind).toBe('resolved');
  });

  it("wraps a .cmd shim in cmd.exe /d /s /c (spike M's own npm-shim finding) — codex on Windows", async () => {
    const fs = new FakeFs(new Set(['C:\\Users\\dev\\AppData\\Roaming\\npm\\codex.CMD']));

    const result = await resolveCommand('codex', ['--resume', 'abc'], {
      platform: 'win32',
      pathEnv: 'C:\\Users\\dev\\AppData\\Roaming\\npm',
      pathExtEnv: '.COM;.EXE;.BAT;.CMD',
      fs,
    });

    expect(result).toEqual({
      kind: 'resolved',
      resolved: {
        command: 'cmd.exe',
        args: [
          '/d',
          '/s',
          '/c',
          'C:\\Users\\dev\\AppData\\Roaming\\npm\\codex.CMD',
          '--resume',
          'abc',
        ],
      },
    });
  });

  it('wraps a .bat the same way as .cmd', async () => {
    const fs = new FakeFs(new Set(['C:\\tools\\legacy.BAT']));

    const result = await resolveCommand('legacy', [], {
      platform: 'win32',
      pathEnv: 'C:\\tools',
      pathExtEnv: '.COM;.EXE;.BAT;.CMD',
      fs,
    });

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.resolved.command).toBe('cmd.exe');
    }
  });

  it('a command that already names its own extension is not doubled up (claude.exe, not claude.exe.exe)', async () => {
    const fs = new FakeFs(new Set(['C:\\tools\\claude.exe']));

    const result = await resolveCommand('claude.exe', [], {
      platform: 'win32',
      pathEnv: 'C:\\tools',
      pathExtEnv: '.COM;.EXE;.BAT;.CMD',
      fs,
    });

    expect(result).toEqual({
      kind: 'resolved',
      resolved: { command: 'C:\\tools\\claude.exe', args: [] },
    });
  });

  it('a command typed WITH its own .cmd extension still gets wrapped in cmd.exe /c', async () => {
    const fs = new FakeFs(new Set(['C:\\tools\\codex.cmd']));

    const result = await resolveCommand('codex.cmd', [], {
      platform: 'win32',
      pathEnv: 'C:\\tools',
      pathExtEnv: '.COM;.EXE;.BAT;.CMD',
      fs,
    });

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.resolved.command).toBe('cmd.exe');
    }
  });

  it('notFound lists every PATH x PATHEXT combination actually searched, in order', async () => {
    const fs = new FakeFs(new Set());

    const result = await resolveCommand('claude', [], {
      platform: 'win32',
      pathEnv: 'C:\\a;C:\\b',
      pathExtEnv: '.EXE;.CMD',
      fs,
    });

    expect(result).toEqual({
      kind: 'notFound',
      unresolved: {
        searched: [
          'C:\\a\\claude.EXE',
          'C:\\a\\claude.CMD',
          'C:\\b\\claude.EXE',
          'C:\\b\\claude.CMD',
        ],
      },
    });
  });

  it('a lowercase PATHEXT entry is normalized the same way an uppercase one is (case in the env var never matters)', async () => {
    const fs = new FakeFs(new Set(['C:\\tools\\claude.EXE']));

    const result = await resolveCommand('claude', [], {
      platform: 'win32',
      pathEnv: 'C:\\tools',
      pathExtEnv: '.exe', // lowercase in the env var — normalized to .EXE before searching
      fs,
    });

    expect(result.kind).toBe('resolved');
  });
});
