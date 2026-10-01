import { describe, expect, it } from 'vitest';
import {
  resolveApplicationMenuPolicy,
  type ApplicationMenuPolicy,
} from '../../../../packages/app/src/composition/menu-policy.js';

/** Flattens a `MenuSection.submenu` into its `role`s (or `'separator'`), so a test can assert the
 * exact shortcut-bearing items without depending on Electron's own `Menu`/`MenuItem` classes at
 * all — `composition/menu-policy.ts` never imports `electron` (D-052's own import boundary), and
 * `main/main.ts#toElectronMenuTemplate` is the only place that maps this shape onto the real
 * `MenuItemConstructorOptions[]` `Menu.buildFromTemplate` needs. */
function submenuRoles(
  policy: ApplicationMenuPolicy & { kind: 'minimalWithEdit' },
  index: number,
): string[] {
  const section = policy.template[index];
  if (section === undefined) {
    throw new Error(
      `expected template[${index}] to exist, template has ${policy.template.length} entries`,
    );
  }
  return section.submenu.map((item) => (item.kind === 'separator' ? 'separator' : item.role));
}

describe('resolveApplicationMenuPolicy (V2-T74)', () => {
  it('Windows gets no application menu at all', () => {
    expect(resolveApplicationMenuPolicy('win32', 'seeya')).toEqual({ kind: 'none' });
  });

  it('Linux gets no application menu at all', () => {
    expect(resolveApplicationMenuPolicy('linux', 'seeya')).toEqual({ kind: 'none' });
  });

  it('macOS gets a minimal menu, never "none" — Cmd+C/Cmd+V need a menu role to work at all', () => {
    const policy = resolveApplicationMenuPolicy('darwin', 'seeya');
    expect(policy.kind).toBe('minimalWithEdit');
  });

  it('macOS: the app menu is named after appName and offers About + Quit, nothing else', () => {
    const policy = resolveApplicationMenuPolicy('darwin', 'seeya') as ApplicationMenuPolicy & {
      kind: 'minimalWithEdit';
    };
    expect(policy.template[0]?.label).toBe('seeya');
    expect(submenuRoles(policy, 0)).toEqual(['about', 'separator', 'quit']);
  });

  it('macOS: the Edit menu carries exactly the roles copy/paste/cut/select-all/undo/redo need', () => {
    const policy = resolveApplicationMenuPolicy('darwin', 'seeya') as ApplicationMenuPolicy & {
      kind: 'minimalWithEdit';
    };
    expect(policy.template[1]?.label).toBe('Edit');
    expect(submenuRoles(policy, 1)).toEqual([
      'undo',
      'redo',
      'separator',
      'cut',
      'copy',
      'paste',
      'selectAll',
    ]);
  });

  it('macOS: never a File/View/Window/Help menu — the default template does not survive', () => {
    const policy = resolveApplicationMenuPolicy('darwin', 'seeya') as ApplicationMenuPolicy & {
      kind: 'minimalWithEdit';
    };
    const labels = policy.template.map((item) => item.label);
    expect(labels).toEqual(['seeya', 'Edit']);
  });

  it('macOS: a different appName is reflected in the app menu label, never hardcoded', () => {
    const policy = resolveApplicationMenuPolicy('darwin', 'seeya-dev') as ApplicationMenuPolicy & {
      kind: 'minimalWithEdit';
    };
    expect(policy.template[0]?.label).toBe('seeya-dev');
  });
});
