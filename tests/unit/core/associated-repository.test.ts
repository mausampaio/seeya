/**
 * `findAssociatedRepository` (V2-T28, `packages/engine/src/core/associated-repository.ts`) —
 * `docs/PLANO-DE-ENTREGA.md` V2-T28 item 1: "Adicionar o mesmo repositório duas vezes não
 * duplica; diz que já estava."
 */
import { describe, expect, it } from 'vitest';
import { findAssociatedRepository } from '@seeya-ai/engine/core/associated-repository.js';
import type { AssociatedRepository } from '@seeya-ai/engine/core/types.js';

const IDENTITY = { host: 'host', owner: 'acme-widgets', repository: 'app-api' };
const EXISTING_WITH_REMOTE: AssociatedRepository = {
  hasRemote: true,
  name: 'api',
  remote: 'git@host:acme-widgets/app-api.git',
  identity: IDENTITY,
};
const EXISTING_WITHOUT_REMOTE: AssociatedRepository = { hasRemote: false, name: 'legacy-scripts' };

describe('findAssociatedRepository', () => {
  it('finds a duplicate by identity even when the local folder name (candidateName) differs', () => {
    const found = findAssociatedRepository(
      [EXISTING_WITH_REMOTE],
      'a-different-local-name',
      IDENTITY,
    );
    expect(found).toBe(EXISTING_WITH_REMOTE);
  });

  it('finds a duplicate by name when neither side has an identity', () => {
    const found = findAssociatedRepository([EXISTING_WITHOUT_REMOTE], 'legacy-scripts', null);
    expect(found).toBe(EXISTING_WITHOUT_REMOTE);
  });

  it('does not match a with-remote existing entry to a candidate with a different identity, even if the name matches', () => {
    const otherIdentity = { ...IDENTITY, repository: 'app-web' };
    const found = findAssociatedRepository(
      [EXISTING_WITH_REMOTE],
      'a-different-local-name',
      otherIdentity,
    );
    expect(found).toBeNull();
  });

  it('matches by name as a fallback even when the candidate has no identity to compare', () => {
    const found = findAssociatedRepository([EXISTING_WITH_REMOTE], 'api', null);
    expect(found).toBe(EXISTING_WITH_REMOTE);
  });

  it('null when nothing matches', () => {
    expect(findAssociatedRepository([], 'api', IDENTITY)).toBeNull();
  });
});
