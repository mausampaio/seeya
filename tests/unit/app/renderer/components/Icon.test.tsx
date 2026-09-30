// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
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
} from '../../../../../packages/app/src/renderer/components/Icon/index.js';

afterEach(cleanup);

function renderedSvg(node: ComponentChildren): SVGSVGElement {
  const { container } = render(node);
  return container.firstElementChild as SVGSVGElement;
}

describe('outline icons (D-052, V2-T75 — real render; identity § 6.4)', () => {
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
      const svg = renderedSvg(<Icon />);
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      cleanup();
    }
  });

  it('defaults to 16px, overridable by size', () => {
    expect(renderedSvg(<CalendarIcon />).getAttribute('width')).toBe('16');
    cleanup();
    const sized = renderedSvg(<CalendarIcon size={24} />);
    expect(sized.getAttribute('width')).toBe('24');
    expect(sized.getAttribute('height')).toBe('24');
  });
});

describe('filled icons (D-052, V2-T75 — play/stop, never mixed with an outline version)', () => {
  it('PlayIcon/StopIcon fill with currentColor and carry no stroke', () => {
    for (const Icon of [PlayIcon, StopIcon]) {
      const svg = renderedSvg(<Icon />);
      expect(svg.getAttribute('fill')).toBe('currentColor');
      expect(svg.getAttribute('stroke')).toBe('none');
      cleanup();
    }
  });
});

describe('StarIcon (V2-T63 correction — outline by default, brand-coloured fill only when favorited)', () => {
  it('outline, inheriting the surrounding text colour, when not favorited', () => {
    const svg = renderedSvg(<StarIcon />);
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it('filled with the brand colour — never yellow/orange — when favorited', () => {
    const svg = renderedSvg(<StarIcon filled />);
    expect(svg.getAttribute('fill')).toBe('var(--seeya-brand-text)');
    expect(svg.getAttribute('stroke')).toBe('var(--seeya-brand-text)');
  });
});
