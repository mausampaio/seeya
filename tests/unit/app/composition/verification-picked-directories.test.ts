import { describe, expect, it } from 'vitest';
import { createVerificationDirectoryPicker } from '../../../../packages/app/src/composition/verification-picked-directories.js';

describe('createVerificationDirectoryPicker (V2-T83)', () => {
  it('unset or empty means "no stand-in": the real dialog opens', () => {
    expect(createVerificationDirectoryPicker(undefined)).toBeNull();
    expect(createVerificationDirectoryPicker('')).toBeNull();
    expect(createVerificationDirectoryPicker('||')).toBeNull();
  });

  it('answers each call with the next folder, then repeats the last one', () => {
    const next = createVerificationDirectoryPicker('/code/a|/code/b');
    expect(next?.()).toBe('/code/a');
    expect(next?.()).toBe('/code/b');
    expect(next?.()).toBe('/code/b');
  });

  it('a single folder is returned every time', () => {
    const next = createVerificationDirectoryPicker('C:\\code\\repo');
    expect(next?.()).toBe('C:\\code\\repo');
    expect(next?.()).toBe('C:\\code\\repo');
  });
});
