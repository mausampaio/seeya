/**
 * One paragraph per line, into a container element — the shape every multi-line dialog body in
 * this package needs (`adopt-flow-view.ts`'s own launch/commit explanations,
 * `project-leftover-changes-confirm-dialog-view.ts`'s own question). Pulled out of
 * `adopt-flow-view.ts` (V2-T34 production defect, PO review 2026-09-25) so a second dialog needing
 * the same shape doesn't duplicate it (AGENTS.md § "Nada de duplicação").
 */
export function renderDialogLines(containerId: string, lines: readonly string[]): void {
  const container = document.getElementById(containerId) as HTMLElement;
  container.textContent = '';
  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    container.appendChild(paragraph);
  }
}
