// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { IgnoredProjectsSection } from '../../../../../../packages/app/src/renderer/features/projects/IgnoredProjectsSection/index.js';

afterEach(cleanup);

describe('IgnoredProjectsSection (V2-T67, V2-T72 item 2)', () => {
  it('renders nothing at all when there is nothing ignored', () => {
    const { container } = render(<IgnoredProjectsSection rows={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the heading and one line per ignored project, id and reason', () => {
    const { getByText } = render(
      <IgnoredProjectsSection
        rows={[
          { projectId: 'broken-project', reason: 'invalid JSON', fullReason: 'invalid JSON' },
          {
            projectId: 'another',
            reason: 'repositories: expected array, received object',
            fullReason: 'repositories: expected array, received object',
          },
        ]}
      />,
    );
    expect(getByText('Ignored projects')).not.toBeNull();
    expect(getByText('broken-project: invalid JSON')).not.toBeNull();
    expect(getByText('another: repositories: expected array, received object')).not.toBeNull();
  });

  // PO review round 1: the row shows the already-abbreviated `reason` (short) on screen, truncates
  // it further with CSS if it still doesn't fit, and never shows a `title` when there is nothing
  // extra to reveal (reason === fullReason).
  it('a reason with nothing abbreviated/truncated carries no title (nothing extra to show)', () => {
    const { getByText } = render(
      <IgnoredProjectsSection
        rows={[{ projectId: 'broken-project', reason: 'invalid JSON', fullReason: 'invalid JSON' }]}
      />,
    );
    const line = getByText('broken-project: invalid JSON');
    expect(line.getAttribute('title')).toBeNull();
  });

  it('a reason that was abbreviated/truncated shows the short line, with the full one in title', () => {
    const fullReason =
      '/home/x/.seeya/workspace/broken-project/seeya.json is not valid JSON: SyntaxError';
    const reason = '~/.seeya/workspace/broken-project/seeya.json is not valid JSON: SyntaxError';
    const { getByText } = render(
      <IgnoredProjectsSection rows={[{ projectId: 'broken-project', reason, fullReason }]} />,
    );
    const line = getByText(`broken-project: ${reason}`);
    expect(line.getAttribute('title')).toBe(`broken-project: ${fullReason}`);
  });
});
