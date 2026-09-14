import { describe, expect, it, vi } from 'vitest';
import { PtyManager, UnknownTabError } from '../../../../packages/app/src/pty/pty-manager.js';
import type {
  PtyHandle,
  PtySpawnOptions,
  PtySpawner,
} from '../../../../packages/app/src/pty/pty-port.js';

/** A named double implementing `PtySpawner` (AGENTS.md § "Testes": "duplo de I/O é classe/objeto
 * nomeado implementando a porta") — never a real `node-pty` process. Records every call so tests
 * can assert on what `PtyManager` asked it to do, and lets a test fire `onData`/`onExit`
 * synchronously, as if the fake pty produced output or exited. */
class FakePtySpawner implements PtySpawner {
  readonly spawnedOptions: PtySpawnOptions[] = [];
  readonly handles: FakePtyHandle[] = [];
  private nextPid = 1000;

  spawn(options: PtySpawnOptions): PtyHandle {
    this.spawnedOptions.push(options);
    const handle = new FakePtyHandle(this.nextPid);
    this.nextPid += 1;
    this.handles.push(handle);
    return handle;
  }
}

class FakePtyHandle implements PtyHandle {
  readonly pid: number;
  readonly written: string[] = [];
  readonly resizes: Array<{ cols: number; rows: number }> = [];
  killed = false;
  private dataListener: ((data: string) => void) | null = null;
  private exitListener: ((event: { exitCode: number }) => void) | null = null;

  constructor(pid: number) {
    this.pid = pid;
  }

  write(data: string): void {
    this.written.push(data);
  }

  resize(cols: number, rows: number): void {
    this.resizes.push({ cols, rows });
  }

  kill(): void {
    this.killed = true;
  }

  onData(listener: (data: string) => void): void {
    this.dataListener = listener;
  }

  onExit(listener: (event: { exitCode: number }) => void): void {
    this.exitListener = listener;
  }

  /** Test-only: simulates the fake pty producing output. */
  emitData(data: string): void {
    this.dataListener?.(data);
  }

  /** Test-only: simulates the fake pty's process ending. */
  emitExit(exitCode: number): void {
    this.exitListener?.({ exitCode });
  }
}

const OPTIONS: PtySpawnOptions = {
  command: 'claude',
  args: [],
  cwd: '/tmp',
  env: {},
  cols: 80,
  rows: 24,
};

describe('PtyManager', () => {
  it('create spawns through the port and returns the pid', () => {
    const spawner = new FakePtySpawner();
    const manager = new PtyManager(spawner, { onData: vi.fn(), onExit: vi.fn() });

    const pid = manager.create('tab-1', OPTIONS);

    expect(pid).toBe(1000);
    expect(spawner.spawnedOptions).toEqual([OPTIONS]);
    expect(manager.hasTab('tab-1')).toBe(true);
  });

  it('forwards onData to the callback, tagged with the tab id', () => {
    const spawner = new FakePtySpawner();
    const onData = vi.fn();
    const manager = new PtyManager(spawner, { onData, onExit: vi.fn() });
    manager.create('tab-1', OPTIONS);

    spawner.handles[0]!.emitData('hello\r\n');

    expect(onData).toHaveBeenCalledWith('tab-1', 'hello\r\n');
  });

  it('forwards onExit to the callback and forgets the tab (write/resize/closeTab then throw)', () => {
    const spawner = new FakePtySpawner();
    const onExit = vi.fn();
    const manager = new PtyManager(spawner, { onData: vi.fn(), onExit });
    manager.create('tab-1', OPTIONS);

    spawner.handles[0]!.emitExit(0);

    expect(onExit).toHaveBeenCalledWith('tab-1', 0);
    expect(manager.hasTab('tab-1')).toBe(false);
    expect(() => manager.write('tab-1', 'x')).toThrow(UnknownTabError);
  });

  it('write/resize/closeTab route to the right handle by tab id', () => {
    const spawner = new FakePtySpawner();
    const manager = new PtyManager(spawner, { onData: vi.fn(), onExit: vi.fn() });
    manager.create('tab-1', OPTIONS);
    manager.create('tab-2', OPTIONS);

    manager.write('tab-2', 'say ok');
    manager.resize('tab-1', 120, 40);
    manager.closeTab('tab-2');

    expect(spawner.handles[0]!.written).toEqual([]);
    expect(spawner.handles[1]!.written).toEqual(['say ok']);
    expect(spawner.handles[0]!.resizes).toEqual([{ cols: 120, rows: 40 }]);
    expect(spawner.handles[1]!.killed).toBe(true);
  });

  it('write/resize/closeTab throw UnknownTabError for an id never created, with the id in the message', () => {
    const spawner = new FakePtySpawner();
    const manager = new PtyManager(spawner, { onData: vi.fn(), onExit: vi.fn() });

    expect(() => manager.write('ghost', 'x')).toThrow(/ghost/);
    expect(() => manager.resize('ghost', 1, 1)).toThrow(UnknownTabError);
    expect(() => manager.closeTab('ghost')).toThrow(UnknownTabError);
  });

  it('closeTab does not itself call onExit — the pty firing its own exit event is the only path (no double-report)', () => {
    const spawner = new FakePtySpawner();
    const onExit = vi.fn();
    const manager = new PtyManager(spawner, { onData: vi.fn(), onExit });
    manager.create('tab-1', OPTIONS);

    manager.closeTab('tab-1');

    expect(onExit).not.toHaveBeenCalled();
    // The tab is still registered until the pty's own onExit fires (this fake doesn't fire kill
    // automatically — a real pty always eventually does).
    expect(manager.hasTab('tab-1')).toBe(true);
  });
});
