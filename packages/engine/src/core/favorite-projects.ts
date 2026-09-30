/**
 * Per-machine favorite projects (V2-T63, `docs/INTERFACE.md` § 1 item 3) — pure decision over
 * `favorite-projects.json`'s own `projectIds` (AGENTS.md § "Identificadores que vão para disco").
 * A favorite is a preference about how THIS window's lateral looks, never a fact about the
 * project itself (it never touches `seeya.json`, D-025: starring a project on one machine says
 * nothing about any other).
 */

/**
 * @example
 * toggleFavoriteProjectId(['billing'], 'auth-hardening', true); // ['billing', 'auth-hardening']
 * toggleFavoriteProjectId(['billing', 'auth-hardening'], 'billing', false); // ['auth-hardening']
 */
export function toggleFavoriteProjectId(
  ids: readonly string[],
  projectId: string,
  favorite: boolean,
): readonly string[] {
  const set = new Set(ids);
  if (favorite) {
    set.add(projectId);
  } else {
    set.delete(projectId);
  }
  return [...set];
}
