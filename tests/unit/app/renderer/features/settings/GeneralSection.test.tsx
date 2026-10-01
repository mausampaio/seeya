// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { GeneralSection } from '../../../../../../packages/app/src/renderer/features/settings/GeneralSection/index.js';
import type { AutostartControlState } from '../../../../../../packages/app/src/state/autostart-control-panel.js';
import type { SettingsRow } from '../../../../../../packages/app/src/state/settings-panel.js';

afterEach(cleanup);

const THEME_ROW: SettingsRow = {
  key: 'theme',
  label: 'Theme',
  description: '',
  value: 'system',
  origin: 'default',
  section: null,
};

const ENABLE_STATE: AutostartControlState = {
  kind: 'idle',
  availability: { kind: 'enable' },
};

describe('GeneralSection (V2-T65, docs/INTERFACE.md § 8)', () => {
  it('shows the theme control with the current value selected, and calls onThemeChange', () => {
    const onThemeChange = vi.fn();
    const { getByRole } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={onThemeChange}
        autostart={ENABLE_STATE}
        onAutostartToggle={() => {}}
        appVersion={null}
      />,
    );
    const dark = getByRole('radio', { name: 'Dark' });
    expect(dark.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(dark);
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('shows the installed version only once it has resolved', () => {
    const { container, queryByText, rerender } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={ENABLE_STATE}
        onAutostartToggle={() => {}}
        appVersion={null}
      />,
    );
    expect(container.querySelector('#settings-version')).toBeNull();
    rerender(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={ENABLE_STATE}
        onAutostartToggle={() => {}}
        appVersion="0.1.0"
      />,
    );
    expect(queryByText('seeya 0.1.0')).not.toBeNull();
  });

  it('enables the switch and calls onAutostartToggle when the app owns autostart', () => {
    const onToggle = vi.fn();
    const { getByLabelText } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={ENABLE_STATE}
        onAutostartToggle={onToggle}
        appVersion={null}
      />,
    );
    const input = getByLabelText('Start with the system') as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(input.checked).toBe(false);
    fireEvent.click(input);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('shows checked when the status is "disable" (currently enabled)', () => {
    const { getByLabelText } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={{ kind: 'idle', availability: { kind: 'disable' } }}
        onAutostartToggle={() => {}}
        appVersion={null}
      />,
    );
    expect((getByLabelText('Start with the system') as HTMLInputElement).checked).toBe(true);
  });

  it('disables the switch with the CLI reason when the app does not own autostart', () => {
    const { getByLabelText, getByText } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={{ kind: 'idle', availability: { kind: 'notApplicable', ownerKind: 'cli' } }}
        onAutostartToggle={() => {}}
        appVersion={null}
      />,
    );
    expect((getByLabelText('Start with the system') as HTMLInputElement).disabled).toBe(true);
    expect(getByText(/Managed by the CLI/)).not.toBeNull();
  });

  it('disables the switch with the unknown reason when ownership could not be determined (D-025)', () => {
    const { getByText } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={{ kind: 'idle', availability: { kind: 'notApplicable', ownerKind: 'unknown' } }}
        onAutostartToggle={() => {}}
        appVersion={null}
      />,
    );
    expect(getByText(/Could not determine/)).not.toBeNull();
  });

  /**
   * Regression test (maintainer's own follow-up, V2-T65-estado-na-tela item 2): the switch was
   * already correctly disabled while `autostart.kind === 'running'` (`autostartDisabled`'s own
   * logic predates this round) — what it DIDN'T have was any spinner/`aria-busy`, which is what
   * this test adds coverage for, now that `Switch` has a real `loading` prop to carry it.
   */
  it('shows the switch as loading (aria-busy, spinner) while a toggle is running', () => {
    const { container, getByLabelText } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={{ kind: 'running', availability: { kind: 'enable' } }}
        onAutostartToggle={() => {}}
        appVersion={null}
      />,
    );
    expect((getByLabelText('Start with the system') as HTMLInputElement).disabled).toBe(true);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('shows the result text after a toggle finishes', () => {
    const { getByText } = render(
      <GeneralSection
        themeRow={THEME_ROW}
        onThemeChange={() => {}}
        autostart={{
          kind: 'result',
          availability: { kind: 'disable' },
          resultText: 'Autostart enabled.',
        }}
        onAutostartToggle={() => {}}
        appVersion={null}
      />,
    );
    expect(getByText('Autostart enabled.')).not.toBeNull();
  });
});
