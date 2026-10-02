// @vitest-environment happy-dom
import { useRef } from 'preact/hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { Popover } from '../../../../../packages/app/src/renderer/components/Popover/index.js';

afterEach(cleanup);

/** `Popover.anchorRef` has to be a real `RefObject`, created inside a component — this thin
 * wrapper is the test's own stand-in for whatever real trigger button a caller would pass. */
function Harness(props: { readonly open: boolean; readonly onRequestClose: () => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef} type="button">
        +
      </button>
      <Popover
        id="test-popover"
        open={props.open}
        anchorRef={anchorRef}
        onRequestClose={props.onRequestClose}
      >
        <p data-testid="content">content</p>
      </Popover>
    </>
  );
}

describe('Popover (D-052, V2-T64)', () => {
  it('is not open while open=false', () => {
    const { container } = render(<Harness open={false} onRequestClose={() => {}} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  it('opens the real <dialog> (showModal) once open=true', () => {
    const { container, rerender } = render(<Harness open={false} onRequestClose={() => {}} />);
    rerender(<Harness open onRequestClose={() => {}} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
  });

  it('closes the dialog once open goes back to false', () => {
    const { container, rerender } = render(<Harness open onRequestClose={() => {}} />);
    rerender(<Harness open={false} onRequestClose={() => {}} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  it('calls onRequestClose when the dialog closes on its own (Esc/native close event)', () => {
    const onRequestClose = vi.fn();
    const { container } = render(<Harness open onRequestClose={onRequestClose} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    dialog.close(); // same event Esc/`<form method="dialog">` would fire natively
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('a click on the dialog element itself (the ::backdrop) closes it', () => {
    const onRequestClose = vi.fn();
    const { container } = render(<Harness open onRequestClose={onRequestClose} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    fireEvent.click(dialog);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
  });

  it("a click on the popover's own content never closes it", () => {
    const onRequestClose = vi.fn();
    const { getByTestId } = render(<Harness open onRequestClose={onRequestClose} />);
    fireEvent.click(getByTestId('content'));
    expect(onRequestClose).not.toHaveBeenCalled();
  });
});

describe('Popover focus and width options (V2-T81)', () => {
  function OptionsHarness(props: { readonly returnFocus: boolean }) {
    const anchorRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={anchorRef} type="button" data-testid="anchor">
          +
        </button>
        <Popover
          id="opt-popover"
          open
          anchorRef={anchorRef}
          matchAnchorWidth
          returnFocusToAnchor={props.returnFocus}
          onRequestClose={() => {}}
        >
          <p>content</p>
        </Popover>
      </>
    );
  }

  it('returnFocusToAnchor: closing focuses the anchor and marks the dialog for the global focus return to skip', () => {
    const { container, getByTestId } = render(<OptionsHarness returnFocus />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.dataset.returnFocus).toBe('anchor');
    dialog.close();
    expect(document.activeElement).toBe(getByTestId('anchor'));
  });

  it('without returnFocusToAnchor the dialog carries no marker and focus is not forced', () => {
    const { container, getByTestId } = render(<OptionsHarness returnFocus={false} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.dataset.returnFocus).toBeUndefined();
    dialog.close();
    expect(document.activeElement).not.toBe(getByTestId('anchor'));
  });

  it('matchAnchorWidth sets a min-width from the anchor on open', () => {
    const { container } = render(<OptionsHarness returnFocus={false} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.style.minWidth).toMatch(/^\d+(\.\d+)?px$/);
  });
});
