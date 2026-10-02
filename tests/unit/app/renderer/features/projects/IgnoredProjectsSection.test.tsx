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
          { projectId: 'broken-project', reason: 'invalid JSON' },
          { projectId: 'another', reason: 'repositories: expected array, received object' },
        ]}
      />,
    );
    expect(getByText('Ignored projects')).not.toBeNull();
    expect(getByText('broken-project: invalid JSON')).not.toBeNull();
    expect(getByText('another: repositories: expected array, received object')).not.toBeNull();
  });
});
