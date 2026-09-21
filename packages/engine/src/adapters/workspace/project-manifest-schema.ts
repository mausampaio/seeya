/**
 * Each project's `seeya.json` (`core/ports.ts#WorkspaceRepository`, V2-T27, `docs/V2-RUMO.md` §
 * "Vários repositórios"). Same discipline `adapters/storage/config-schema.ts` already follows for
 * `Config`: `schemaVersion` lives only in the on-disk document, never on `ProjectManifest` itself
 * (`core/types.ts`); this module is the one place that knows the field name mapping between the
 * two.
 *
 * **Tolerant of unknown fields (D-021), strict on the ones it uses.** `.passthrough()` on both the
 * manifest and each `repositories`/`trackers` entry — a person hand-editing `seeya.json` (the
 * rumo's own expectation: this file is meant to be read and edited, not only written by `seeya`)
 * can add a field this build doesn't know about yet without `seeya project show` refusing to read
 * the rest of the file.
 */
import { z } from 'zod';
import type { AssociatedRepository, ProjectManifest, ProjectTracker } from '../../core/types.js';

/** Current `schemaVersion` for a project's `seeya.json`. Passed to `resolveSchemaVersion` by the
 * adapter (`index.ts`) before this module ever sees the document. */
export const PROJECT_MANIFEST_SCHEMA_VERSION = 1;

const repositoryIdentitySchema = z
  .object({
    host: z.string().min(1),
    owner: z.string().min(1),
    repository: z.string().min(1),
  })
  .passthrough();

/**
 * V2-T28: `remote`/`identity` are both nullable now — `hasRemote: false`
 * (`core/types.ts#AssociatedRepositoryWithoutRemote`) serializes as `remote: null, identity:
 * null`. `.refine()` below is the one cross-field rule zod's own object shape can't express: an
 * `identity` without a `remote` would be a fact this schema has no source for (D-025 applied to
 * the schema itself, not just the type) — every REAL document this project ever writes already
 * satisfies it; this only guards a hand-edited `seeya.json` (the rumo's own expectation that the
 * file is meant to be edited, this module's own top comment).
 */
const associatedRepositorySchema = z
  .object({
    name: z.string().min(1),
    remote: z.string().min(1).nullable(),
    identity: repositoryIdentitySchema.nullable().optional(),
  })
  .passthrough()
  .refine((value) => value.remote !== null || (value.identity ?? null) === null, {
    message: 'identity must be null when remote is null',
    path: ['identity'],
  });

const projectTrackerSchema = z
  .object({
    type: z.string().min(1),
    project: z.string().min(1),
    labels: z.array(z.string()).optional(),
  })
  .passthrough();

const projectManifestDocumentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    defaultHarness: z.string().min(1).nullable(),
    repositories: z.array(associatedRepositorySchema),
    trackers: z.array(projectTrackerSchema),
  })
  .passthrough();

function toAssociatedRepository(
  raw: z.infer<typeof associatedRepositorySchema>,
): AssociatedRepository {
  if (raw.remote === null) {
    return { hasRemote: false, name: raw.name };
  }
  return { hasRemote: true, name: raw.name, remote: raw.remote, identity: raw.identity ?? null };
}

/** The inverse of `toAssociatedRepository` — what `serializeProjectManifestDocument` writes for
 * one `repositories` entry. */
function serializeAssociatedRepository(repository: AssociatedRepository): Record<string, unknown> {
  return repository.hasRemote
    ? { name: repository.name, remote: repository.remote, identity: repository.identity }
    : { name: repository.name, remote: null, identity: null };
}

function toProjectTracker(raw: z.infer<typeof projectTrackerSchema>): ProjectTracker {
  return raw.labels === undefined
    ? { type: raw.type, project: raw.project }
    : { type: raw.type, project: raw.project, labels: raw.labels };
}

/** Parses `raw` (the document, already past `resolveSchemaVersion`) into a `ProjectManifest` —
 * throws with the field path on any mismatch (AGENTS.md § "Mensagens de erro"), never silently
 * drops or invents a value. */
export function parseProjectManifestDocument(raw: unknown): ProjectManifest {
  const result = projectManifestDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`seeya.json is malformed: ${z.prettifyError(result.error)}`);
  }
  const { id, name, defaultHarness, repositories, trackers } = result.data;
  return {
    id,
    name,
    defaultHarness,
    repositories: repositories.map(toAssociatedRepository),
    trackers: trackers.map(toProjectTracker),
  };
}

/** What `FsWorkspaceRepository#writeProjectSkeleton`/`writeProjectManifest` write for
 * `seeya.json`. */
export function serializeProjectManifestDocument(
  manifest: ProjectManifest,
): Record<string, unknown> {
  return {
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    id: manifest.id,
    name: manifest.name,
    defaultHarness: manifest.defaultHarness,
    repositories: manifest.repositories.map(serializeAssociatedRepository),
    trackers: manifest.trackers,
  };
}
