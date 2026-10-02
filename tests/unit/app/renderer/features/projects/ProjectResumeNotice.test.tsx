// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ProjectResumeNotice } from '../../../../../../packages/app/src/renderer/features/projects/ProjectResumeNotice/index.js';
import infoBoxStyles from '../../../../../../packages/app/src/renderer/components/InfoBox/InfoBox.module.css';
import { classesOf } from '../../components/_dom.js';

afterEach(cleanup);

describe('ProjectResumeNotice (V2-T77)', () => {
  it('shows the outcome text, as a warning for a refusal', () => {
    const { getByText, getByRole } = render(
      <ProjectResumeNotice
        result={{ resumed: false, text: 'Session "x" is running.' }}
        onDismiss={() => {}}
      />,
    );
    expect(getByText('Session "x" is running.')).not.toBeNull();
    const box = getByRole('status').parentElement;
    expect(classesOf(box)).toContain(infoBoxStyles.warning);
  });

  it('is plain information when the session ran and closed', () => {
    const { getByRole } = render(
      <ProjectResumeNotice result={{ resumed: true, text: 'closed' }} onDismiss={() => {}} />,
    );
    expect(classesOf(getByRole('status').parentElement)).toContain(infoBoxStyles.info);
  });

  it('Dismiss calls onDismiss', () => {
    const onDismiss = vi.fn();
    const { getByText } = render(
      <ProjectResumeNotice result={{ resumed: false, text: 'x' }} onDismiss={onDismiss} />,
    );
    fireEvent.click(getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
