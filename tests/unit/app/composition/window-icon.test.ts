import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveWindowIconPath,
  WINDOW_ICON_FILE_NAME,
} from '../../../../packages/app/src/composition/window-icon.js';

describe('resolveWindowIconPath (V2-T11 item 2)', () => {
  it('joins the given dist/electron directory with the packaged icon file name', () => {
    expect(resolveWindowIconPath(path.join('some', 'dist', 'electron'))).toBe(
      path.join('some', 'dist', 'electron', WINDOW_ICON_FILE_NAME),
    );
  });

  it('names the 256px PNG — electron-builder’s own recommended minimum for a non-icns raster icon', () => {
    expect(WINDOW_ICON_FILE_NAME).toBe('256x256.png');
  });
});
