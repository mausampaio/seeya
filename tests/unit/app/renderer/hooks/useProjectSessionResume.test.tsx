// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../_fake-seeya-api.js';
import { useProjectSessionResume } from '../../../../../packages/app/src/renderer/hooks/useProjectSessionResume.js';
import type { ResumeTabOpenedEvent } from '../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

describe('useProjectSessionResume (V2-T77)', () => {
  it('calls the project resume channel with the project and session, never the simple resume', async () => {
    const resumeProjectSession = vi.fn(() =>
      Promise.resolve({ outcomeText: 'Project "p" closed.', resumed: true }),
    );
    window.seeya = createFakeSeeyaApi({ resumeProjectSession });
    const { result } = renderHook(() => useProjectSessionResume());
    void act(() => result.current.resume('auth-hardening', SESSION_ID));
    expect(resumeProjectSession).toHaveBeenCalledWith({
      projectId: 'auth-hardening',
      sessionId: SESSION_ID,
    });
    await waitFor(() => expect(result.current.isPending(SESSION_ID)).toBe(false));
  });

  it('is pending until the call settles, then keeps the outcome text as a result', async () => {
    let settle: ((value: { outcomeText: string; resumed: boolean }) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      resumeProjectSession: () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    });
    const { result } = renderHook(() => useProjectSessionResume());
    void act(() => result.current.resume('p', SESSION_ID));
    await waitFor(() => expect(result.current.isPending(SESSION_ID)).toBe(true));
    expect(result.current.result).toBeNull();
    settle?.({ outcomeText: 'Session "x" is running right now.', resumed: false });
    await waitFor(() => expect(result.current.isPending(SESSION_ID)).toBe(false));
    expect(result.current.result).toEqual({
      resumed: false,
      text: 'Session "x" is running right now.',
    });
  });

  it('a tab opening for the project clears pending before the call ever settles', async () => {
    const listeners: ((event: ResumeTabOpenedEvent) => void)[] = [];
    window.seeya = createFakeSeeyaApi({
      resumeProjectSession: () => new Promise(() => {}),
      onResumeTabOpened: vi.fn((listener: (event: ResumeTabOpenedEvent) => void) => {
        listeners.push(listener);
      }),
    });
    const { result } = renderHook(() => useProjectSessionResume());
    void act(() => result.current.resume('auth-hardening', SESSION_ID));
    await waitFor(() => expect(result.current.isPending(SESSION_ID)).toBe(true));
    void act(() =>
      listeners.forEach((listener) =>
        listener({ id: 't', label: 'auth-hardening', cwd: '/x', pid: 1, kind: 'project' }),
      ),
    );
    await waitFor(() => expect(result.current.isPending(SESSION_ID)).toBe(false));
  });

  it('a rejected call is reported, never swallowed', async () => {
    window.seeya = createFakeSeeyaApi({
      resumeProjectSession: () => Promise.reject(new Error('boom')),
    });
    const { result } = renderHook(() => useProjectSessionResume());
    void act(() => result.current.resume('p', SESSION_ID));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result).toEqual({
      resumed: false,
      text: 'Could not resume the session: boom',
    });
    expect(result.current.isPending(SESSION_ID)).toBe(false);
  });

  it('starting a new attempt clears the previous result, and dismiss clears it too', async () => {
    window.seeya = createFakeSeeyaApi({
      resumeProjectSession: vi
        .fn()
        .mockResolvedValueOnce({ outcomeText: 'first', resumed: false })
        .mockImplementationOnce(() => new Promise(() => {})),
    });
    const { result } = renderHook(() => useProjectSessionResume());
    void act(() => result.current.resume('p', SESSION_ID));
    await waitFor(() => expect(result.current.result?.text).toBe('first'));
    void act(() => result.current.dismissResult());
    expect(result.current.result).toBeNull();
    void act(() => result.current.resume('p', SESSION_ID));
    await waitFor(() => expect(result.current.isPending(SESSION_ID)).toBe(true));
    expect(result.current.result).toBeNull();
  });
});
