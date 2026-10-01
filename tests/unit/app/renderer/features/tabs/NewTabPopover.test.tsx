// @vitest-environment happy-dom
import { useRef } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { createFakeSeeyaApi } from '../../_fake-seeya-api.js';
import { NewTabPopover } from '../../../../../../packages/app/src/renderer/features/tabs/NewTabPopover/index.js';

afterEach(cleanup);

function Harness(props: {
  readonly open: boolean;
  readonly recentDirectories?: readonly string[];
  readonly onClose: () => void;
  readonly onOpenTab: (command: string, args: readonly string[], cwd: string) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef} type="button">
        +
      </button>
      <NewTabPopover
        id="new-tab-popover"
        open={props.open}
        anchorRef={anchorRef}
        recentDirectories={props.recentDirectories ?? []}
        onClose={props.onClose}
        onOpenTab={props.onOpenTab}
      />
    </>
  );
}

describe('NewTabPopover (V2-T64)', () => {
  beforeEach(() => {
    window.seeya = createFakeSeeyaApi();
  });

  it('defaults to claude, submitting with an empty directory', () => {
    const onOpenTab = vi.fn();
    const onClose = vi.fn();
    const { getByRole } = render(<Harness open onClose={onClose} onOpenTab={onOpenTab} />);
    fireEvent.submit(getByRole('button', { name: 'Open' }).closest('form') as HTMLFormElement);
    expect(onOpenTab).toHaveBeenCalledWith('claude', [], '');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('selecting Shell submits the empty-string command (the default shell)', () => {
    const onOpenTab = vi.fn();
    const { getByRole } = render(<Harness open onClose={() => {}} onOpenTab={onOpenTab} />);
    fireEvent.click(getByRole('radio', { name: 'Shell' }));
    fireEvent.submit(getByRole('button', { name: 'Open' }).closest('form') as HTMLFormElement);
    expect(onOpenTab).toHaveBeenCalledWith('', [], '');
  });

  it('selecting Other… reveals a free-text command field, trimmed on submit', () => {
    const onOpenTab = vi.fn();
    const { getByRole } = render(<Harness open onClose={() => {}} onOpenTab={onOpenTab} />);
    fireEvent.click(getByRole('radio', { name: 'Other…' }));
    fireEvent.input(getByRole('textbox', { name: 'Command' }), {
      target: { value: '  npx tsx  ' },
    });
    fireEvent.submit(getByRole('button', { name: 'Open' }).closest('form') as HTMLFormElement);
    expect(onOpenTab).toHaveBeenCalledWith('npx tsx', [], '');
  });

  it('typing a directory and submitting passes it through', () => {
    const onOpenTab = vi.fn();
    const { getByRole, getByLabelText } = render(
      <Harness open onClose={() => {}} onOpenTab={onOpenTab} />,
    );
    fireEvent.input(getByLabelText('Directory'), { target: { value: '/code/app' } });
    fireEvent.submit(getByRole('button', { name: 'Open' }).closest('form') as HTMLFormElement);
    expect(onOpenTab).toHaveBeenCalledWith('claude', [], '/code/app');
  });

  it('Browse… calls the native picker and fills the field when not cancelled', async () => {
    window.seeya = createFakeSeeyaApi({
      pickDirectory: vi.fn(() => Promise.resolve({ canceled: false, path: '/picked/dir' })),
    });
    const { getByRole, getByLabelText } = render(
      <Harness open onClose={() => {}} onOpenTab={() => {}} />,
    );
    fireEvent.click(getByRole('button', { name: 'Browse…' }));
    await waitFor(() =>
      expect((getByLabelText('Directory') as HTMLInputElement).value).toBe('/picked/dir'),
    );
  });

  it('Browse… leaves the field untouched when the picker is cancelled', async () => {
    const pickDirectory = vi.fn(() => Promise.resolve({ canceled: true as const }));
    window.seeya = createFakeSeeyaApi({ pickDirectory });
    const { getByRole, getByLabelText } = render(
      <Harness open onClose={() => {}} onOpenTab={() => {}} />,
    );
    fireEvent.input(getByLabelText('Directory'), { target: { value: '/already/typed' } });
    fireEvent.click(getByRole('button', { name: 'Browse…' }));
    await waitFor(() => expect(pickDirectory).toHaveBeenCalledTimes(1));
    expect((getByLabelText('Directory') as HTMLInputElement).value).toBe('/already/typed');
  });

  it('renders up to three recent directories as shortcuts that fill the field', () => {
    const { getByRole, getByLabelText } = render(
      <Harness
        open
        recentDirectories={['/code/app', '/code/other']}
        onClose={() => {}}
        onOpenTab={() => {}}
      />,
    );
    fireEvent.click(getByRole('button', { name: '/code/other' }));
    expect((getByLabelText('Directory') as HTMLInputElement).value).toBe('/code/other');
  });

  it('Cancel calls onClose without opening a tab', () => {
    const onOpenTab = vi.fn();
    const onClose = vi.fn();
    const { getByRole } = render(<Harness open onClose={onClose} onOpenTab={onOpenTab} />);
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenTab).not.toHaveBeenCalled();
  });

  it('resets its fields every time it reopens', () => {
    const { getByRole, getByLabelText, rerender } = render(
      <Harness open onClose={() => {}} onOpenTab={() => {}} />,
    );
    fireEvent.input(getByLabelText('Directory'), { target: { value: '/typed' } });
    fireEvent.click(getByRole('radio', { name: 'Shell' }));
    rerender(<Harness open={false} onClose={() => {}} onOpenTab={() => {}} />);
    rerender(<Harness open onClose={() => {}} onOpenTab={() => {}} />);
    expect((getByLabelText('Directory') as HTMLInputElement).value).toBe('');
    expect(getByRole('radio', { name: 'claude' }).getAttribute('aria-pressed')).toBe('true');
  });
});
