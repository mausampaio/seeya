/**
 * D-047 item 6, pure: "compara o transcript da cópia com o momento da adoção (`adoptedAt`): se ela
 * cresceu depois, avisa, diz quanto, e só apaga com confirmação explícita." `adoptions.json` never
 * stored a size at adoption time (V2-T29 shipped before this task existed, and reshaping that
 * schema for a single derived fact would be a bigger, riskier change than this comparison needs) —
 * so "cresceu" is read off the transcript's own last-write time against `adoptedAt`, the one
 * instant this task already has on hand. Since a transcript is append-only, a last-write strictly
 * AFTER `adoptedAt` can only mean something was appended after the adoption was accepted; there is
 * no need for a stored baseline size to know that much (docs/QUESTOES.md Q-095 has the full
 * reasoning, including what this deliberately does NOT measure: a byte-for-byte "how much bigger").
 */
import type { ForkActivityCheck } from './ports.js';

/**
 * D-025 applied to a growth check: `unknown` (the transcript couldn't even be found) is its own
 * case, never folded into `unchanged` — an absent file is not evidence that nothing changed, and
 * `application/project-revert-adoption.ts` treats it exactly like `grew` (ask before deleting,
 * default answer "keep") rather than the one case that skips the question.
 */
export type AdoptedCopyGrowth =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'grew'; readonly lastWrite: Date; readonly sizeBytes: number }
  | { readonly kind: 'unknown' };

/**
 * @example
 * decideAdoptedCopyGrowth(
 *   { kind: 'found', lastWrite: new Date('2026-09-24T12:00:00Z'), sizeBytes: 4096 },
 *   new Date('2026-09-24T10:00:00Z'),
 * )
 * // { kind: 'grew', lastWrite: ..., sizeBytes: 4096 }
 */
export function decideAdoptedCopyGrowth(
  check: ForkActivityCheck,
  adoptedAt: Date,
): AdoptedCopyGrowth {
  if (check.kind === 'notFound') {
    return { kind: 'unknown' };
  }
  if (check.lastWrite.getTime() > adoptedAt.getTime()) {
    return { kind: 'grew', lastWrite: check.lastWrite, sizeBytes: check.sizeBytes };
  }
  return { kind: 'unchanged' };
}
