// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { ProjectsSection } from '../../../../../../packages/app/src/renderer/features/settings/ProjectsSection/index.js';

afterEach(cleanup);

describe('ProjectsSection (V2-T65, docs/INTERFACE.md § 8 — read-only, como hoje)', () => {
  it('shows the empty message when there is no project policy', () => {
    const { getByText } = render(<ProjectsSection lines={[]} />);
    expect(getByText('(none)')).not.toBeNull();
  });

  it('renders one line per project policy entry, canTerminate/deepCapture included', () => {
    const { getByText } = render(
      <ProjectsSection
        lines={[
          { cwd: '/repo/one', canTerminate: true, deepCapture: false },
          { cwd: '/repo/two', canTerminate: false, deepCapture: true },
        ]}
      />,
    );
    expect(getByText('/repo/one: canTerminate=true, deepCapture=false')).not.toBeNull();
    expect(getByText('/repo/two: canTerminate=false, deepCapture=true')).not.toBeNull();
  });
});
