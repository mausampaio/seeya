// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { ArchiveSection } from '../../../../../../packages/app/src/renderer/features/project-details/ArchiveSection/index.js';

afterEach(cleanup);

const ARCHIVED = {
  kind: 'archived',
  archivedAt: new Date('2026-10-02T10:00:00.000Z'),
  note: 'Finished — shipped',
} as const;

describe('ArchiveSection (V2-T84, docs/INTERFACE.md § 4b)', () => {
  it('an active project shows Archive project… with the recommendation, and asks via onArchive', () => {
    const onArchive = vi.fn();
    const { getByText, container } = render(
      <ArchiveSection
        lifecycle={{ kind: 'active' }}
        writeBlockedReason={undefined}
        pending={null}
        onArchive={onArchive}
        onUnarchive={() => {}}
      />,
    );
    expect(
      getByText(/Recommended when the project is finished, paused or abandoned/),
    ).not.toBeNull();
    fireEvent.click(container.querySelector('#project-details-archive-project')!);
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it("an archived project shows the state — date and note, the CLI's own words — and Unarchive", () => {
    const onUnarchive = vi.fn();
    const { container } = render(
      <ArchiveSection
        lifecycle={ARCHIVED}
        writeBlockedReason={undefined}
        pending={null}
        onArchive={() => {}}
        onUnarchive={onUnarchive}
      />,
    );
    expect(container.querySelector('#project-details-archived-state')?.textContent).toBe(
      'Archived on 2026-10-02 — Finished — shipped',
    );
    expect(container.querySelector('#project-details-archive-project')).toBeNull();
    fireEvent.click(container.querySelector('#project-details-unarchive')!);
    expect(onUnarchive).toHaveBeenCalledTimes(1);
  });

  it('an archived project without a note shows just the date', () => {
    const { container } = render(
      <ArchiveSection
        lifecycle={{ ...ARCHIVED, note: null }}
        writeBlockedReason={undefined}
        pending={null}
        onArchive={() => {}}
        onUnarchive={() => {}}
      />,
    );
    expect(container.querySelector('#project-details-archived-state')?.textContent).toBe(
      'Archived on 2026-10-02',
    );
  });

  it('a locked project turns the action off and puts the reason on the button', () => {
    const { container } = render(
      <ArchiveSection
        lifecycle={{ kind: 'active' }}
        writeBlockedReason="Locked by session abcd1234. Changes are disabled until the lock is released."
        pending={null}
        onArchive={() => {}}
        onUnarchive={() => {}}
      />,
    );
    const button = container.querySelector('#project-details-archive-project') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toMatch(/Locked by session abcd1234/);
  });

  it('while another action runs the button is off; its own unarchive shows loading', () => {
    const busy = render(
      <ArchiveSection
        lifecycle={{ kind: 'active' }}
        writeBlockedReason={undefined}
        pending={{ kind: 'addRepository' }}
        onArchive={() => {}}
        onUnarchive={() => {}}
      />,
    );
    expect(
      (busy.container.querySelector('#project-details-archive-project') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    cleanup();
    const unarchiving = render(
      <ArchiveSection
        lifecycle={ARCHIVED}
        writeBlockedReason={undefined}
        pending={{ kind: 'unarchiveProject' }}
        onArchive={() => {}}
        onUnarchive={() => {}}
      />,
    );
    expect(
      unarchiving.container.querySelector('#project-details-unarchive')?.getAttribute('aria-busy'),
    ).toBe('true');
  });
});
