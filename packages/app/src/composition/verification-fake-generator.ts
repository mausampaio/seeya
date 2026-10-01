/**
 * V2-T69 — a `HandoffGenerator` that never calls the model, for the one screenshot script this
 * project's own process documents (`docs/FLUXO-DE-AGENTES.md`'s own warning against a REAL window
 * spawning a REAL `claude -p`): End day's "em andamento"/"resultado" views
 * (`renderer/features/end-day/`) need the REAL `endDay()` pipeline to run end to end — discovery,
 * eligibility, evidence gathering, the per-session progress events — but the person asking for
 * this screenshot never asked a real model anything, so no real, billed call should ever happen.
 *
 * **Only ever wired by `electron/main.ts`'s own `SEEYA_APP_VERIFY_END_DAY_FAKE`**, via
 * `BuildAppContextOverrides.leanGenerator`/`deepGenerator` (`composition/index.ts`) — every real
 * window omits both and gets the real `LeanHandoffGenerator`/`DeepHandoffGenerator`. Fixture
 * content, not production behavior: the understanding/pending/plan text below names itself as a
 * fixture so nobody mistakes it for a real capture.
 *
 * **`delayMs` via `clock.sleep` (D-019), never a raw `setTimeout`** — same discipline
 * `main.ts#captureVerificationScreenshot`'s own docstring already states for this exact category
 * of verification-only code. The delay exists so a screenshot taken a few seconds into a real run
 * (sequential, `captureConcurrency: 1` in the fixture's own `config.json`) can land mid-flight,
 * with one session already `captured`, one `capturing`, and the rest still `waiting` —
 * `docs/INTERFACE.md` § 6 item 2's own three states, provably distinct in one frame.
 */
import type { Clock, HandoffGenerator } from '@seeya-ai/engine/core/ports.js';
import type { DiscoveredSession, GeneratedUnderstanding } from '@seeya-ai/engine/core/types.js';

export class VerificationFakeHandoffGenerator implements HandoffGenerator {
  constructor(
    private readonly clock: Clock,
    private readonly delayMs: number,
  ) {}

  /** `facts` (D-013's own multi-source evidence) is unused — this fixture's own text never varies
   * by what the real evidence found, so the real `HandoffGenerator` signature's second parameter
   * is simply omitted here (TypeScript allows an implementation to take fewer parameters than the
   * interface it satisfies, since every real caller still only ever passes what the interface
   * declares). */
  async generate(session: DiscoveredSession): Promise<GeneratedUnderstanding> {
    await this.clock.sleep(this.delayMs);
    return {
      understanding:
        `(Verification fixture, V2-T69 — never a real model call.) ${session.name} was being ` +
        'worked on; this text exists only to prove the end-day dialog renders structured data.',
      pendingItems: ['Fixture pending item — not real work.'],
      tomorrowPlan: ['Fixture plan item — not real work.'],
    };
  }
}
