/**
 * The window's own text for a rejected `CHANNELS.createProject` response (V2-T30 item 4) — pulled
 * out of `electron/new-project-dialog-view.ts` (PO review, 2026-09-25: "mapeamento de resultado
 * para o que a tela mostra" belongs in a tested module, not inline in the DOM file) so the mapping
 * from `CreateProjectResponse` to what the dialog shows has its own test, same split
 * `state/project-open-result.ts`/`state/adopt-session-result.ts` already draw for their own
 * result types.
 */
import type { CreateProjectResponse } from '../ipc/channels.js';

/**
 * Only ever called for the two rejection kinds — a `created` response closes the dialog instead
 * of asking this function for anything (D-024: this function's own input type says so, no
 * `created` branch to accidentally forget).
 *
 * @example
 * formatCreateProjectErrorText({ kind: 'alreadyExists', projectId: 'auth-hardening' })
 * // 'Project "auth-hardening" already exists.'
 */
export function formatCreateProjectErrorText(
  response: Extract<CreateProjectResponse, { readonly kind: 'invalidId' | 'alreadyExists' }>,
): string {
  return response.kind === 'invalidId'
    ? `"${response.projectId}" is not a valid project id — use lowercase letters, digits and ` +
        'hyphens only.'
    : `Project "${response.projectId}" already exists.`;
}
