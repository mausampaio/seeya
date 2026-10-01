// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { DEFAULT_CONFIG } from '@seeya-ai/engine/adapters/storage/config-schema.js';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { SettingsDialog } from '../../../../../../packages/app/src/renderer/features/settings/index.js';
import { buildSettingsRows } from '../../../../../../packages/app/src/state/settings-panel.js';
import type { SaveSettingResponse } from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

const ROWS = buildSettingsRows(DEFAULT_CONFIG);

function panelResponse() {
  return Promise.resolve({ rows: ROWS, projectPolicyLines: [] });
}

describe('SettingsDialog (V2-T65, D-052, docs/INTERFACE.md § 8)', () => {
  it('never opens empty: data is fetched at MOUNT, well before the dialog is ever opened', async () => {
    window.seeya = createFakeSeeyaApi({
      getSettingsPanel: vi.fn(panelResponse),
      getAutostartAvailability: vi.fn(() =>
        Promise.resolve({ kind: 'notApplicable' as const, ownerKind: 'cli' as const }),
      ),
      getAppVersion: vi.fn(() => Promise.resolve('0.1.0')),
    });
    // Mounted CLOSED — SettingsDialog lives in App.tsx for the life of the window and only ever
    // toggles `open`, see useSettings.ts's own docstring. The version/theme control are already
    // rendered in the DOM (Dialog.tsx never conditionally renders children on `open`, only
    // showModal()/close() on the native element) — nothing left to fetch by the time it opens.
    // `{ hidden: true }`: a real `<dialog>` without `open` is `display: none` per the UA
    // stylesheet (never shown, never `.showModal()`'d) — correctly invisible to a DEFAULT
    // `getByRole` query, same as it would be to a screen reader. This test is about the DATA
    // being ready underneath, not about the (deliberately hidden) closed state's own a11y tree.
    const { getByText, getByRole } = render(<SettingsDialog open={false} onClose={() => {}} />);
    await waitFor(() => expect(getByText('seeya 0.1.0')).not.toBeNull());
    expect(getByRole('radio', { name: 'System', hidden: true })).not.toBeNull();
  });

  it('switches section on nav click, and saves a field on blur', async () => {
    const saveSetting = vi.fn((): Promise<SaveSettingResponse> =>
      Promise.resolve({
        ok: true,
        rows: ROWS.map((row) =>
          row.key === 'endOfDayTime' ? { ...row, value: '09:15', origin: 'chosen' as const } : row,
        ),
        schedule: { primary: '', secondary: '', canSnooze: false, canSkip: false },
      }),
    );
    window.seeya = createFakeSeeyaApi({
      getSettingsPanel: vi.fn(panelResponse),
      saveSetting,
    });
    const { getByRole, getByText, getByLabelText } = render(
      <SettingsDialog open onClose={() => {}} />,
    );
    // Not `getByText('General')`: the section HEADING and the nav ITEM both read "General" while
    // General is the active (default) section — ambiguous on purpose, only once two elements with
    // the same text coexist. The theme control is unique to the General section's own body.
    await waitFor(() => expect(getByRole('radio', { name: 'System' })).not.toBeNull());

    fireEvent.click(getByText('Schedule'));
    await waitFor(() => expect(getByLabelText('End-of-day time')).not.toBeNull());

    const input = getByLabelText('End-of-day time') as HTMLInputElement;
    input.value = '09:15';
    fireEvent.blur(input);

    await waitFor(() =>
      expect(saveSetting).toHaveBeenCalledWith({ key: 'endOfDayTime', rawValue: '09:15' }),
    );
  });

  it('shows the refusal, naming the rejected value, on an invalid save — never written', async () => {
    const saveSetting = vi.fn((): Promise<SaveSettingResponse> =>
      Promise.resolve({ ok: false, error: 'Not saved — "abc" is not a valid "HH:MM" time.' }),
    );
    window.seeya = createFakeSeeyaApi({ getSettingsPanel: vi.fn(panelResponse), saveSetting });
    const { getByRole, getByText, getByLabelText } = render(
      <SettingsDialog open onClose={() => {}} />,
    );
    await waitFor(() => expect(getByRole('radio', { name: 'System' })).not.toBeNull());
    fireEvent.click(getByText('Schedule'));
    await waitFor(() => expect(getByLabelText('End-of-day time')).not.toBeNull());

    const input = getByLabelText('End-of-day time') as HTMLInputElement;
    input.value = 'abc';
    fireEvent.blur(input);

    await waitFor(() =>
      expect(getByText('Not saved — "abc" is not a valid "HH:MM" time.')).not.toBeNull(),
    );
  });

  it('shows the Projects section read-only, and the policy heading/line', async () => {
    window.seeya = createFakeSeeyaApi({
      getSettingsPanel: vi.fn(() =>
        Promise.resolve({
          rows: ROWS,
          projectPolicyLines: [{ cwd: '/repo', canTerminate: true, deepCapture: false }],
        }),
      ),
    });
    const { getByRole, getByText } = render(<SettingsDialog open onClose={() => {}} />);
    await waitFor(() => expect(getByRole('radio', { name: 'System' })).not.toBeNull());
    fireEvent.click(getByText('Projects'));
    await waitFor(() =>
      expect(getByText('/repo: canTerminate=true, deepCapture=false')).not.toBeNull(),
    );
  });

  it('clicking Done calls onClose', async () => {
    window.seeya = createFakeSeeyaApi({ getSettingsPanel: vi.fn(panelResponse) });
    const onClose = vi.fn();
    const { getByRole, getByText } = render(<SettingsDialog open onClose={onClose} />);
    await waitFor(() => expect(getByRole('radio', { name: 'System' })).not.toBeNull());
    fireEvent.click(getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Dark on the theme control saves theme via the same path as any other field', async () => {
    const saveSetting = vi.fn((): Promise<SaveSettingResponse> =>
      Promise.resolve({
        ok: true,
        rows: ROWS,
        schedule: { primary: '', secondary: '', canSnooze: false, canSkip: false },
      }),
    );
    window.seeya = createFakeSeeyaApi({ getSettingsPanel: vi.fn(panelResponse), saveSetting });
    const { getByRole } = render(<SettingsDialog open onClose={() => {}} />);
    await waitFor(() => expect(getByRole('radio', { name: 'System' })).not.toBeNull());
    fireEvent.click(getByRole('radio', { name: 'Dark' }));
    await waitFor(() =>
      expect(saveSetting).toHaveBeenCalledWith({ key: 'theme', rawValue: 'dark' }),
    );
  });
});
