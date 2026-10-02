// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { SidebarFooter } from '../../../../../../packages/app/src/renderer/features/sidebar/SidebarFooter/index.js';
import styles from '../../../../../../packages/app/src/renderer/features/sidebar/SidebarFooter/SidebarFooter.module.css';
import { classesOf } from '../../components/_dom.js';
import type { DaemonControlAvailability } from '../../../../../../packages/app/src/state/daemon-control-panel.js';

afterEach(cleanup);

describe('SidebarFooter (D-052, V2-T75/V2-T69)', () => {
  it('renders the real end-day trigger button, and the daemon control button', () => {
    window.seeya = createFakeSeeyaApi();
    const { container, getByText } = render(<SidebarFooter />);
    expect(container.querySelector('#end-day-button')).not.toBeNull();
    expect(container.querySelector('#daemon-control-button')).not.toBeNull();
    expect(getByText('End day…')).not.toBeNull();
  });

  it('clicking End day… opens the dialog with the structured preview (V2-T69)', async () => {
    const endDayPreview = vi.fn(() =>
      Promise.resolve({
        willBeCaptured: [
          {
            sessionId: 's1',
            name: 'alpha',
            cwd: '~/alpha',
            state: 'ended' as const,
            mode: 'lean' as const,
          },
        ],
        notCaptured: [],
        costCeiling: {
          sessionsInScope: 1,
          budgetPerSessionUsd: 0.5,
          captureModel: 'sonnet',
          totalCeilingUsd: 0.5,
        },
      }),
    );
    window.seeya = createFakeSeeyaApi({ endDayPreview });
    const { getByRole, getByText } = render(<SidebarFooter />);

    // `fireEvent.click` flushes synchronously on its own (same "sync callback, immediate finish()"
    // shape `useEndDay.test.tsx`'s own top comment documents) — a SEPARATE async `act()` is what
    // lets the already-queued `endDayPreview().then()` callback actually run against the
    // now-current state.
    fireEvent.click(getByRole('button', { name: 'End day…' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(endDayPreview).toHaveBeenCalledTimes(1);
    expect(getByText('Will be captured · 1')).not.toBeNull();
    expect(getByText('alpha')).not.toBeNull();
  });

  it("never renders the autostart anchor any more (V2-T65 — moved to Settings' own General section)", () => {
    window.seeya = createFakeSeeyaApi();
    const { container } = render(<SidebarFooter />);
    expect(container.querySelector('#autostart-control-button')).toBeNull();
    expect(container.querySelector('#autostart-control-result')).toBeNull();
  });

  it('shows the daemon pill as "Daemon stopped" (body-sm, 14px/500) when stopped', () => {
    let push: ((availability: DaemonControlAvailability) => void) | undefined;
    window.seeya = createFakeSeeyaApi({
      onDaemonAvailabilityUpdate: (listener) => {
        push = listener;
        return () => {};
      },
    });
    const { getByText } = render(<SidebarFooter />);
    void act(() => push?.({ kind: 'start' }));
    const label = getByText('Daemon stopped');
    // The FACT ("Daemon stopped"), never the action — `docs/INTERFACE.md`'s own "pílula... texto
    // é o fato" — and the V2-T63 aceite's own defect (14px/weight 500, `body-sm`): the CSS module
    // class itself carries those two rules (`SidebarFooter.module.css`'s own `.daemonLabel`).
    expect(classesOf(label)).toContain(styles.daemonLabel);
  });

  it('shows "Daemon running" when running, and the stop icon button', () => {
    window.seeya = createFakeSeeyaApi({
      onDaemonAvailabilityUpdate: (listener) => {
        listener({ kind: 'stop', pid: 1 });
        return () => {};
      },
    });
    const { getByText, getByRole } = render(<SidebarFooter />);
    expect(getByText('Daemon running')).not.toBeNull();
    expect(getByRole('button', { name: 'Stop daemon' })).not.toBeNull();
  });

  it('shows "Daemon: cannot verify." and disables the button when unknown', () => {
    window.seeya = createFakeSeeyaApi();
    const { getByText, getByRole } = render(<SidebarFooter />);
    expect(getByText('Daemon: cannot verify.')).not.toBeNull();
    expect((getByRole('button', { name: 'Start daemon' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('clicking the daemon button calls daemonControl with the right action', () => {
    const daemonControl = vi.fn(() =>
      Promise.resolve({ resultText: '', availability: { kind: 'stop' as const, pid: 1 } }),
    );
    window.seeya = createFakeSeeyaApi({
      onDaemonAvailabilityUpdate: (listener) => {
        listener({ kind: 'start' });
        return () => {};
      },
      daemonControl,
    });
    const { getByRole } = render(<SidebarFooter />);
    fireEvent.click(getByRole('button', { name: 'Start daemon' }));
    expect(daemonControl).toHaveBeenCalledWith({ action: 'start' });
  });

  it('shows the schedule primary/secondary row with the clock icon', () => {
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        listener({
          primary: 'End of day',
          secondary: 'in 2 h',
          canSnooze: false,
          canSkip: false,
          undoSnooze: { kind: 'hidden' },
        });
        return () => {};
      },
    });
    const { getByText } = render(<SidebarFooter />);
    expect(getByText('End of day')).not.toBeNull();
    expect(getByText('in 2 h')).not.toBeNull();
  });

  it('renders the Snooze trigger and Skip button only when the schedule allows them', () => {
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        listener({
          primary: 'End of day',
          secondary: 'in 2 h',
          canSnooze: true,
          canSkip: true,
          undoSnooze: { kind: 'hidden' },
        });
        return () => {};
      },
    });
    const { getByRole, queryByRole } = render(<SidebarFooter />);
    expect(getByRole('button', { name: /Snooze/ })).not.toBeNull();
    expect(getByRole('button', { name: 'Skip today' })).not.toBeNull();

    cleanup();
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        listener({
          primary: 'End of day',
          secondary: 'skipped today',
          canSnooze: false,
          canSkip: false,
          undoSnooze: { kind: 'hidden' },
        });
        return () => {};
      },
    });
    const { queryByRole: queryDisabled } = render(<SidebarFooter />);
    expect(queryDisabled('button', { name: /Snooze/ })).toBeNull();
    expect(queryByRole('button', { name: 'Skip today' })).toBeNull();
  });

  it('choosing a snooze option from the menu calls onSnooze with that many minutes', () => {
    const snoozeToday = vi.fn(() =>
      Promise.resolve({
        primary: '',
        secondary: '',
        canSnooze: true,
        canSkip: true,
        undoSnooze: { kind: 'hidden' },
      }),
    );
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        listener({
          primary: '',
          secondary: '',
          canSnooze: true,
          canSkip: true,
          undoSnooze: { kind: 'hidden' },
        });
        return () => {};
      },
      snoozeToday,
    });
    const { getByRole } = render(<SidebarFooter />);
    fireEvent.click(getByRole('button', { name: /Snooze/ }));
    fireEvent.click(getByRole('menuitem', { name: '+30m' }));
    expect(snoozeToday).toHaveBeenCalledWith({ minutes: 30 });
  });

  // V2-T50: "Undo snooze" inside the Snooze menu — three states (D-024), one rendered test each.
  describe('Undo snooze item (V2-T50)', () => {
    const lines = {
      primary: 'End of day 12:00',
      secondary: 'in 3 h',
      canSnooze: true,
      canSkip: true,
    };

    it('is absent when there is nothing to undo', () => {
      window.seeya = createFakeSeeyaApi({
        onScheduleUpdate: (listener) => {
          listener({ ...lines, undoSnooze: { kind: 'hidden' } });
          return () => {};
        },
      });
      const { getByRole, queryByRole } = render(<SidebarFooter />);
      fireEvent.click(getByRole('button', { name: /Snooze/ }));
      expect(queryByRole('menuitem', { name: /Undo snooze/ })).toBeNull();
      expect(getByRole('menuitem', { name: '+15m' })).not.toBeNull();
    });

    it('is present when available, and clicking it applies the returned strip at once', async () => {
      const undoSnoozeToday = vi.fn(() =>
        Promise.resolve({
          ...lines,
          primary: 'End of day 11:00',
          undoSnooze: { kind: 'hidden' as const },
        }),
      );
      window.seeya = createFakeSeeyaApi({
        onScheduleUpdate: (listener) => {
          listener({ ...lines, undoSnooze: { kind: 'available' } });
          return () => {};
        },
        undoSnoozeToday,
      });
      const { getByRole, getByText } = render(<SidebarFooter />);
      fireEvent.click(getByRole('button', { name: /Snooze/ }));
      fireEvent.click(getByRole('menuitem', { name: /Undo snooze/ }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(undoSnoozeToday).toHaveBeenCalledTimes(1);
      expect(getByText('End of day 11:00')).not.toBeNull();
    });

    it('is disabled with its reason when the configured time has passed, and does nothing', () => {
      const undoSnoozeToday = vi.fn(() => Promise.reject(new Error('must not be called')));
      window.seeya = createFakeSeeyaApi({
        onScheduleUpdate: (listener) => {
          listener({
            ...lines,
            undoSnooze: { kind: 'disabled', reason: '09:30 has already passed' },
          });
          return () => {};
        },
        undoSnoozeToday,
      });
      const { getByRole, getByText } = render(<SidebarFooter />);
      fireEvent.click(getByRole('button', { name: /Snooze/ }));
      const item = getByRole('menuitem', { name: /Undo snooze/ });
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(getByText('09:30 has already passed')).not.toBeNull();
      fireEvent.click(item);
      expect(undoSnoozeToday).not.toHaveBeenCalled();
    });
  });

  /**
   * Regression test (maintainer-found, V2-T65-estado-na-tela item 2): clicking Skip used to do
   * nothing visible at all — the button stayed exactly as it was until some unrelated re-render
   * (or the next ambient push) caught up. This test never pushes a `scheduleUpdate` event — if the
   * button still goes disabled/`aria-busy` the instant it's clicked, that is the fix (the
   * component-level `loading` prop, driven by `useSidebarFooter`'s own `scheduleActionPending`),
   * not a push this test deliberately withholds.
   */
  it('clicking Skip today immediately disables it and sets aria-busy, with no push involved', () => {
    const skipToday = vi.fn(() => new Promise<never>(() => {}));
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        listener({
          primary: 'End of day',
          secondary: 'in 2 h',
          canSnooze: false,
          canSkip: true,
          undoSnooze: { kind: 'hidden' },
        });
        return () => {};
      },
      skipToday,
    });
    const { getByRole } = render(<SidebarFooter />);
    const skipButton = getByRole('button', { name: 'Skip today' }) as HTMLButtonElement;
    expect(skipButton.disabled).toBe(false);

    fireEvent.click(skipButton);

    expect(skipButton.disabled).toBe(true);
    expect(skipButton.getAttribute('aria-busy')).toBe('true');
  });

  /**
   * Regression test (maintainer's own follow-up, item 2's own "qualquer outra ação demorada"):
   * before this fix the daemon `IconButton` was only ever disabled for `unknown` availability —
   * nothing stopped a second click from firing `daemonControl` again while the first command was
   * still running.
   */
  it('the daemon button disables itself and sets aria-busy for the DURATION of the command', async () => {
    let resolveDaemonControl:
      | ((value: { resultText: string; availability: DaemonControlAvailability }) => void)
      | undefined;
    const daemonControl = vi.fn(
      () =>
        new Promise<{ resultText: string; availability: DaemonControlAvailability }>((resolve) => {
          resolveDaemonControl = resolve;
        }),
    );
    window.seeya = createFakeSeeyaApi({
      onDaemonAvailabilityUpdate: (listener) => {
        listener({ kind: 'start' });
        return () => {};
      },
      daemonControl,
    });
    const { getByRole } = render(<SidebarFooter />);
    const button = getByRole('button', { name: 'Start daemon' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      resolveDaemonControl?.({
        resultText: 'Daemon started.',
        availability: { kind: 'stop', pid: 1 },
      });
      await Promise.resolve();
    });
    expect(button.getAttribute('aria-busy')).toBeNull();
  });
});
