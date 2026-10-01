// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { SidebarFooter } from '../../../../../../packages/app/src/renderer/features/sidebar/SidebarFooter/index.js';
import styles from '../../../../../../packages/app/src/renderer/features/sidebar/SidebarFooter/SidebarFooter.module.css';
import { classesOf } from '../../components/_dom.js';
import type { DaemonControlAvailability } from '../../../../../../packages/app/src/state/daemon-control-panel.js';

afterEach(cleanup);

describe('SidebarFooter (D-052, V2-T75)', () => {
  it('renders the legacy-owned anchors with their exact ids', () => {
    window.seeya = createFakeSeeyaApi();
    const { container } = render(<SidebarFooter />);
    expect(container.querySelector('#end-day-button')).not.toBeNull();
    expect(container.querySelector('#autostart-control-button')).not.toBeNull();
    expect(container.querySelector('#autostart-control-result')).not.toBeNull();
    expect(container.querySelector('#daemon-control-button')).not.toBeNull();
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
        listener({ primary: 'End of day', secondary: 'in 2 h', canSnooze: false, canSkip: false });
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
        listener({ primary: 'End of day', secondary: 'in 2 h', canSnooze: true, canSkip: true });
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
      Promise.resolve({ primary: '', secondary: '', canSnooze: true, canSkip: true }),
    );
    window.seeya = createFakeSeeyaApi({
      onScheduleUpdate: (listener) => {
        listener({ primary: '', secondary: '', canSnooze: true, canSkip: true });
        return () => {};
      },
      snoozeToday,
    });
    const { getByRole } = render(<SidebarFooter />);
    fireEvent.click(getByRole('button', { name: /Snooze/ }));
    fireEvent.click(getByRole('menuitem', { name: '+30m' }));
    expect(snoozeToday).toHaveBeenCalledWith({ minutes: 30 });
  });
});
