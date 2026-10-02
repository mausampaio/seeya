---
id: TASK-71
title: V2-T81 — Select próprio sobre o Popover
status: Review
assignee: []
created_date: '2026-10-02 13:23'
updated_date: '2026-10-02 18:28'
labels:
  - ui
dependencies: []
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Achado do mantenedor (2026-10-02, instalador 08:55, filtros da aba Sessions): a seta do Select fica colada na borda direita e a lista que abre tem outro visual (fundo azul do sistema, sem tokens nem fontes). Causa: renderer/components/Select/ é só um <select> nativo estilizado — a seta e a lista são desenhadas pelo Chromium/SO, fora do alcance do CSS. O Snooze já não usa Select: virou Button + ChevronDownIcon abrindo o Menu do design system (V2-T75), então hoje há dois jeitos de escolher uma opção num menu, com visuais diferentes. Correção: refazer o Select sobre a mesma base do Snooze — gatilho no estilo do botão do Snooze (seta com respiro, mesmo padding/tamanho), lista no Popover com o visual do Menu, a opção atual marcada, largura da lista >= largura do gatilho, title nas opções que trazem caminho encurtado. Acessibilidade de select: role listbox/option, aria-expanded/aria-activedescendant ou foco gerenciado, setas, Home/End, Enter/Espaço, Esc fecha e devolve o foco ao gatilho, digitar para pular (typeahead), clique fora fecha. Mesma API pública (id, label, value, options, disabled, monospace, onChange) — os chamadores (SessionsFilters, CwdChangeNotice) não mudam. Se Menu e Select tiverem lógica de lista em comum, extrair uma vez só (nada de duplicação). Testes renderizados de abrir/fechar/teclado/seleção. Capturas reais nos dois temas: filtros da Sessions fechados e abertos, Resume in da Today aberto, e o menu do Snooze lado a lado para provar o mesmo visual.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Select rebuilt as a trigger button (role=combobox, same box as the Snooze button: padding, radius, border, arrow with a gap, label truncated) plus a Popover listbox (role=listbox/option, aria-selected, CheckIcon on the current one, list >= trigger width via Popover.matchAnchorWidth, max-height with inner scroll). Same public API; no caller changed. Popover gained matchAnchorWidth and returnFocusToAnchor (data-return-focus=anchor, which legacy/dialog-focus-return.ts skips so Esc returns focus to the trigger, not the terminal). Extracted renderer/hooks/useRovingFocus.ts (arrows by default, homeEnd/typeahead opt-in) now used by Menu (behaviour unchanged) and Select. Typeahead has no timer (D-019): the prefix buffer resets by the gap between event timeStamps (800ms), on any navigation key and on every open. Tests adapted (they used the native select): SessionsFilters.test.tsx, CwdChangeNotice.test.tsx; main.ts instrumentation (captureSessionsTabStatesVerification used select.value/options) now picks options through the listbox. AdoptionDialog PickPane: id shown without brackets. New instrumentation SEEYA_APP_VERIFY_SELECT_STATES_DIR (AGENTS.md). Visual proof (real window, both themes, real key events): scratchpad t81/shots-light and shots-dark, 7 captures each plus focus-after-escape.txt (sessions-filter-project) and 04-focused-element.txt. Verificar: first run failed only on the known eslint guard timeouts, second run green.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: claude
created: 2026-10-02 18:28
---
PO review round 1: Select gained fullWidth (used by CwdChangeNotice; Resume in trigger now 1116px of a 1140px notice at 1500px, label untruncated). Sessions table: fixed Id 100, State 160, Last activity 174, action 200; Name/Directory/Project flexible (measured 191px each at 1500px, 90.7px each at 1200px, table = container, no horizontal overflow). Width guard test rewritten for the rule. No BrowserWindow minWidth exists: at 1000px the three flexible columns collapse to 24px (padding only), still no horizontal scroll; suggest a minimum window width (about 1200) as a separate decision. Captures: scratchpad t81 shots-light/shots-dark (1500px: 01, 05, sessions-table-metrics.json, resume-in-metrics.json) and narrow-light/narrow-dark (1200px). Verificar green first run.
---
<!-- COMMENTS:END -->
