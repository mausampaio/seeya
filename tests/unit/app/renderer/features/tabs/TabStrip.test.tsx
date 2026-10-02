// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { TabStrip } from '../../../../../../packages/app/src/renderer/features/tabs/TabStrip.js';
import type {
  CreateTabRequest,
  CreateTabResponse,
} from '../../../../../../packages/app/src/ipc/channels.js';

afterEach(cleanup);

describe('TabStrip (V2-T64)', () => {
  let createTab: Mock<(request: CreateTabRequest) => Promise<CreateTabResponse>>;

  beforeEach(() => {
    createTab = vi.fn(() => Promise.resolve({ id: 'tab-1', pid: 4242 }));
    window.seeya = createFakeSeeyaApi({ createTab, writeTab: vi.fn(), resizeTab: vi.fn() });
  });

  it('renders the ids the rest of the window still relies on, plus the given leading content', () => {
    const { container, getByText } = render(<TabStrip leading={<span>toggle</span>} />);
    // `today-panel`/`projects-list` dropped from this list (V2-T66/V2-T67): `#page-today`/
    // `#page-projects` now hold `<Today/>`/`<Projects/>`, real components with their own CSS, not
    // the bare anchors their own legacy views used to fill by hand.
    for (const id of [
      'new-tab-button',
      'new-tab-popover',
      'settings-button',
      'terminal-host',
      'page-today',
      'page-projects',
      'page-sessions',
      'other-sessions-list',
    ]) {
      expect(container.querySelector(`#${id}`), `expected #${id} to be rendered`).not.toBeNull();
    }
    expect(getByText('toggle')).not.toBeNull();
  });

  it('the "+" button is disabled until the terminal font config resolves', async () => {
    const { getByRole } = render(<TabStrip />);
    const button = getByRole('button', { name: 'New tab' }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it('clicking "+" opens the New tab popover', async () => {
    const { getByRole, container } = render(<TabStrip />);
    await waitFor(() =>
      expect((getByRole('button', { name: 'New tab' }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(getByRole('button', { name: 'New tab' }));
    const popover = container.querySelector('#new-tab-popover') as HTMLDialogElement;
    expect(popover.open).toBe(true);
  });

  it('submitting the popover opens a new tab, shown in the strip and as the active pane', async () => {
    const { getByRole, container } = render(<TabStrip />);
    await waitFor(() =>
      expect((getByRole('button', { name: 'New tab' }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(getByRole('button', { name: 'New tab' }));
    fireEvent.submit(container.querySelector('#new-tab-form') as HTMLFormElement);
    await waitFor(() => expect(getByRole('tab').textContent).toContain('claude'));
    expect(createTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tab-1', command: 'claude' }),
    );
  });

  it('Settings is an icon button with an accessible name, never visible text', () => {
    const { getByRole } = render(<TabStrip />);
    const button = getByRole('button', { name: 'Settings' });
    expect(button.id).toBe('settings-button');
    expect(button.textContent?.trim()).toBe('');
  });
});
