import type { Handoff } from '@seeya-ai/engine/core/types.js';

/** A minimal, valid `Handoff` (`adapters/storage/handoff-schema.ts`'s real shape) for tests in
 * `tests/unit/app/**` that need one — shared instead of duplicated per test file (AGENTS.md
 * "nada de duplicação"), same reasoning `tests/integration/resumption/_fixtures.ts` already
 * follows for its own fixtures. */
export function buildHandoffFixture(overrides: Partial<Handoff> = {}): Handoff {
  return {
    sessionId: 'session-1',
    cwd: '/projects/alpha',
    name: 'alpha',
    capturedAt: new Date('2026-08-15T21:00:00.000Z'),
    sessionState: 'ended',
    capturedDuringActiveTurn: false,
    source: 'model',
    captureMode: 'lean',
    sources: ['registry'],
    facts: {
      lastActivity: null,
      lastPrompts: [],
      assistantMessages: [],
      touchedFiles: [],
      git: [],
      filesOutsideRepository: null,
      reposNotVisited: null,
    },
    understanding: 'Was refactoring the parser.',
    pendingItems: [],
    tomorrowPlan: [],
    generationError: null,
    ...overrides,
  };
}
