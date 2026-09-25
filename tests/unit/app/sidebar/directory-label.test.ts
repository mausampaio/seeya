import { describe, expect, it } from 'vitest';
import { shortenDirectoryPath } from '../../../../packages/app/src/sidebar/directory-label.js';

describe('shortenDirectoryPath', () => {
  it('a short Windows path that fits whole is returned unchanged', () => {
    expect(shortenDirectoryPath('C:\\code\\seeya', 32)).toBe('C:\\code\\seeya');
  });

  it('a short POSIX path that fits whole is returned unchanged', () => {
    expect(shortenDirectoryPath('/code/seeya', 32)).toBe('/code/seeya');
  });

  it('a path exactly at the length budget is returned unchanged (boundary)', () => {
    const path = 'x'.repeat(32);
    expect(shortenDirectoryPath(path, 32)).toBe(path);
  });

  it('a long Windows path keeps the distinguishing tail, ellipsis-prefixed', () => {
    const path = 'C:\\ProvaSeeya\\projetos\\um-nome-de-diretorio-bem-comprido-mesmo';
    const result = shortenDirectoryPath(path, 32);

    expect(result.length).toBe(32);
    expect(result.startsWith('…')).toBe(true);
    expect(path.endsWith(result.slice(1))).toBe(true);
  });

  it('a long POSIX path keeps the distinguishing tail, ellipsis-prefixed', () => {
    const path = '/home/<usuario>/projetos/um-nome-de-diretorio-bem-comprido-mesmo';
    const result = shortenDirectoryPath(path, 32);

    expect(result.length).toBe(32);
    expect(result.startsWith('…')).toBe(true);
    expect(path.endsWith(result.slice(1))).toBe(true);
  });

  it('a long path with no separator at all still shortens cleanly', () => {
    const path = 'a'.repeat(50);
    const result = shortenDirectoryPath(path, 32);

    expect(result).toBe(`…${'a'.repeat(31)}`);
    expect(result.length).toBe(32);
  });

  it('respects a custom maxLength', () => {
    const path = 'C:\\code\\seeya\\packages\\app\\src';
    expect(shortenDirectoryPath(path, 10).length).toBe(10);
  });

  it('the default maxLength applies when omitted', () => {
    const path = 'C:\\'.padEnd(60, 'x');
    expect(shortenDirectoryPath(path).length).toBe(32);
  });
});
