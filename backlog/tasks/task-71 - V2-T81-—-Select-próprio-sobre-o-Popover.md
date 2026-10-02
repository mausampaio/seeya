---
id: TASK-71
title: V2-T81 — Select próprio sobre o Popover
status: To Do
assignee: []
created_date: '2026-10-02 13:23'
labels:
  - ui
dependencies: []
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Achado do mantenedor (2026-10-02, instalador 08:55, filtros da aba Sessions): a seta do Select fica colada na borda direita e a lista que abre tem outro visual (fundo azul do sistema, sem tokens nem fontes). Causa: renderer/components/Select/ é só um <select> nativo estilizado — a seta e a lista são desenhadas pelo Chromium/SO, fora do alcance do CSS. O Snooze já não usa Select: virou Button + ChevronDownIcon abrindo o Menu do design system (V2-T75), então hoje há dois jeitos de escolher uma opção num menu, com visuais diferentes. Correção: refazer o Select sobre a mesma base do Snooze — gatilho no estilo do botão do Snooze (seta com respiro, mesmo padding/tamanho), lista no Popover com o visual do Menu, a opção atual marcada, largura da lista >= largura do gatilho, title nas opções que trazem caminho encurtado. Acessibilidade de select: role listbox/option, aria-expanded/aria-activedescendant ou foco gerenciado, setas, Home/End, Enter/Espaço, Esc fecha e devolve o foco ao gatilho, digitar para pular (typeahead), clique fora fecha. Mesma API pública (id, label, value, options, disabled, monospace, onChange) — os chamadores (SessionsFilters, CwdChangeNotice) não mudam. Se Menu e Select tiverem lógica de lista em comum, extrair uma vez só (nada de duplicação). Testes renderizados de abrir/fechar/teclado/seleção. Capturas reais nos dois temas: filtros da Sessions fechados e abertos, Resume in da Today aberto, e o menu do Snooze lado a lado para provar o mesmo visual.
<!-- SECTION:DESCRIPTION:END -->
