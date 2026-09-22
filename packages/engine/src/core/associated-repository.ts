/**
 * Pure duplicate detection for `ProjectManifest.repositories` (V2-T28) —
 * `application/repository-association.ts#addRepository`'s own "adicionar o mesmo repositório
 * duas vezes não duplica" (`docs/PLANO-DE-ENTREGA.md`).
 */
import type { AssociatedRepository, RepositoryIdentity } from './types.js';
import { repositoryIdentitiesEqual } from './repository-identity.js';

/**
 * `repositories` already has an entry for `candidate` when either: both carry the same
 * `identity` (the strong signal — two local clones of the same remote, added under different
 * local directory names, are still the same repository), or an existing entry's `name` matches
 * `candidateName` (the only signal available at all when neither side has an identity — two
 * repositories without a remote can only be told apart by the label `add-repo` gave them).
 *
 * @example
 * findAssociatedRepository(
 *   [{ hasRemote: true, name: 'api', remote: 'git@h:o/r.git', identity: { host: 'h', owner: 'o', repository: 'r' } }],
 *   'app-api',
 *   { host: 'h', owner: 'o', repository: 'r' },
 * ) // the existing entry — same identity, different local folder name
 */
export function findAssociatedRepository(
  repositories: readonly AssociatedRepository[],
  candidateName: string,
  candidateIdentity: RepositoryIdentity | null,
): AssociatedRepository | null {
  return (
    repositories.find((existing) => {
      if (
        candidateIdentity !== null &&
        existing.hasRemote &&
        existing.identity !== null &&
        repositoryIdentitiesEqual(existing.identity, candidateIdentity)
      ) {
        return true;
      }
      return existing.name === candidateName;
    }) ?? null
  );
}
