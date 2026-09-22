/**
 * Pure normalization of a git remote URL into a `RepositoryIdentity` (V2-T28,
 * `docs/V2-RUMO.md` § "A identidade é canônica"). No I/O, no `node:*` — this is the function
 * `application/repository-association.ts#addRepository` calls on whatever
 * `GitReader.readRemoteUrl` handed back, and the one `tests/unit/core/repository-identity.test.ts`
 * exercises directly against known and unknown URL shapes.
 */
import type { RepositoryIdentity } from './types.js';

/**
 * `git@host:owner/repo.git` (or any `user@host:path`, no `://`) — the scp-like shorthand every
 * SSH remote uses. Deliberately requires the `user@` prefix: without it, `host:path` is
 * indistinguishable from a Windows drive-letter path typed as a "remote" by mistake, and
 * `isWindowsDriveLetter` below only catches the single-letter case, not every other possible
 * local path shape.
 */
const SCP_LIKE_PATTERN = /^[^@\s]+@([^\s:/]+):(?!\/\/)(.+)$/;

/** `scheme://[user[:pass]@]host[:port]/path` — `https://`, `http://`, `ssh://`, `git://`, and
 * anything else shaped like a URL. `host` never includes a port; the path always starts right
 * after the first `/`. */
const SCHEME_URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^@/\s]+@)?([^/\s:]+)(?::\d+)?\/(.+)$/;

function isWindowsDriveLetter(candidate: string): boolean {
  return /^[A-Za-z]$/.test(candidate);
}

/** The last path segment is the repository name (minus a trailing `.git`); everything before it,
 * joined back with `/`, is the owner — deliberately not just "the second-to-last segment": a
 * self-hosted provider with nested groups (GitLab-style) has more than one segment before the
 * repository, and treating the whole prefix as `owner` is what
 * `docs/PLANO-DE-ENTREGA.md` V2-T28 calls "normalização conservadora" — the same algorithm for
 * every provider, known or not, rather than a special case per host. */
function splitOwnerAndRepository(pathPart: string): { owner: string; repository: string } | null {
  const segments = pathPart
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return null;
  }
  const last = segments[segments.length - 1] as string;
  const repository = last.endsWith('.git') ? last.slice(0, -4) : last;
  const owner = segments.slice(0, -1).join('/');
  if (repository === '' || owner === '') {
    return null;
  }
  return { owner, repository };
}

/**
 * Derives `{ host, owner, repository }` from a raw remote URL — `null` when the URL has no
 * recognizable host/path shape at all (a bare local filesystem path, most commonly). `host` is
 * lowercased (hostnames are case-insensitive); `owner`/`repository` keep the case the URL used,
 * since the two forms of the SAME remote (SSH and HTTPS) always agree on that case already.
 *
 * @example
 * normalizeRepositoryIdentity('git@host:acme-widgets/app-api.git')
 * // { host: 'host', owner: 'acme-widgets', repository: 'app-api' }
 * normalizeRepositoryIdentity('https://host/acme-widgets/app-api.git')
 * // same identity as above — SSH and HTTPS compare equal
 * normalizeRepositoryIdentity('./local-only-repo') // null — no host to derive
 */
export function normalizeRepositoryIdentity(remoteUrl: string): RepositoryIdentity | null {
  const trimmed = remoteUrl.trim();
  if (trimmed === '') {
    return null;
  }
  const schemeMatch = SCHEME_URL_PATTERN.exec(trimmed);
  if (schemeMatch !== null) {
    const host = schemeMatch[1] as string;
    const split = splitOwnerAndRepository(schemeMatch[2] as string);
    return split === null ? null : { host: host.toLowerCase(), ...split };
  }
  const scpMatch = SCP_LIKE_PATTERN.exec(trimmed);
  if (scpMatch !== null) {
    const host = scpMatch[1] as string;
    if (isWindowsDriveLetter(host)) {
      // A Windows absolute path (a drive letter, a colon, then a backslash-separated path)
      // matches the scp-like shape syntactically (a single "host" character, a colon, a path)
      // but is a local path someone passed by mistake, not a remote — see this module's own
      // pattern comment.
      return null;
    }
    const split = splitOwnerAndRepository(scpMatch[2] as string);
    return split === null ? null : { host: host.toLowerCase(), ...split };
  }
  return null;
}

/** Structural equality — every field, no case-folding beyond what `normalizeRepositoryIdentity`
 * already applied to `host` (owner/repository already compare case-sensitively there). */
export function repositoryIdentitiesEqual(a: RepositoryIdentity, b: RepositoryIdentity): boolean {
  return a.host === b.host && a.owner === b.owner && a.repository === b.repository;
}
