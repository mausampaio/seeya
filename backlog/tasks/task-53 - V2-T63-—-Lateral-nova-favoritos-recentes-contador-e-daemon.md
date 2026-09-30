---
id: TASK-53
title: 'V2-T63 — Lateral nova: favoritos, recentes, contador e daemon'
status: Review
assignee: []
created_date: '2026-09-30 10:33'
updated_date: '2026-09-30 19:00'
labels: []
milestone: m-2
dependencies:
  - TASK-52
type: feature
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 1 (ordem de entrega, item 2), sobre a fundação da V2-T62 (D-051). Inclui os favoritos por máquina (nome em disco no glossário antes do código) e a pílula do daemon com iniciar/parar. Tira da lateral o painel de status em texto, a busca por id e Other sessions — só depois que as aba Sessions (V2-T68) e o rodapé cobrirem o que eles mostravam; até lá, o que ainda não tem casa nova fica. Custo de desempenho dito na entrega (docs/DESEMPENHO.md).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Entrega.** Itens do escopo na branch `tarefa/V2-T63-lateral-nova` (commits sobre `main`
`c1f43a4`). `npm run verificar` verde (exit 0), rodado duas vezes — 302 arquivos de teste, 2999
passando + 4 puladas (pré-existentes); cobertura agregada 96,23% statements / 91,91% branches /
95,11% functions / 96,47% lines.

**1. Lateral (`docs/INTERFACE.md` § 1).** `packages/app/src/electron/app-shell.tsx` — logo (dois
SVGs empacotados, `packages/app/assets/logo/`, trocados por CSS `[data-theme='dark']`, sem JS);
cartão Today (`#today-card`, `state/today-panel.ts#buildTodayCardSummary` — "Plan for `<dia>`" +
"N to resume", ou "Nothing to resume" sem contador); Favorites (`electron/sidebar-favorites-view.ts`
+ `state/sidebar-summary.ts#buildFavoriteProjectRows` — estrela, badge `open here`/`locked`/nada,
sessões recuadas só quando o projeto está aberto NESTA janela — `matchedTabId` batendo com uma
aba); Recent (`buildRecentProjectRows`, até 5, nunca repetindo favorito — fonte da última
atividade: a MESMA `ProjectPanelSessionRow.lastActivity` evidence-based que toda lista de sessão
já usa, nunca uma leitura nova; projeto sem sessão com evidência de atividade simplesmente não
aparece, D-025); "All projects"/"Sessions" com contador (`countRunningSessions`, `alive`/`idle`)
abrindo a aba de página correspondente; rodapé (agenda + `Snooze ▾` agora um `<select>` em vez de
três botões sempre visíveis, lado a lado com `Skip today` mesma largura; `End day…`; a pílula do
daemon — texto agora é o FATO, "Daemon running"/"Daemon stopped"/"Daemon: cannot verify", nunca
mais a ação — `components.css#seeya-status-pill-button` + `daemon-control-view.ts#setPillTone`).

**Sai da lateral:** painel de status em texto (`electron/status-panel-view.ts` apagado; `main.ts`
segue computando/empurrando `CHANNELS.statusUpdate` sem ouvinte nenhum — decidi não tocar em
`main.ts` para não arriscar os comentários de medição que várias linhas próximas carregam por uma
limpeza cosmética; fica registrado como resto pequeno para quem tocar aquele arquivo depois),
busca por id e Other sessions (foram para a aba Sessions, ver item 2). Autostart continua onde
estava (footer) — `docs/INTERFACE.md` só move para Settings na V2-T65. `#settings-button` migrou
para o canto direito da barra de abas (seção 2 já diz onde ele fica) — realocação de uma linha,
não o redesenho completo da barra (ainda V2-T64).

**2. Mecanismo de aba de página.** `packages/app/src/tabs/page-tab.ts` (`PageTabKind`) +
`electron/page-tab-strip.ts#openOrFocusPageTab` — reusa a MESMA barra de abas/mesmo registro de
painéis dos terminais: `electron/tabs-view.ts` ganhou `registerPane`/`unregisterPane` (cobrindo
`.terminal-pane` e `.page-pane`) e `showTab` virou exportada, único lugar que decide o que está
visível em `#main`, terminal ou página. Conforme o refinamento do PO: "All projects"/"Sessions"
(e, por consistência/simplicidade, também o cartão Today) abrem abas cujo conteúdo é EXATAMENTE
o que a lateral mostrava antes desta tarefa — `#projects-list`/`#project-open-result-text`,
`#other-sessions-list`/`#session-search-*`, `#today-panel` só mudaram de lugar no DOM (agora
dentro de `#page-projects`/`#page-sessions`/`#page-today`, filhos estáticos de `#terminal-host`),
nunca de forma — `state/projects-panel.ts`, `electron/projects-list-view.ts`,
`electron/session-search-view.ts`, `electron/today-panel-view.ts`,
`electron/other-sessions-dir-dialog-view.ts` não mudaram de comportamento. A V2-T66 troca só o
CONTEÚDO da aba Today.

**3. Favoritos por máquina.** Nome fixado no glossário do `AGENTS.md` antes do código:
`favorite-projects.json` / `projectIds` (schemaVersion 1), raiz de `~/.seeya/`. Porta existente
(`Storage`, sem porta nova): `readFavoriteProjectIds`/`saveFavoriteProjectIds`
(`packages/engine/src/core/ports.ts`), implementada em `adapters/storage/index.ts` sobre
`favorite-projects-schema.ts` (D-022: não validado item a item — mesma razão de
`adoption-registry-schema.ts`, cada entrada só vem de um clique do próprio app). Decisão pura
`core/favorite-projects.ts#toggleFavoriteProjectId`. Leitura tolerante: arquivo ausente = lista
vazia (D-025), nunca erro. Estrela funciona nos dois lugares que mostram um projeto — a lateral
(`sidebar-favorites-view.ts`) e a linha da aba Projects (`projects-list-view.ts#triggerFavoriteToggle`)
— as duas chamando a IPC nova `toggleFavoriteProject` (`ipc/channels.ts`, handler em
`electron/project-ipc.ts`), que grava e reempurra `projectsUpdate` (única fonte de verdade
re-lida a cada push, nunca cacheada — um clique em qualquer janela some/aparece no próximo tick).

**4. Achado da V2-T62 corrigido.** `electron/renderer.ts#suppressInitialFocusRing` — um `blur()`
único, no primeiro evento nativo `focus` da própria `window` (o momento em que o `webContents`
ganha foco do SO e o Chromium move o foco DOM para o primeiro elemento focável, o botão de
recolher a lateral) — nunca bloqueia `:focus-visible` de verdade depois disso.

**5. Desempenho (D-051/`docs/DESEMPENHO.md`).** Medido com `measure-startup.mjs`/
`measure-idle.mjs`, desta vez já como A/B na MESMA sessão (`main` `c1f43a4` construído numa
segunda worktree descartável via `git worktree add --detach`, removida ao final — a lição da
Q-096/Q-099). (a) e (c) ficam dentro da faixa de `main` medida na mesma sessão — sem indício de
custo novo. (b) inconclusivo (D-025): a maior parte das janelas medidas cai dentro da faixa de
`main` (inclusive uma segunda rodada desta branch quase idêntica à de `main`), com um único valor
fora dela que não se repetiu numa segunda rodada — registrado como ruído desta sessão, não como
custo persistente, sem forçar um veredito que duas rodadas não sustentam. (d) não medido —
`npm run dist:windows` já foi recusado pelo classificador de permissão na V2-T62 pelo mesmo
motivo ("Production Deploy"); não repeti a tentativa. Números completos e o raciocínio em
`docs/DESEMPENHO.md` § "V2-T63 — antes/depois".

**Registro/`~/.seeya` reais:** confirmados intocados antes e depois de toda a sessão de medição
(chave `HKCU\Software\Classes\seeya-dev` e hash de `protocol-handler.json` idênticos nos dois
momentos) — toda janela de verificação usou `SEEYA_APP_HOME_OVERRIDE`/`SEEYA_APP_OFFSCREEN`
(os próprios scripts de medição já isolam os dois, confirmado antes de rodar).

**Recusas registradas, não contornadas:** `GIT_CONFIG_GLOBAL=... npm test` (guarda de worktree,
"git operations must target its own worktree" — pedido explícito do despacho; a suíte equivalente
já rodou dentro de `npm run verificar`'s própria `cobertura`, cobrindo o mesmo terreno).

**Testes:** 302 arquivos (30 novos entre unit/integration), 2999 passando + 4 puladas
(pré-existentes, não desta tarefa) — novos: `tests/unit/core/favorite-projects.test.ts`,
`tests/integration/storage/favorite-projects.test.ts`, `tests/unit/app/tabs/page-tab.test.ts`,
`tests/unit/app/state/sidebar-summary.test.ts`, mais casos novos em `projects-panel.test.ts`
(campo `favorite`) e `today-panel.test.ts` (`buildTodayCardSummary`). `electron/*.ts` continua
fora do piso de cobertura (não roda sem display, mesma exceção de sempre) — toda lógica nova que
não é DOM puro está em `core/`/`state/`/`tabs/`, testada.

**Pendências/questões abertas:** nenhuma questão nova aberta em `docs/QUESTOES.md` — as decisões
de detalhe tomadas nesta tarefa (fonte do "Recent", Snooze como `<select>`, texto da pílula do
daemon como fato, Settings realocado para a barra de abas) ficam registradas aqui e no glossário,
dentro do que a spec já autorizava ou deixava como escolha de implementação. `main.ts` continua
empurrando `CHANNELS.statusUpdate` para ninguém ouvir — resto pequeno, não coberto por esta
tarefa (ver item "Sai da lateral" acima).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-30 17:02
---
Refinamento do PO em 2026-09-30, antes do despacho: as abas Projects e Sessions (V2-T67/V2-T68) ainda não existem. Nesta tarefa, 'All projects' e 'Sessions' já abrem ABAS de página (o mecanismo de aba de página entra aqui, reusável pelo Today na V2-T66), e o conteúdo delas é o que a lateral mostra hoje (lista de projetos com Open; Other sessions por diretório + busca por id), sem redesenho — o redesenho em tabela é da V2-T67/V2-T68. Assim nada some da janela. O painel de status em texto sai; o que ele mostrava de útil já está no rodapé (agenda, daemon) — o resto, se faltar, vira questão. Inclui o achado da V2-T62: anel de foco visível no botão de recolher ao abrir a janela. 'Recent' é derivado de evidência (D-025) — o agente justifica a fonte da última atividade de cada projeto.
---

author: PO
created: 2026-09-30 18:06
---
Revisão do PO em 2026-09-30: mesclado, portão verde (2999 testes) e também sem identidade global do git (rodado pelo PO). Conferido: lateral da seção 1 com Today, Favorites (favorite-projects.json por máquina, glossário antes do código), Recent derivado da última atividade das sessões do projeto (sem evidência, fora — D-025), All projects/Sessions abrindo abas de página com o conteúdo atual (redesenho na V2-T67/V2-T68), rodapé com agenda, Snooze, Skip today, End day e pílula do daemon; autostart continua no rodapé até a V2-T65. Desempenho medido em A/B na mesma sessão, sem custo. Resto pequeno anotado: main.ts ainda calcula statusUpdate sem ouvinte (entra na V2-T51). Falta o aceite do mantenedor com o instalador.
---

author: agente
created: 2026-09-30 19:00
---
Correção do aceite (2026-09-30), branch tarefa/V2-T63-lateral-correcao a partir de main a192fe0, commits f307495 e 8ec4754. Capturas da janela real (SEEYA_APP_HOME_OVERRIDE + SEEYA_APP_OFFSCREEN, tema claro e escuro, 2 projetos/1 favorito/sessoes com atividade) confirmaram e corrigiram os 8 itens do aceite: (1) lateral virou uma coluna so (sidebar-main envolve header/content/footer, antes eram 3 itens de um flex row); (2) faixa violeta de altura inteira removida, recolher agora e um botao ghost pequeno no cabecalho + Ctrl+B, reabrir e sempre pelo botao da barra de abas (capturado tambem o estado recolhido, sem nenhum resto visivel); (3) New project virou icone + so com aria-label; (4) FAVORITES/RECENT sem uppercase, 12px peso 500; (5) cartao Today: icone + Today + pilula N to resume na primeira linha, Plan for <dia legivel> na segunda -- a causa raiz era a funcao de formatacao do card reusando a formula (0 days ago) da pagina Today cheia; state/today-panel.ts#formatTodayCardDayLabel e nova, so para o card, com teste cobrindo today/yesterday/weekday; (6) All projects/Sessions viraram linhas com icone + rotulo + contador/pilula a direita, com destaque quando a aba correspondente esta aberta (electron/tabs-view.ts#onActiveTabChanged); (7) pilula do daemon: ponto + rotulo a esquerda, botao de icone start/stop a direita; (8) estados vazios de Favorites/Recent em texto terciario 11px. npm run verificar verde (302 arquivos, 3002 passando, 4 puladas pre-existentes). Registro do Windows (HKCU\Software\Classes\seeya-dev) e hash de protocol-handler.json reais conferidos identicos antes/depois de toda a sessao de captura. Capturas salvas no scratchpad da sessao do agente (caminho passado ao mantenedor fora deste arquivo, por ser especifico da maquina): v2t63-correction-dark.png, ...-light.png e ...-collapsed.png (estado recolhido, sem faixa).
---
<!-- COMMENTS:END -->
