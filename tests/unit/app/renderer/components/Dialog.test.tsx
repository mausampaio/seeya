// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { Dialog } from '../../../../../packages/app/src/renderer/components/Dialog/index.js';

afterEach(cleanup);

describe('Dialog (V2-T62, D-051; reactive open/onClose + Text title since V2-T65)', () => {
  it('renders a real <dialog> element with the given id and the base class', () => {
    const { container } = render(<Dialog id="fallback-dialog">body</Dialog>);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.id).toBe('fallback-dialog');
    expect(dialog.className).toBe('seeya-dialog');
  });

  it('renders the title as a heading only when one is given', () => {
    const { container, rerender } = render(<Dialog id="x" title="Hello" />);
    expect(container.querySelector('h3')?.textContent).toBe('Hello');
    rerender(<Dialog id="x" />);
    expect(container.querySelector('h3')).toBeNull();
  });

  it('appends className to the base seeya-dialog class', () => {
    const { container } = render(<Dialog id="x" className="project-dialog" />);
    expect(container.querySelector('dialog')?.className).toBe('seeya-dialog project-dialog');
  });

  it('without `open`, never calls showModal on its own — the legacy imperative pattern', () => {
    const { container } = render(<Dialog id="x" />);
    expect((container.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('opens (showModal) once open=true, and closes once open goes back to false', () => {
    const { container, rerender } = render(<Dialog id="x" open={false} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    rerender(<Dialog id="x" open />);
    expect(dialog.open).toBe(true);

    rerender(<Dialog id="x" open={false} />);
    expect(dialog.open).toBe(false);
  });

  it('calls onClose when the dialog closes on its own (Esc/native close event)', () => {
    const onClose = vi.fn();
    const { container } = render(<Dialog id="x" open onClose={onClose} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    dialog.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // V2-T69 (`docs/INTERFACE.md` § 6 item 4, PO review round 1): the opt-in scrollable-body shape —
  // a caller passing `footer` gets the title/footer pinned and only the body between them scrolling.
  describe('footer (V2-T69) — the opt-in scrollable-body shape', () => {
    it('without footer, renders children directly — no extra body/footer wrapper, no scrollableBody class', () => {
      const { container } = render(<Dialog id="x">plain content</Dialog>);
      const dialog = container.querySelector('dialog') as HTMLDialogElement;
      expect(dialog.className).toBe('seeya-dialog');
      expect(dialog.textContent).toBe('plain content');
      expect(container.querySelectorAll('div').length).toBe(0);
    });

    it('with footer, wraps children in a scrollable body and renders the footer after it', () => {
      const { container } = render(
        <Dialog id="x" footer={<button type="button">Close</button>}>
          <p>a long list</p>
        </Dialog>,
      );
      const dialog = container.querySelector('dialog') as HTMLDialogElement;
      expect(dialog.className).toMatch(/\bseeya-dialog\b/);
      // The scrollableBody class comes from Dialog.module.css, so under Vitest's CSS-module
      // transform it's a generated token, not the literal word — asserting the STRUCTURE (two
      // divs, content in the first, the footer's own button in the second) is what the feature
      // actually promises, not a module hash string this test shouldn't know.
      const divs = container.querySelectorAll('dialog > div');
      expect(divs).toHaveLength(2);
      expect(divs[0]?.textContent).toBe('a long list');
      expect(divs[1]?.querySelector('button')?.textContent).toBe('Close');
    });

    it('with footer, still appends className and renders the title heading', () => {
      const { container } = render(
        <Dialog id="x" title="Result" className="end-day" footer={<span>footer</span>}>
          body
        </Dialog>,
      );
      const dialog = container.querySelector('dialog') as HTMLDialogElement;
      expect(dialog.className).toMatch(/\bseeya-dialog\b/);
      expect(dialog.className).toMatch(/\bend-day\b/);
      expect(container.querySelector('h3')?.textContent).toBe('Result');
    });
  });
});
