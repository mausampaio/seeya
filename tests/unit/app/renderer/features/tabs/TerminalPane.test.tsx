// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { TerminalPane } from '../../../../../../packages/app/src/renderer/features/tabs/TerminalPane/index.js';
import type { TerminalHandle } from '../../../../../../packages/app/src/renderer/features/tabs/TerminalPane/index.js';
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
