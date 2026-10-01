// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { TerminalPane } from '../../../../../../packages/app/src/renderer/features/tabs/TerminalPane/index.js';
import type { TerminalHandle } from '../../../../../../packages/app/src/renderer/features/tabs/TerminalPane/index.js';
import styles from '../../../../../../packages/app/src/renderer/features/tabs/TerminalPane/TerminalPane.module.css';
import type {
  CreateTabRequest,
  CreateTabResponse,
  ResizeTabRequest,
} from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

describe('TerminalPane (V2-T64)', () => {
  let createTab: Mock<(request: CreateTabRequest) => Promise<CreateTabResponse>>;
  let resizeTab: Mock<(request: ResizeTabRequest) => void>;

  beforeEach(() => {
    createTab = vi.fn(() => Promise.resolve({ id: 'tab-1', pid: 4242 }));
    resizeTab = vi.fn();
    window.seeya = createFakeSeeyaApi({ createTab, writeTab: vi.fn(), resizeTab });
  });

  it('reflects the hidden prop on its own container', () => {
    const { container, rerender } = render(
      <TerminalPane
        id="tab-1"
        hidden
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    expect((container.firstElementChild as HTMLElement).hidden).toBe(true);
    rerender(
      <TerminalPane
        id="tab-1"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    expect((container.firstElementChild as HTMLElement).hidden).toBe(false);
  });

  /**
   * PO review (2026-10-01, docs/INTERFACE.md § 2's own terminal margin): `fitAddon` must measure
   * the INNER `.surface` element, never the padded outer `.pane` — `clientWidth`/`clientHeight`
   * include an element's own padding, so measuring `.pane` directly would make xterm fill the
   * margin instead of staying inset from it. This asserts the two-level structure stays in place,
   * not just that "a pane renders" — a regression here would silently remove the margin.
   */
  it('mounts xterm into an inner .surface element, nested inside the padded outer .pane', () => {
    const { container } = render(
      <TerminalPane
        id="tab-1"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    const pane = container.firstElementChild as HTMLElement;
    expect(pane.className).toContain(styles.pane);
    const surface = pane.firstElementChild as HTMLElement;
    expect(surface.className).toContain(styles.surface);
  });

  it('registers a handle on mount and unregisters it on unmount', async () => {
    const onRegister = vi.fn();
    const onUnregister = vi.fn();
    const { unmount } = render(
      <TerminalPane
        id="tab-1"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={onRegister}
        onUnregister={onUnregister}
        onSpawned={() => {}}
      />,
    );
    expect(onRegister).toHaveBeenCalledTimes(1);
    const [id, handle] = onRegister.mock.calls[0] as [string, TerminalHandle];
    expect(id).toBe('tab-1');
    expect(typeof handle.write).toBe('function');
    expect(typeof handle.fit).toBe('function');
    expect(typeof handle.focus).toBe('function');
    unmount();
    // Preact's own `useEffect` cleanup runs on a deferred tick, never synchronously inside
    // `unmount()` (confirmed against this exact preact/happy-dom combination) — `waitFor` is what
    // every other async assertion in this file already uses for the identical reason.
    await waitFor(() => expect(onUnregister).toHaveBeenCalledWith('tab-1'));
  });

  it('with a spawnRequest, calls createTab and reports the pid back via onSpawned', async () => {
    const onSpawned = vi.fn();
    render(
      <TerminalPane
        id="tab-1"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={{ command: 'claude', args: [], cwd: '/code/app' }}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={onSpawned}
      />,
    );
    await waitFor(() => expect(onSpawned).toHaveBeenCalledWith('tab-1', 4242));
    expect(createTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tab-1', command: 'claude', args: [], cwd: '/code/app' }),
    );
  });

  it('without a spawnRequest (a resume/project/adopt tab), never calls createTab, but corrects the pty size', () => {
    render(
      <TerminalPane
        id="resume-1"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    expect(createTab).not.toHaveBeenCalled();
    expect(resizeTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'resume-1' }));
  });

  // V2-T75-terminal-resize: maintainer diagnosis (2026-10-02) — a hidden terminal (another tab,
  // or a page tab, active) used to still get fit/resized by `useTabStrip.ts`'s own `fitAll()`,
  // sending the pty a near-zero size that corrupted PowerShell/bash's own line-wrapping state.
  it('mounted hidden (no spawnRequest): fit() at mount never calls resizeTab', () => {
    render(
      <TerminalPane
        id="hidden-1"
        hidden
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    expect(resizeTab).not.toHaveBeenCalled();
  });

  it('becoming visible: a fit() call after hidden -> visible resizes the pty', () => {
    // An object, not a bare `let`: TypeScript's control-flow narrowing doesn't see an assignment
    // made inside the `onRegister` closure during `render()`, so a bare `let handle = null`
    // stays narrowed to `null` at every later use regardless of its declared type — a `.current`
    // property access isn't narrowed the same way.
    const handleBox: { current: TerminalHandle | null } = { current: null };
    const { rerender } = render(
      <TerminalPane
        id="hidden-2"
        hidden
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={(_id, h) => {
          handleBox.current = h;
        }}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    expect(resizeTab).not.toHaveBeenCalled();
    rerender(
      <TerminalPane
        id="hidden-2"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    // `useTabStrip.ts`'s own `activeId` effect calls `handle.fit()` imperatively right after the
    // DOM commit — simulated here directly, since this test renders `TerminalPane` alone, without
    // that hook above it.
    handleBox.current?.fit();
    expect(resizeTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'hidden-2' }));
  });

  it('fitting twice with no size change in between sends only one resizeTab call', () => {
    const handleBox: { current: TerminalHandle | null } = { current: null };
    render(
      <TerminalPane
        id="tab-1"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={null}
        onRegister={(_id, h) => {
          handleBox.current = h;
        }}
        onUnregister={() => {}}
        onSpawned={() => {}}
      />,
    );
    resizeTab.mockClear();
    handleBox.current?.fit();
    handleBox.current?.fit();
    expect(resizeTab).toHaveBeenCalledTimes(0);
  });

  it('a failed spawn never calls onSpawned (the error is written into the terminal itself)', async () => {
    createTab = vi.fn(() => Promise.reject(new Error('could not find "claude"')));
    window.seeya = createFakeSeeyaApi({ createTab, writeTab: vi.fn(), resizeTab });
    const onSpawned = vi.fn();
    render(
      <TerminalPane
        id="tab-1"
        hidden={false}
        fontFamily="monospace"
        fontSize={14}
        spawnRequest={{ command: 'claude', args: [], cwd: '/code/app' }}
        onRegister={() => {}}
        onUnregister={() => {}}
        onSpawned={onSpawned}
      />,
    );
    await waitFor(() => expect(createTab).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSpawned).not.toHaveBeenCalled();
  });
});
