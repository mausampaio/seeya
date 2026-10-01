// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { NavItem } from '../../../../../packages/app/src/renderer/components/NavItem/index.js';
import styles from '../../../../../packages/app/src/renderer/components/NavItem/NavItem.module.css';
import { classesOf } from './_dom.js';

afterEach(cleanup);

describe('NavItem (D-052, V2-T75)', () => {
  it('renders an icon (hidden from assistive tech) and a label', () => {
    const { getByRole, container } = render(
      <NavItem icon={<span data-testid="icon" />} label="All projects" />,
    );
    expect(getByRole('button', { name: 'All projects' })).not.toBeNull();
    const iconWrapper = container.querySelector(`.${styles.icon}`);
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a trailing chip/count only when given one', () => {
    const withTrailing = render(<NavItem icon={<span />} label="Sessions" trailing="3 running" />);
    expect(withTrailing.getByText('3 running')).not.toBeNull();
    withTrailing.unmount();

    const withoutTrailing = render(<NavItem icon={<span />} label="Sessions" />);
    expect(withoutTrailing.container.querySelector(`.${styles.trailing}`)).toBeNull();
  });

  it('is inactive by default, active when asked', () => {
    const inactive = render(<NavItem icon={<span />} label="Sessions" />);
    const inactiveButton = inactive.getByRole('button');
    expect(inactiveButton.getAttribute('aria-current')).toBe('false');
    expect(classesOf(inactiveButton)).not.toContain(styles.active);
    inactive.unmount();

    const active = render(<NavItem icon={<span />} label="Sessions" active />);
    const activeButton = active.getByRole('button');
    expect(activeButton.getAttribute('aria-current')).toBe('true');
    expect(classesOf(activeButton)).toContain(styles.active);
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <NavItem icon={<span />} label="All projects" onClick={onClick} />,
    );
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards id and an external className', () => {
    const { getByRole } = render(
      <NavItem id="all-projects-link" icon={<span />} label="All projects" className="extra" />,
    );
    const button = getByRole('button');
    expect(button.id).toBe('all-projects-link');
    expect(classesOf(button)).toContain('extra');
  });
});
