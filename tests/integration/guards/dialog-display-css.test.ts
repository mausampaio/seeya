import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_SRC_ROOT, PROJECT_ROOT } from './_support.js';

/**
 * Bug fix (maintainer-found, V2-T65-estado-na-tela): `SettingsDialog`'s own `<dialog>` stayed
 * visible — and clickable-through — after a real `Done` click, until some UNRELATED state change
 * forced Preact to re-render. Root cause: `SettingsDialog.module.css`'s own `.dialog` class set
 * `display: flex` unconditionally, and an AUTHOR rule always wins over the UA stylesheet's own
 * `dialog:not([open]) { display: none }` regardless of specificity (origin beats specificity in
 * the cascade) — so the dialog never actually disappeared when `.close()` dropped its `open`
 * attribute, it just sat there painted on top of a live window.
 *
 * This guard is the general form of that fix, not a one-off assertion on a single file: it finds
 * every `<dialog>`/`<Dialog>` element in `renderer/` whose class comes from a CSS module (`cx(styles,
 * '<name>')`), and fails if that module's BARE `.<name>` rule (unqualified by `[open]`) declares
 * `display` — the exact shape of the bug above. A rendered/jsdom-style test cannot catch this:
 * Vite's CSS-module transform returns an EMPTY string for the actual CSS text under Vitest's
 * SSR-like test execution (confirmed by instrumenting the import directly — `document.styleSheets`
 * stayed empty even with the buggy class applied), so `getComputedStyle` in a test never reflects
 * the real cascade the way a packaged build does. Reading the raw `.module.css` SOURCE text, the
 * way this guard does, is what actually exercises the real rule.
 */

function listTsxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTsxFiles(fullPath);
    }
    return entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

interface DialogClassUsage {
  readonly tsxPath: string;
  readonly cssPath: string;
  readonly className: string;
}

// Matches `cx(styles, '<name>')` anywhere inside a `class=`/`className=` attribute value — loose
// on purpose (no full JSX parse): both call shapes this codebase actually uses, `class={cx(styles,
// 'popover')}` (Popover.tsx) and `className={cx(styles, 'dialog')}` (SettingsDialog.tsx via the
// shared `Dialog` wrapper), match it.
const CX_STYLES_PATTERN = /cx\(styles,\s*'([a-zA-Z0-9]+)'\)/g;

/** The exact end of a JSX opening tag starting at `source[tagStart]` (the `<` of `<dialog`/
 * `<Dialog`) — tracked by `{}` depth so a `>` inside a prop expression (e.g. an arrow function,
 * `onClose={() => ...}`) is never mistaken for the tag's own close. Returns `source.length` if the
 * tag never closes (malformed input; callers just get an empty-ish window, never a crash). */
function openingTagEnd(source: string, tagStart: number): number {
  let depth = 0;
  for (let i = tagStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === '>' && depth === 0) {
      return i + 1;
    }
  }
  return source.length;
}

/** Finds every `cx(styles, '<name>')` reference that sits inside the OPENING TAG itself of a
 * literal `<dialog` or `<Dialog` element — never inside its children (a child `<div class={cx(
 * styles, 'body')}>` is a different element with a different visibility story, not the dialog
 * root this guard cares about). */
function findDialogClassNames(source: string): string[] {
  const names: string[] = [];
  const tagPattern = /<(?:dialog|Dialog)\b/g;
  for (const tagMatch of source.matchAll(tagPattern)) {
    const tagEnd = openingTagEnd(source, tagMatch.index);
    const openingTag = source.slice(tagMatch.index, tagEnd);
    for (const classMatch of openingTag.matchAll(CX_STYLES_PATTERN)) {
      const name = classMatch[1];
      if (name !== undefined) {
        names.push(name);
      }
    }
  }
  return names;
}

function findStylesImportPath(source: string, tsxDir: string): string | null {
  const importMatch = /import\s+styles\s+from\s+'([^']+\.module\.css)'/.exec(source);
  const importedPath = importMatch?.[1];
  if (importedPath === undefined) {
    return null;
  }
  return path.resolve(tsxDir, importedPath);
}

/** The bare `.<name> { ... }` block (never `.<name>[open]`, excluded by requiring the character
 * right after the class name to be whitespace, a comma, or `{` — never `[`). `null` when the CSS
 * module has no such unqualified rule at all (e.g. every declaration for that name is already
 * gated). */
function findBareClassBlock(cssText: string, className: string): string | null {
  const pattern = new RegExp(`\\.${className}(?=[\\s,{])\\s*\\{([^}]*)\\}`);
  const match = pattern.exec(cssText);
  return match?.[1] ?? null;
}

function collectDialogClassUsages(rendererRoot: string): DialogClassUsage[] {
  const usages: DialogClassUsage[] = [];
  for (const tsxPath of listTsxFiles(rendererRoot)) {
    const source = fs.readFileSync(tsxPath, 'utf8');
    const classNames = findDialogClassNames(source);
    if (classNames.length === 0) {
      continue;
    }
    const cssPath = findStylesImportPath(source, path.dirname(tsxPath));
    if (cssPath === null || !fs.existsSync(cssPath)) {
      continue;
    }
    for (const className of classNames) {
      usages.push({ tsxPath, cssPath, className });
    }
  }
  return usages;
}

describe('no <dialog>/<Dialog> root class sets display unconditionally', () => {
  const rendererRoot = path.join(PROJECT_ROOT, APP_SRC_ROOT, 'renderer');
  const usages = collectDialogClassUsages(rendererRoot);

  it('found at least one real usage to check (the guard itself is not vacuous)', () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it.each(usages.map((usage) => [path.relative(PROJECT_ROOT, usage.tsxPath), usage] as const))(
    '%s: .%s has no unconditional `display`',
    (_label, usage) => {
      const cssText = fs.readFileSync(usage.cssPath, 'utf8');
      const bareBlock = findBareClassBlock(cssText, usage.className);
      if (bareBlock === null) {
        // No unqualified rule for this class at all (every declaration already lives behind
        // `[open]`) — nothing to check.
        return;
      }
      expect(
        bareBlock,
        `${path.relative(PROJECT_ROOT, usage.cssPath)}'s own bare ".${usage.className} { ... }" ` +
          `rule sets "display" unconditionally, which always wins over the UA stylesheet's own ` +
          `"dialog:not([open]) { display: none }" regardless of specificity — the dialog stays ` +
          `painted after .close() until something unrelated re-renders. Raw block found:\n` +
          `${bareBlock}`,
      ).not.toMatch(/display\s*:/);
    },
  );
});
