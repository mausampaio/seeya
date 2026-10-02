// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ProjectsHeader } from '../../../../../../packages/app/src/renderer/features/projects/ProjectsHeader/index.js';

afterEach(cleanup);

describe('ProjectsHeader (V2-T67)', () => {
  it('shows the title and the pluralized count', () => {
    const { getByText } = render(<ProjectsHeader count={3} onNewProject={() => {}} />);
    expect(getByText('Projects')).not.toBeNull();
    expect(getByText('3 projects')).not.toBeNull();
  });

  it('singular count reads "1 project"', () => {
    const { getByText } = render(<ProjectsHeader count={1} onNewProject={() => {}} />);
    expect(getByText('1 project')).not.toBeNull();
  });

  it('clicking "New project" calls onNewProject', () => {
    const onNewProject = vi.fn();
    const { getByText } = render(<ProjectsHeader count={0} onNewProject={onNewProject} />);
    fireEvent.click(getByText('New project'));
    expect(onNewProject).toHaveBeenCalledTimes(1);
  });

  it('never carries id="new-project-button" — that id belongs to the sidebar’s own trigger', () => {
    const { container } = render(<ProjectsHeader count={0} onNewProject={() => {}} />);
    expect(container.querySelector('#new-project-button')).toBeNull();
  });
});
