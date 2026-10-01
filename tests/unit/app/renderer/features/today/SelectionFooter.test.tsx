// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SelectionFooter } from '../../../../../../packages/app/src/renderer/features/today/SelectionFooter/index.js';

afterEach(cleanup);

describe('SelectionFooter (D-052, V2-T66)', () => {
  it('shows the selected count', () => {
    const { getByText } = render(
      <SelectionFooter
        selectedCount={2}
        resuming={false}
        disabledReason={undefined}
        onClearSelection={() => {}}
        onResumeSelected={() => {}}
      />,
    );
    expect(getByText('2 selected')).not.toBeNull();
  });

  it('Resume selected is enabled with a selection and no reason shown', () => {
    const { getByRole, queryByText } = render(
      <SelectionFooter
        selectedCount={1}
        resuming={false}
        disabledReason={undefined}
        onClearSelection={() => {}}
        onResumeSelected={() => {}}
      />,
    );
    expect((getByRole('button', { name: 'Resume selected' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(queryByText('Select at least one session to resume.')).toBeNull();
  });

  it('Resume selected is disabled with the given reason when nothing is selected', () => {
    const { getByRole, getByText } = render(
      <SelectionFooter
        selectedCount={0}
        resuming={false}
        disabledReason="Select at least one session to resume."
        onClearSelection={() => {}}
        onResumeSelected={() => {}}
      />,
    );
    expect((getByRole('button', { name: 'Resume selected' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(getByText('Select at least one session to resume.')).not.toBeNull();
  });

  it('Resume selected shows loading and hides the reason while resuming', () => {
    const { getByRole, queryByText } = render(
      <SelectionFooter
        selectedCount={0}
        resuming
        disabledReason="All of today's planned sessions are already open — nothing to resume."
        onClearSelection={() => {}}
        onResumeSelected={() => {}}
      />,
    );
    const button = getByRole('button', { name: 'Resume selected' }) as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(queryByText(/nothing to resume/)).toBeNull();
  });

  it('Clear selection is disabled with nothing selected', () => {
    const { getByRole } = render(
      <SelectionFooter
        selectedCount={0}
        resuming={false}
        disabledReason={undefined}
        onClearSelection={() => {}}
        onResumeSelected={() => {}}
      />,
    );
    expect((getByRole('button', { name: 'Clear selection' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('calls onClearSelection/onResumeSelected when clicked', () => {
    const onClearSelection = vi.fn();
    const onResumeSelected = vi.fn();
    const { getByRole } = render(
      <SelectionFooter
        selectedCount={1}
        resuming={false}
        disabledReason={undefined}
        onClearSelection={onClearSelection}
        onResumeSelected={onResumeSelected}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Clear selection' }));
    fireEvent.click(getByRole('button', { name: 'Resume selected' }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(onResumeSelected).toHaveBeenCalledTimes(1);
  });
});
