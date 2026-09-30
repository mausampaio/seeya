// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { Sidebar } from '../../../../../../packages/app/src/renderer/features/sidebar/index.js';
import styles from '../../../../../../packages/app/src/renderer/features/sidebar/Sidebar.module.css';
import { classesOf } from '../../components/_dom.js';

beforeEach(() => {
  window.seeya = createFakeSeeyaApi();
});
afterEach(cleanup);

describe('Sidebar (D-052, V2-T75 — integration)', () => {
  it('renders the whole tree with the ids the rest of the window still relies on', () => {
    const { container } = render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);
    for (const id of [
      'sidebar',
      'today-card',
      'favorites-section',
      'new-project-button',
      'recent-section',
      'all-projects-link',
      'sessions-link',
      'ignored-projects-heading',
      'ignored-projects-list',
      'end-day-button',
      'daemon-control-button',
      'autostart-control-button',
      'autostart-control-result',
      'sidebar-resize-handle',
    ]) {
      expect(container.querySelector(`#${id}`), `expected #${id} to be rendered`).not.toBeNull();
    }
  });

  it('applies the collapsed class only when collapsed', () => {
    const expanded = render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);
    expect(classesOf(expanded.container.querySelector('#sidebar'))).not.toContain(styles.collapsed);
    expanded.unmount();

    const collapsed = render(<Sidebar collapsed onToggleCollapse={() => {}} />);
    expect(classesOf(collapsed.container.querySelector('#sidebar'))).toContain(styles.collapsed);
  });

  it('the header collapse button calls onToggleCollapse', () => {
    const onToggleCollapse = vi.fn();
    const { getByRole } = render(<Sidebar collapsed={false} onToggleCollapse={onToggleCollapse} />);
    fireEvent.click(getByRole('button', { name: 'Collapse sidebar' }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('never touches the DOM imperatively — no ids appear twice', () => {
    const { container } = render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);
    const seen = new Set<string>();
    for (const element of Array.from(container.querySelectorAll('[id]'))) {
      expect(seen.has(element.id), `duplicate id ${element.id}`).toBe(false);
      seen.add(element.id);
    }
  });
});
