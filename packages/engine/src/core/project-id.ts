/**
 * V2-T27: `projectId` validation (`docs/PLANO-DE-ENTREGA.md`'s own words, fixed in AGENTS.md's
 * glossary before this file existed: "identificador do projeto → `projectId` (o nome do
 * diretório, minúsculas e hífens)"). A `projectId` becomes a real directory name inside the
 * workspace (`WorkspaceRepository.writeProjectSkeleton`, `adapters/workspace/`), so this is the
 * one gate that keeps a stray value — empty string, uppercase, a path separator, `..` — from ever
 * reaching a filesystem call.
 *
 * Pure and in `core/` on purpose: `application/workspace.ts#createProject`/`showProject` both need
 * this check before touching any port, and a validation rule with no I/O of its own belongs here,
 * not duplicated in each caller.
 */
const PROJECT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * @example
 * isValidProjectId('auth-hardening'); // true
 * isValidProjectId('Auth Hardening'); // false — uppercase and a space
 * isValidProjectId('../escape');      // false — not even close to the pattern
 */
export function isValidProjectId(projectId: string): boolean {
  return PROJECT_ID_PATTERN.test(projectId);
}
