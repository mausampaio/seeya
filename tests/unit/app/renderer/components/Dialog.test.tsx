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
});
