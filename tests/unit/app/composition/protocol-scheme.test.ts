import { describe, expect, it } from 'vitest';
import { resolveProtocolScheme } from '../../../../packages/app/src/composition/protocol-scheme.js';

describe('resolveProtocolScheme (V2-T10 item 1)', () => {
  it('packaged builds register the plain "seeya" scheme', () => {
    expect(resolveProtocolScheme(true)).toBe('seeya');
  });

  it('unpackaged dev launches register "seeya-dev" — never the same scheme as a packaged build', () => {
    expect(resolveProtocolScheme(false)).toBe('seeya-dev');
  });
});
