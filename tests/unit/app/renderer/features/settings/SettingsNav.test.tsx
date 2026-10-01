// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SettingsNav } from '../../../../../../packages/app/src/renderer/features/settings/SettingsNav/index.js';

afterEach(cleanup);

describe('SettingsNav (V2-T65, D-052, docs/INTERFACE.md § 8)', () => {
  it('renders one row per section, with readable labels', () => {
    const { getByText } = render(<SettingsNav active="general" onSelect={() => {}} />);
    for (const label of ['General', 'Schedule', 'Capture', 'Discovery', 'Terminal', 'Projects']) {
      expect(getByText(label)).not.toBeNull();
    }
  });

  it('marks the active section with aria-current', () => {
    const { getByText } = render(<SettingsNav active="schedule" onSelect={() => {}} />);
    expect(getByText('Schedule').closest('button')?.getAttribute('aria-current')).toBe('true');
    expect(getByText('General').closest('button')?.getAttribute('aria-current')).toBe('false');
  });

  it('calls onSelect with the clicked section', () => {
    const onSelect = vi.fn();
    const { getByText } = render(<SettingsNav active="general" onSelect={onSelect} />);
    fireEvent.click(getByText('Capture'));
    expect(onSelect).toHaveBeenCalledWith('capture');
  });
});
