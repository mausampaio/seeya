// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SettingsField } from '../../../../../../packages/app/src/renderer/features/settings/SettingsField/index.js';
import type { SettingsRow } from '../../../../../../packages/app/src/state/settings-panel.js';

afterEach(cleanup);

const ROW: SettingsRow = {
  key: 'endOfDayTime',
  label: 'End-of-day time',
  description: 'Local time the day ends.',
  value: '19:30',
  origin: 'chosen',
  section: 'schedule',
};

describe('SettingsField (V2-T65, docs/INTERFACE.md § 8)', () => {
  it('renders the readable label, the raw key as a mono hint, and the description', () => {
    const { getByLabelText, getByText } = render(<SettingsField row={ROW} onBlur={() => {}} />);
    expect(getByLabelText('End-of-day time')).not.toBeNull();
    expect(getByText('endOfDayTime')).not.toBeNull();
    expect(getByText('Local time the day ends.')).not.toBeNull();
  });

  it('shows the "custom" tag for a chosen value, "default" for a default one', () => {
    const { getByText, rerender } = render(<SettingsField row={ROW} onBlur={() => {}} />);
    expect(getByText('custom')).not.toBeNull();
    rerender(<SettingsField row={{ ...ROW, origin: 'default' }} onBlur={() => {}} />);
    expect(getByText('default')).not.toBeNull();
  });

  it('calls onBlur with the key and the value straight off the blur event (docs/INTERFACE.md § 8: salvar ao sair do campo)', () => {
    const onBlur = vi.fn();
    const { getByLabelText } = render(<SettingsField row={ROW} onBlur={onBlur} />);
    const input = getByLabelText('End-of-day time') as HTMLInputElement;
    input.value = '09:15';
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledWith('endOfDayTime', '09:15');
  });

  it('shows the error AGENTS.md-style, naming the rejected value, when given', () => {
    const { getByText } = render(
      <SettingsField row={ROW} error='Not saved — invalid "HH:MM"' onBlur={() => {}} />,
    );
    expect(getByText('Not saved — invalid "HH:MM"')).not.toBeNull();
  });

  it('resyncs the draft when the row changes externally, unless this exact field is focused', () => {
    const { getByLabelText, rerender } = render(<SettingsField row={ROW} onBlur={() => {}} />);
    const input = getByLabelText('End-of-day time') as HTMLInputElement;

    // Not focused: a fresh row value (e.g. another save re-rendering every row) resyncs the draft.
    rerender(<SettingsField row={{ ...ROW, value: '08:00' }} onBlur={() => {}} />);
    expect(input.value).toBe('08:00');

    // Focused: an in-progress edit is never clobbered by an external row update.
    input.focus();
    input.value = 'still-typing';
    fireEvent.input(input);
    rerender(<SettingsField row={{ ...ROW, value: '07:00' }} onBlur={() => {}} />);
    expect(input.value).toBe('still-typing');
  });
});
