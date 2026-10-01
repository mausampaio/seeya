// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ProjectRow } from '../../../../../../packages/app/src/renderer/features/sidebar/ProjectRow/index.js';
import styles from '../../../../../../packages/app/src/renderer/features/sidebar/ProjectRow/ProjectRow.module.css';
import type { ProjectPanelSessionRow } from '../../../../../../packages/app/src/state/projects-panel.js';

afterEach(cleanup);

const SESSION: ProjectPanelSessionRow = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  displaySessionId: '1111',
  name: 'main session',
  cwd: '/repo',
  state: 'alive',
  stateLabel: 'running',
  lastActivity: null,
  matchedTabId: 'tab-1',
};

describe('ProjectRow (D-052, V2-T75, PO review 2026-10-01 — shared by Favorites and Recent)', () => {
  it('renders a plain folder row with no lock status and no sessions', () => {
    const { getByRole, queryByText } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="none"
        sessions={[]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    expect(getByRole('button', { name: 'Auth hardening' })).not.toBeNull();
    expect(queryByText('open here')).toBeNull();
    expect(queryByText('locked')).toBeNull();
  });

  it('shows "open here" and the indented sessions when the badge is openHere', () => {
    const { getByText } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="openHere"
        sessions={[SESSION]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    expect(getByText('open here')).not.toBeNull();
    expect(getByText(/main session/)).not.toBeNull();
    expect(getByText('1111')).not.toBeNull();
  });

  it('shows "locked" with no sessions when the badge is locked', () => {
    const { getByText, queryByText } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="locked"
        sessions={[]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    expect(getByText('locked')).not.toBeNull();
    expect(queryByText(/main session/)).toBeNull();
  });

  it('clicking the name opens the project', () => {
    const onOpenProject = vi.fn();
    const { getByRole } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="none"
        sessions={[]}
        leading={{ kind: 'folder' }}
        onOpenProject={onOpenProject}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Auth hardening' }));
    expect(onOpenProject).toHaveBeenCalledWith('auth-hardening');
  });

  // PO review (2026-10-01), `docs/INTERFACE.md` § 1's own "três estados visuais na linha de
  // projeto": open-tab (the `surface-subtle` card) and active-tab (the `primary-soft`/
  // `primary-text` highlight "por cima do cartão") are two DISTINCT states now — a row can be one
  // without the other, and the class names/rendered colour prove which.
  it('badge openHere alone applies the open-tab card class, not the active-tab one', () => {
    const { container } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="openHere"
        sessions={[SESSION]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain(styles.rowOpenHere);
    expect(row.className).not.toContain(styles.rowActiveTab);
  });

  it('activeTab applies the active-tab class ON TOP OF the open-tab card class', () => {
    const { container, getByText } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="openHere"
        sessions={[SESSION]}
        activeTab
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain(styles.rowOpenHere);
    expect(row.className).toContain(styles.rowActiveTab);
    // The name itself carries the class `.rowActiveTab .nameText` targets (ProjectRow.module.css's
    // own comment on why colour can't just be inherited from the row).
    expect(getByText('Auth hardening').className).toContain(styles.nameText);
  });

  it('activeTab is never applied without a badge prop implying an open tab (defensive default)', () => {
    const { container } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="none"
        sessions={[]}
        leading={{ kind: 'folder' }}
        onOpenProject={() => {}}
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).not.toContain(styles.rowActiveTab);
    expect(row.className).not.toContain(styles.rowOpenHere);
  });

  // PO review (2026-10-01): hover itself is a plain `:hover` CSS pseudo-class (same mechanism
  // `NavItem.module.css`'s own `.navItem:hover` already uses, deliberately reused rather than
  // JS-driven state) — this test environment (happy-dom) never actually applies `:hover` pseudo-
  // class matching for a synthetic pointer event (no real renderer/compositor tracks cursor
  // position the way a REAL browser engine does, confirmed: `fireEvent.mouseOver` here changes no
  // computed style), and an offscreen/headless screenshot can't reliably reproduce a real pointer
  // hover either — this is the documented proof instead, reading the actual CSS rule text rather
  // than a rendered pixel: the row-level hover rule exists and uses the SAME token NavItem does,
  // never a one-off colour invented for this component.
  it('the row has its own :hover rule, same token NavItem.module.css already uses', () => {
    const cssPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../../../packages/app/src/renderer/features/sidebar/ProjectRow/ProjectRow.module.css',
    );
    const css = readFileSync(cssPath, 'utf8');
    expect(css).toMatch(/\.row:hover\s*\{\s*background:\s*var\(--seeya-surface-hover\);/);
  });

  it('renders the star and calls onToggleFavorite when leading is favoriteStar', () => {
    const onToggleFavorite = vi.fn();
    const { getByRole } = render(
      <ProjectRow
        projectId="auth-hardening"
        name="Auth hardening"
        badge="none"
        sessions={[]}
        leading={{ kind: 'favoriteStar', onToggleFavorite }}
        onOpenProject={() => {}}
      />,
    );
    fireEvent.click(getByRole('button', { name: /Auth hardening/i, pressed: true }));
    expect(onToggleFavorite).toHaveBeenCalledWith('auth-hardening', false);
  });
});
