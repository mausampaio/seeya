// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Text } from '../../../../../packages/app/src/renderer/components/Text/index.js';
import styles from '../../../../../packages/app/src/renderer/components/Text/Text.module.css';

afterEach(cleanup);

describe('Text (D-052, V2-T75 item 7 — identity § 4.4)', () => {
  it('renders as a span by default, with the variant/primary-tone classes', () => {
    const { container } = render(<Text variant="body-sm">Payments webhooks</Text>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain(styles.bodySm);
    expect(el.className).toContain(styles.tonePrimary);
  });

  it('renders as a different element via `as`', () => {
    const { container } = render(
      <Text as="p" variant="caption">
        Favorites
      </Text>,
    );
    expect((container.firstElementChild as HTMLElement).tagName).toBe('P');
  });

  // PO review (2026-10-01): `Section`'s own heading needs a real `<h2>` for accessibility
  // (`getByRole('heading', ...)`) — `TextElement` grew the four heading tags for this.
  it('renders as a heading element via `as`, for a real accessible heading role', () => {
    const { getByRole } = render(
      <Text as="h2" variant="caption">
        Favorites
      </Text>,
    );
    expect(getByRole('heading', { name: 'Favorites' }).tagName).toBe('H2');
  });

  it('applies the requested tone', () => {
    const { container } = render(
      <Text variant="caption" tone="tertiary">
        in 2 h 13 min
      </Text>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain(styles.toneTertiary);
  });

  it('overrides the variant default weight only when `weight` is given', () => {
    const { container: withOverride } = render(
      <Text variant="body-sm" weight={500}>
        Payments webhooks
      </Text>,
    );
    expect((withOverride.firstElementChild as HTMLElement).className).toContain(styles.weight500);

    const { container: withoutOverride } = render(<Text variant="body-sm">Auth hardening</Text>);
    expect((withoutOverride.firstElementChild as HTMLElement).className).not.toContain(
      styles.weight500,
    );
  });

  it('adds the truncate class only when asked', () => {
    const { container: truncated } = render(
      <Text variant="body-sm" truncate>
        a very long session name that should ellipsize
      </Text>,
    );
    expect((truncated.firstElementChild as HTMLElement).className).toContain(styles.truncate);

    const { container: plain } = render(<Text variant="body-sm">short</Text>);
    expect((plain.firstElementChild as HTMLElement).className).not.toContain(styles.truncate);
  });

  it('forwards id/title/className', () => {
    const { container } = render(
      <Text
        variant="body-sm"
        id="session-name"
        title="auth-hardening (full path)"
        className="extra"
      >
        auth-hardening
      </Text>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.id).toBe('session-name');
    expect(el.title).toBe('auth-hardening (full path)');
    expect(el.className).toContain('extra');
  });
});
