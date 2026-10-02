/**
 * V2-T70 — wraps a real `WorkspaceRepository` so its `commitAll` always throws, for the one
 * screenshot that proves the adoption review dialog's own failure result
 * (`renderer/features/adoption/`, `docs/INTERFACE.md` § 7 item 3 — "nunca fechando em silêncio").
 * A real workspace git hook refusing the commit would need a project already in a specific
 * conflicting state to trigger on demand; a thrown `commitAll` is the simpler, equally honest way
 * to reach the SAME `AdoptSessionResult`'s own `commitFailed` branch
 * (`application/project-adopt-outcome.ts#commitAdoption`'s own `catch`), without staging any of
 * that setup.
 *
 * A `Proxy`, not a hand-written delegate of all ~20 `WorkspaceRepository` methods — every method
 * but `commitAll` passes straight through to the real adapter, so this never drifts out of sync
 * with the port as it grows.
 *
 * **Only ever wired by `main/main.ts`'s own `SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE`**, via
 * `BuildAppContextOverrides.workspace` — every real window omits it and gets the real
 * `FsWorkspaceRepository` untouched.
 */
import type { WorkspaceRepository } from '@seeya-ai/engine/core/ports.js';

export function wrapWorkspaceWithFailingCommit(
  real: WorkspaceRepository,
  reason: string,
): WorkspaceRepository {
  return new Proxy(real, {
    get(target, propertyKey, receiver): unknown {
      if (propertyKey === 'commitAll') {
        return () => Promise.reject(new Error(reason));
      }
      return Reflect.get(target, propertyKey, receiver) as unknown;
    },
  });
}
