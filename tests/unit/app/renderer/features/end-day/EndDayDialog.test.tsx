// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { EndDayDialog } from '../../../../../../packages/app/src/renderer/features/end-day/EndDayDialog.js';
import type { EndDayControls } from '../../../../../../packages/app/src/renderer/features/end-day/useEndDay.js';
import type { EndDayPanelState } from '../../../../../../packages/app/src/state/end-day-panel.js';

afterEach(cleanup);

const NOOP = (): void => {};

function buildControls(
  state: EndDayPanelState,
  overrides: Partial<EndDayControls> = {},
): EndDayControls {
  return {
    state,
    triggerClicked: NOOP,
    cancel: NOOP,
    run: NOOP,
    hide: NOOP,
    closeResult: NOOP,
    openToday: NOOP,
    ...overrides,
  };
}

describe('EndDayDialog (D-052, V2-T69)', () => {
  it('idle renders a closed dialog', () => {
    const { container } = render(<EndDayDialog controls={buildControls({ kind: 'idle' })} />);
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  it('previewPending shows the loading text', () => {
    const { getByText } = render(
      <EndDayDialog controls={buildControls({ kind: 'previewPending' })} />,
    );
    expect(getByText('Loading preview…')).not.toBeNull();
  });

  it('preview shows the structured lists and the cost ceiling, never a <pre> report', () => {
    const { getByText, container } = render(
      <EndDayDialog
        controls={buildControls({
          kind: 'preview',
          willBeCaptured: [
            { sessionId: 's1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
          ],
          notCaptured: [
            {
              sessionId: 's2',
              name: 'beta',
              cwd: '~/beta',
              kind: 'ineligible',
              reason: 'This directory is in the ignore list.',
              fullReason: 'This directory is in the ignore list.',
            },
          ],
          costCeiling: {
            sessionsInScope: 1,
            budgetPerSessionUsd: 0.5,
            captureModel: 'sonnet',
            totalCeilingUsd: 0.5,
          },
        })}
      />,
    );
    expect(getByText('Will be captured · 1')).not.toBeNull();
    expect(getByText('Not captured · 1')).not.toBeNull();
    expect(getByText('alpha')).not.toBeNull();
    expect(getByText('beta')).not.toBeNull();
    expect(getByText('This directory is in the ignore list.')).not.toBeNull();
    expect(container.querySelector('pre')).toBeNull();
  });

  it('preview Cancel/Run end-day now call the controls', () => {
    const cancel = vi.fn();
    const run = vi.fn();
    const { getByRole } = render(
      <EndDayDialog
        controls={buildControls(
          {
            kind: 'preview',
            willBeCaptured: [],
            notCaptured: [],
            costCeiling: {
              sessionsInScope: 0,
              budgetPerSessionUsd: 0.5,
              captureModel: 'sonnet',
              totalCeilingUsd: 0,
            },
          },
          { cancel, run },
        )}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    fireEvent.click(getByRole('button', { name: 'Run end-day now' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('starting hides Cancel and shows Run end-day now as loading, frozen on the preview data', () => {
    const { getByRole, queryByRole } = render(
      <EndDayDialog
        controls={buildControls({
          kind: 'starting',
          willBeCaptured: [],
          notCaptured: [],
          costCeiling: {
            sessionsInScope: 0,
            budgetPerSessionUsd: 0.5,
            captureModel: 'sonnet',
            totalCeilingUsd: 0,
          },
        })}
      />,
    );
    expect(queryByRole('button', { name: 'Cancel' })).toBeNull();
    const runButton = getByRole('button', { name: 'Run end-day now' }) as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);
    expect(runButton.getAttribute('aria-busy')).toBe('true');
  });

  it('running shows the headline, a progressbar and the per-session status list', () => {
    const { getByText, getByRole } = render(
      <EndDayDialog
        controls={buildControls({
          kind: 'running',
          visible: true,
          current: { index: 1, total: 2, name: 'alpha' },
          sessions: [
            { sessionId: 's1', name: 'alpha', status: 'capturing' },
            { sessionId: 's2', name: 'beta', status: 'waiting' },
          ],
        })}
      />,
    );
    expect(getByText('Capturing 1 of 2: alpha...')).not.toBeNull();
    expect(getByRole('progressbar')).not.toBeNull();
    expect(getByText('alpha')).not.toBeNull();
    expect(getByText('beta')).not.toBeNull();
    expect(getByText('Capturing')).not.toBeNull();
    expect(getByText('Waiting')).not.toBeNull();
  });

  it('running is only open while visible, and Hide calls the control', () => {
    const hide = vi.fn();
    const { container, getByRole } = render(
      <EndDayDialog
        controls={buildControls(
          {
            kind: 'running',
            visible: true,
            current: { index: 1, total: 1, name: 'x' },
            sessions: [],
          },
          { hide },
        )}
      />,
    );
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    fireEvent.click(getByRole('button', { name: 'Hide' }));
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('a hidden running state renders a closed dialog', () => {
    const { container } = render(
      <EndDayDialog
        controls={buildControls({
          kind: 'running',
          visible: false,
          current: { index: 1, total: 1, name: 'x' },
          sessions: [],
        })}
      />,
    );
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('result shows captured/failed/skipped sections and Open Today', () => {
    const openToday = vi.fn();
    const { getByText, getByRole } = render(
      <EndDayDialog
        controls={buildControls(
          {
            kind: 'result',
            visible: true,
            captured: [
              { sessionId: 's1', name: 'alpha', cwd: '~/alpha', state: 'ended', mode: 'lean' },
            ],
            failed: [
              {
                sessionId: 's2',
                name: 'beta',
                cwd: '~/beta',
                reason: 'ENOENT',
                fullReason: 'ENOENT',
              },
            ],
            skipped: [],
          },
          { openToday },
        )}
      />,
    );
    expect(getByText('Captured · 1')).not.toBeNull();
    expect(getByText('Failed · 1')).not.toBeNull();
    expect(getByText('Skipped · 0')).not.toBeNull();
    expect(getByText('ENOENT')).not.toBeNull();
    fireEvent.click(getByRole('button', { name: 'Open Today' }));
    expect(openToday).toHaveBeenCalledTimes(1);
  });
});

/** The native `close` event (Esc included) means something different per phase — this file's own
 * `handleClose` docstring. `dialog.dispatchEvent(new Event('close'))` is the direct way to fire
 * it: `fireEvent` (`@testing-library/dom`) has no built-in helper for this less common event. */
function fireDialogClose(container: Element): void {
  container.querySelector('dialog')?.dispatchEvent(new Event('close'));
}

describe('EndDayDialog — the native close event (Esc) means something different per phase', () => {
  it('previewPending: closing cancels the in-flight preview', () => {
    const cancel = vi.fn();
    const { container } = render(
      <EndDayDialog controls={buildControls({ kind: 'previewPending' }, { cancel })} />,
    );
    fireDialogClose(container);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('preview: closing cancels, never hides (nothing is running yet to hide)', () => {
    const cancel = vi.fn();
    const hide = vi.fn();
    const { container } = render(
      <EndDayDialog
        controls={buildControls(
          {
            kind: 'preview',
            willBeCaptured: [],
            notCaptured: [],
            costCeiling: {
              sessionsInScope: 0,
              budgetPerSessionUsd: 0.5,
              captureModel: 'sonnet',
              totalCeilingUsd: 0,
            },
          },
          { cancel, hide },
        )}
      />,
    );
    fireDialogClose(container);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
  });

  it('starting: closing can only mean Hide — the real capture is already running', () => {
    const cancel = vi.fn();
    const hide = vi.fn();
    const { container } = render(
      <EndDayDialog
        controls={buildControls(
          {
            kind: 'starting',
            willBeCaptured: [],
            notCaptured: [],
            costCeiling: {
              sessionsInScope: 0,
              budgetPerSessionUsd: 0.5,
              captureModel: 'sonnet',
              totalCeilingUsd: 0,
            },
          },
          { cancel, hide },
        )}
      />,
    );
    fireDialogClose(container);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('running: closing means Hide, never a lie about having stopped the capture', () => {
    const hide = vi.fn();
    const closeResult = vi.fn();
    const { container } = render(
      <EndDayDialog
        controls={buildControls(
          {
            kind: 'running',
            visible: true,
            current: { index: 1, total: 1, name: 'x' },
            sessions: [],
          },
          { hide, closeResult },
        )}
      />,
    );
    fireDialogClose(container);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(closeResult).not.toHaveBeenCalled();
  });

  it('result: closing dismisses the result back to idle, never Hide', () => {
    const hide = vi.fn();
    const closeResult = vi.fn();
    const { container } = render(
      <EndDayDialog
        controls={buildControls(
          { kind: 'result', visible: true, captured: [], failed: [], skipped: [] },
          { hide, closeResult },
        )}
      />,
    );
    fireDialogClose(container);
    expect(closeResult).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
  });
});
