import { describe, expect, it } from 'vitest';
import {
  CalendarIcon,
  ChatBalloonIcon,
  ChevronLeftIcon,
  ClockIcon,
  CloseIcon,
  FolderIcon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  StopIcon,
  TerminalIcon,
} from '../../../../packages/app/src/ui/icons.js';
import { propsOf } from './_vnode.js';

interface SvgProps {
  readonly viewBox: string;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly stroke: string;
}

describe('outline icons (identity § 6.4 — outline, never mixed with fill)', () => {
  const outlineIcons = [
    CalendarIcon,
    FolderIcon,
    ChatBalloonIcon,
    PlusIcon,
    ChevronLeftIcon,
    ClockIcon,
    SettingsIcon,
    TerminalIcon,
    CloseIcon,
  ];

  it('every outline icon is drawn on the 24-unit grid with no fill and a rounded stroke', () => {
    for (const Icon of outlineIcons) {
      const props = propsOf<SvgProps>(Icon());
      expect(props.viewBox).toBe('0 0 24 24');
      expect(props.fill).toBe('none');
      expect(props.stroke).toBe('currentColor');
    }
  });

  it('defaults to 16px, overridable by size', () => {
    expect(propsOf<SvgProps>(CalendarIcon()).width).toBe(16);
    expect(propsOf<SvgProps>(CalendarIcon({ size: 24 })).width).toBe(24);
    expect(propsOf<SvgProps>(CalendarIcon({ size: 24 })).height).toBe(24);
  });
});

describe('filled icons (play/stop — the one conventionally-filled pair, never mixed with an outline version)', () => {
  it('PlayIcon/StopIcon fill with currentColor and carry no stroke', () => {
    for (const Icon of [PlayIcon, StopIcon]) {
      const props = propsOf<SvgProps>(Icon());
      expect(props.fill).toBe('currentColor');
      expect(props.stroke).toBe('none');
    }
  });
});

describe('StarIcon (V2-T63 correction — outline by default, brand-coloured fill only when favorited)', () => {
  it('outline, inheriting the surrounding text colour, when not favorited', () => {
    const props = propsOf<SvgProps>(StarIcon());
    expect(props.fill).toBe('none');
    expect(props.stroke).toBe('currentColor');
  });

  it('filled with the brand colour — never yellow/orange — when favorited', () => {
    const props = propsOf<SvgProps>(StarIcon({ filled: true }));
    expect(props.fill).toBe('var(--seeya-brand-text)');
    expect(props.stroke).toBe('var(--seeya-brand-text)');
  });
});
