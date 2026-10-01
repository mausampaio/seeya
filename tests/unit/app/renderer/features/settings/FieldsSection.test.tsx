// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { FieldsSection } from '../../../../../../packages/app/src/renderer/features/settings/FieldsSection/index.js';
import type { SettingsRow } from '../../../../../../packages/app/src/state/settings-panel.js';

afterEach(cleanup);

const ROWS: readonly SettingsRow[] = [
  {
    key: 'endOfDayTime',
    label: 'End-of-day time',
    description: 'd1',
    value: '19:30',
    origin: 'chosen',
    section: 'schedule',
  },
  {
    key: 'leadTimesInMinutes',
    label: 'Lead times',
    description: 'd2',
    value: '30, 15',
    origin: 'default',
    section: 'schedule',
  },
];

describe('FieldsSection (V2-T65)', () => {
  it('renders the title and one field per row, with its own error', () => {
    const { getByText, getByLabelText } = render(
      <FieldsSection
        title="Schedule"
        rows={ROWS}
        errorsByKey={{ leadTimesInMinutes: 'bad list' }}
        onFieldBlur={() => {}}
      />,
    );
    expect(getByText('Schedule')).not.toBeNull();
    expect(getByLabelText('End-of-day time')).not.toBeNull();
    expect(getByLabelText('Lead times')).not.toBeNull();
    expect(getByText('bad list')).not.toBeNull();
  });

  it('forwards onFieldBlur with the right key', () => {
    const onFieldBlur = vi.fn();
    const { getByLabelText } = render(
      <FieldsSection title="Schedule" rows={ROWS} errorsByKey={{}} onFieldBlur={onFieldBlur} />,
    );
    const input = getByLabelText('Lead times') as HTMLInputElement;
    input.value = '45';
    fireEvent.blur(input);
    expect(onFieldBlur).toHaveBeenCalledWith('leadTimesInMinutes', '45');
  });
});
