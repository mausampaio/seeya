import { describe, expect, it } from 'vitest';
import { shouldRegisterProtocolScheme } from '../../../../packages/app/src/composition/protocol-registration-eligibility.js';

describe('shouldRegisterProtocolScheme (V2-T57)', () => {
  it('registers when there is no SEEYA_APP_HOME_OVERRIDE — the installed app, or npm run app', () => {
    expect(shouldRegisterProtocolScheme(undefined)).toBe(true);
  });

  it('never registers when SEEYA_APP_HOME_OVERRIDE is set — a verification window', () => {
    expect(shouldRegisterProtocolScheme('/tmp/fixture-home')).toBe(false);
  });
});
