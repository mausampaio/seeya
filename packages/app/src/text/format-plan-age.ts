/**
 * The Today tab's own plan-age suffix (PO review of V2-T66, third round) — "(today)" for same-day,
 * "(1 day ago)" singular, "(N days ago)" plural otherwise. The earlier version
 * (`daysAgo === 1 ? '' : ' (N days ago)'`) read as the literal "(0 days ago)" for a same-day plan
 * — the defect this fixes — and silently dropped the suffix for `daysAgo === 1` instead of saying
 * "(1 day ago)".
 *
 * **Deliberately NOT `core/consolidated-plan.ts#renderRelativeAge`, and not a defect there
 * either.** That function backs `seeya start-day`'s own title (`renderTitle`, Q-026) with a
 * DIFFERENT, already-correct and already-decided wording — no suffix at all for `daysAgo === 1`
 * ("yesterday is the ordinary case", Q-026's own words) and a dash-prefixed "— today"/"— 3 weeks
 * ago" for everything else. The two were never shared code, so fixing this one doesn't touch the
 * CLI, and the CLI never had this defect in the first place.
 *
 * @example
 * formatPlanAge(0) // 'today'
 * formatPlanAge(1) // '1 day ago'
 * formatPlanAge(2) // '2 days ago'
 */
export function formatPlanAge(daysAgo: number): string {
  if (daysAgo === 0) {
    return 'today';
  }
  return `${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`;
}
