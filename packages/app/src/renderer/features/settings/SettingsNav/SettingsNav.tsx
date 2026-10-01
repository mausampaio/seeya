/**
 * D-052 (V2-T65, `docs/INTERFACE.md` § 8): the dialog's own left-hand section navigation — one
 * `NavItem` per `SettingsNavSection`, built on the SAME design-system component the lateral
 * already uses for its own navigation rows, never a second, hand-rolled list.
 *
 * @example
 * <SettingsNav active={activeSection} onSelect={onSelectSection} />
 */
import type { ComponentType, JSX } from 'preact';
import styles from './SettingsNav.module.css';
import { cx } from '../../../components/css-class.js';
import { NavItem } from '../../../components/NavItem/index.js';
import {
  CameraIcon,
  ClockIcon,
  CompassIcon,
  FolderIcon,
  type IconProps,
  SettingsIcon,
  TerminalIcon,
} from '../../../components/Icon/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import type { SettingsNavSection } from '../useSettings.js';

// The ICON COMPONENT itself (never a pre-built `<Icon/>` element) — a module-level `JSX.Element`
// constant would be the SAME vnode object reused across every mount of this component (this
// module loads once); Preact's own internal bookkeeping on a vnode (`_dom`, once mounted) makes
// reusing one across independent render trees corrupt the SECOND one silently (confirmed by a
// real test failure: a second `<SettingsDialog/>` mount in the same suite rendered the dialog's
// title and nothing else). Instantiating fresh inside `.map()` below avoids that entirely.
const SECTIONS: readonly {
  readonly id: SettingsNavSection;
  readonly Icon: ComponentType<IconProps>;
}[] = [
  { id: 'general', Icon: SettingsIcon },
  { id: 'schedule', Icon: ClockIcon },
  // PO review (V2-T65): Capture used to share SettingsIcon's own path (nudged coordinates only,
  // close enough to read as the same icon as General right above it) — a camera is genuinely
  // distinct, see CameraIcon's own docstring.
  { id: 'capture', Icon: CameraIcon },
  { id: 'discovery', Icon: CompassIcon },
  { id: 'terminal', Icon: TerminalIcon },
  { id: 'projects', Icon: FolderIcon },
];

export interface SettingsNavProps {
  readonly active: SettingsNavSection;
  readonly onSelect: (section: SettingsNavSection) => void;
}

export function SettingsNav(props: SettingsNavProps): JSX.Element {
  return (
    <nav class={cx(styles, 'nav')} aria-label={MESSAGES.settingsDialogTitle}>
      {SECTIONS.map((section) => (
        <NavItem
          key={section.id}
          id={`settings-nav-${section.id}`}
          icon={<section.Icon />}
          label={MESSAGES.settingsSectionLabels[section.id]}
          active={props.active === section.id}
          onClick={() => props.onSelect(section.id)}
        />
      ))}
    </nav>
  );
}
