// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { TabStripItem } from '../../../../../../packages/app/src/renderer/features/tabs/TabStripItem/index.js';
import styles from '../../../../../../packages/app/src/renderer/features/tabs/TabStripItem/TabStripItem.module.css';
import type { TabStripEntry } from '../../../../../../packages/app/src/state/tab-strip.js';
import { classesOf } from '../../components/_dom.js';

afterEach(cleanup);

function entry(overrides: Partial<TabStripEntry> = {}): TabStripEntry {
  return {
    id: 'tab-1',
    label: 'claude',
    exitedText: null,
    icon: 'terminal',
    active: false,
    exited: false,
    ...overrides,
  };
}

describe('TabStripItem (V2-T64)', () => {
  it('renders the label and calls onSelect with the entry id when clicked', () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <TabStripItem entry={entry()} onSelect={onSelect} onClose={() => {}} />,
    );
    fireEvent.click(getByText('claude'));
    expect(onSelect).toHaveBeenCalledWith('tab-1');
  });

  it('calls onClose with the entry id when the close button is clicked', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <TabStripItem entry={entry()} onSelect={() => {}} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Close claude' }));
    expect(onClose).toHaveBeenCalledWith('tab-1');
  });

  it('marks the active entry with aria-selected and its own class', () => {
    const { getByRole, container } = render(
      <TabStripItem entry={entry({ active: true })} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(getByRole('tab', { name: 'claude' }).getAttribute('aria-selected')).toBe('true');
    expect(classesOf(container.firstElementChild)).toContain(styles.active);
  });

  it('applies the exited class for an exited entry, without hiding the label text', () => {
    const { getByText, container } = render(
      <TabStripItem
        entry={entry({ label: 'shell', exitedText: 'exited (1)', exited: true })}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByText('shell')).not.toBeNull();
    expect(classesOf(container.firstElementChild)).toContain(styles.exited);
  });

  it('renders the exited suffix, separately from the label, in its own colour class', () => {
    const { getByText, container } = render(
      <TabStripItem
        entry={entry({ label: 'shell', exitedText: 'exited (1)', exited: true })}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const suffix = getByText((text) => text.includes('exited (1)'));
    expect(suffix.textContent).toBe(' · exited (1)');
    expect(classesOf(suffix)).toContain(styles.exitedText);
    expect(classesOf(container.firstElementChild)).toContain(styles.exited);
  });

  it('renders no exited suffix at all when the entry is still running', () => {
    const { container } = render(
      <TabStripItem entry={entry()} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(container.querySelector(`.${styles.exitedText}`)).toBeNull();
  });
});
