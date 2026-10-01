// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { ResumeProgress } from '../../../../../../packages/app/src/renderer/features/today/ResumeProgress/index.js';

afterEach(cleanup);

describe('ResumeProgress (D-052, V2-T66)', () => {
  it('renders nothing when progress is null', () => {
    const { container } = render(<ResumeProgress progress={null} />);
    expect(container.firstElementChild).toBeNull();
  });

  it('shows "Resuming i of N: name..." when progress is set', () => {
    const { getByText } = render(
      <ResumeProgress progress={{ index: 2, total: 3, name: 'payments-webhooks' }} />,
    );
    expect(getByText('Resuming 2 of 3: payments-webhooks...')).not.toBeNull();
  });
});
