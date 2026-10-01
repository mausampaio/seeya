/**
 * The tab strip's own "New tab" popover (V2-T64, `docs/INTERFACE.md` § 2) — replaces the former
 * command bar (`renderer/legacy/tabs-view.ts#wireCommandBar`, apagado by this task). A `claude` ·
 * `codex` · `Shell` · `Other…` selector, a `Directory` field with a native folder picker and up to
 * three recent directories as shortcuts, and `Open`/`Cancel`.
 *
 * **Recent directories (D-025).** `recentDirectories` is handed down already computed
 * (`state/recent-directories.ts#buildRecentNewTabDirectories`, from the SAME session evidence the
 * lateral's own "Recent" section and the Sessions tab already use) — this component only renders
 * them, it never derives anything itself.
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX, RefObject, TargetedEvent } from 'preact';
import styles from './NewTabPopover.module.css';
import { cx } from '../../../components/css-class.js';
import { Popover } from '../../../components/Popover/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { Button } from '../../../components/Button/index.js';
import { TextField } from '../../../components/TextField/index.js';
import { SegmentedControl } from '../../../components/SegmentedControl/index.js';
import { getSeeyaApi } from '../../../ipc/client.js';
import { MESSAGES } from '../../../../text/messages.js';
import { shortenDirectoryPath } from '../../../../sidebar/directory-label.js';
import {
  NEW_TAB_KINDS,
  NEW_TAB_KIND_LABEL,
  resolveNewTabCommand,
  type NewTabKind,
} from '../../../../tabs/new-tab-kind.js';

export interface NewTabPopoverProps {
  readonly id: string;
  readonly open: boolean;
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly recentDirectories: readonly string[];
  readonly onClose: () => void;
  readonly onOpenTab: (command: string, args: readonly string[], cwd: string) => void;
}

const KIND_OPTIONS = NEW_TAB_KINDS.map((kind) => ({
  value: kind,
  label: NEW_TAB_KIND_LABEL[kind],
  id: `new-tab-kind-${kind}`,
}));

function RecentDirectories(props: {
  readonly dirs: readonly string[];
  readonly onPick: (dir: string) => void;
}) {
  if (props.dirs.length === 0) {
    return null;
  }
  return (
    <Stack gap="xs">
      <span class={cx(styles, 'recentLabel')}>{MESSAGES.newTabRecentDirectoriesLabel}</span>
      <Stack direction="horizontal" gap="xs" wrap>
        {props.dirs.map((dir) => (
          <Button
            key={dir}
            type="button"
            variant="secondary"
            size="sm"
            title={dir}
            onClick={() => props.onPick(dir)}
          >
            {shortenDirectoryPath(dir)}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

export function NewTabPopover(props: NewTabPopoverProps): JSX.Element {
  const [kind, setKind] = useState<NewTabKind>('claude');
  const [otherCommand, setOtherCommand] = useState('');
  const [directory, setDirectory] = useState('');

  // Starts fresh every time the popover opens — never remembers the last tab's own choices,
  // same "no surprise" spirit every confirmation dialog in this window already follows.
  useEffect(() => {
    if (props.open) {
      setKind('claude');
      setOtherCommand('');
      setDirectory('');
    }
  }, [props.open]);

  function handleSubmit(event: TargetedEvent<HTMLFormElement>): void {
    event.preventDefault();
    props.onOpenTab(resolveNewTabCommand(kind, otherCommand), [], directory.trim());
    props.onClose();
  }

  async function handleBrowse(): Promise<void> {
    const result = await getSeeyaApi().pickDirectory();
    if (!result.canceled) {
      setDirectory(result.path);
    }
  }

  return (
    <Popover
      id={props.id}
      open={props.open}
      anchorRef={props.anchorRef}
      onRequestClose={props.onClose}
    >
      <form id="new-tab-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <p class={cx(styles, 'heading')}>{MESSAGES.newTabPopoverHeading}</p>
          <SegmentedControl
            ariaLabel={MESSAGES.newTabKindGroupLabel}
            value={kind}
            options={KIND_OPTIONS}
            onChange={(value) => setKind(value as NewTabKind)}
          />
          {kind === 'other' && (
            <TextField
              id="new-tab-other-command"
              label={MESSAGES.newTabOtherCommandLabel}
              placeholder={MESSAGES.newTabOtherCommandPlaceholder}
              value={otherCommand}
              onInput={setOtherCommand}
            />
          )}
          <Stack direction="horizontal" gap="sm" align="end">
            <div class={cx(styles, 'directoryField')}>
              <TextField
                id="new-tab-directory"
                label={MESSAGES.newTabDirectoryLabel}
                placeholder={MESSAGES.newTabDirectoryPlaceholder}
                value={directory}
                onInput={setDirectory}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => void handleBrowse()}>
              {MESSAGES.newTabBrowseButton}
            </Button>
          </Stack>
          <RecentDirectories dirs={props.recentDirectories} onPick={setDirectory} />
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button
              id="new-tab-popover-cancel"
              type="button"
              variant="secondary"
              onClick={props.onClose}
            >
              {MESSAGES.newTabCancelButton}
            </Button>
            <Button id="new-tab-popover-open" type="submit" variant="primary">
              {MESSAGES.newTabOpenButton}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Popover>
  );
}
