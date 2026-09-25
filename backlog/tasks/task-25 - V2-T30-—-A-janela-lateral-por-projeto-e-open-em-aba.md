---
id: TASK-25
title: 'V2-T30 — A janela: lateral por projeto e open em aba'
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-25 03:35'
labels: []
milestone: m-0
dependencies:
  - TASK-23
  - TASK-26
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T30 — A janela por projeto: lateral por projeto, recolhível, `open` em aba e adotar pela
lista.** Especificada pelo PO em 2026-09-24, com os dois requisitos que o mantenedor disse que não
esperam (comentário de 2026-09-24): **projetos como foco da listagem** e **a lateral recolhível**. O
resto da interface pode continuar provisório. Absorve a **V2-T48** (barras de rolagem).

**Por quê agora:** o mantenedor precisa usar o seeya no dia a dia, e a dor é sessão perdendo
memória. Projetos (V2-T27/T28), lock (V2-T33/T35), adoção (V2-T29) e desfazer (V2-T32) já existem na
CLI; esta tarefa leva o caminho principal para a janela.

**O que entra:**

1. **Projetos no topo da lateral.** Uma seção **Projects**, antes de tudo, com cada projeto do
   espaço de trabalho (`application/workspace.ts#listProjects`): nome, estado do lock (livre, ou
   "held by session <id>" com o mesmo texto de `core/project-lock-message.ts`), as sessões que
   pertencem a ele, e a ação **Open**. Uma sessão pertence a um projeto **só** por evidência
   (D-025): o `cwd` dela é o diretório do projeto (comparação por `core/cwd-normalization.ts`), ou
   ela é a cópia registrada em `adoptions.json` para aquele projeto, ou ela é a dona do lock dele.
   Nunca por repositório associado — um repositório pode servir a mais de um projeto. As sessões que
   não pertencem a projeto nenhum ficam numa seção **Other sessions**, abaixo. Hoje, Status e o
   resto continuam, abaixo dos projetos.
2. **A lateral recolhe.** Um botão sempre visível alterna entre aberta e recolhida; recolhida, o
   terminal ocupa a largura toda e **se reajusta** (linhas e colunas recalculadas — é o mesmo
   defeito do item 1 da V2-T48). O estado é lembrado entre aberturas do app. É preferência de
   visualização, não configuração: não vai para `config.json`; `localStorage` do renderer serve, com
   leitura protegida (sem valor, abre aberta).
3. **`open` numa aba.** **Open** chama o mesmo `openProject` da CLI com um lançador que abre o
   harness numa aba embutida (irmão do `TabSessionResumer`, implementando `HarnessLauncher` sobre o
   `PtyManager`): diretório do projeto, `--add-dir` dos repositórios, `--session-id` gerado,
   `--append-system-prompt` com o aviso do lock. Com o projeto travado por outra sessão viva, a
   janela mostra o aviso e **pede confirmação num diálogo** antes de abrir (o mesmo texto e as mesmas
   três respostas da V2-T35). A aba leva o nome do projeto. Ao fechar a aba, o lock é solto e a
   janela mostra, curto, como ele ficou. **O pid gravado no lock é o do processo principal do app** —
   o equivalente, aqui, ao processo da CLI que fica bloqueado durante o `open` (Q-087 item 3 previa
   rever isto quando o `open` deixasse de bloquear): vivo enquanto o app vive, morto se o app cair,
   e então o lock fica velho e é retomável.
4. **Novo projeto.** Um botão **New project…** na seção Projects (nome → `createProject`), que é
   também o que a adoção usa para "adotar num projeto novo".
5. **Adotar pela lista.** Cada sessão em **Other sessions** que pode ser adotada ganha **Adopt…**;
   sessão viva mostra a ação desabilitada com o motivo (a adoção recusa sessão viva). O fluxo é o da
   CLI, na janela: escolher projeto existente ou novo → o **mesmo bloco de explicação** da V2-T29
   (onde a cópia abre e por quê, onde fica o projeto, e o `project open` para depois), num diálogo
   que espera a pessoa → a cópia abre numa **aba**, no diretório original da sessão → ao fechar a
   aba, o diálogo com os arquivos que mudaram no projeto e "commitar?" → o resultado, com um botão
   **Open project** quando a adoção foi aceita.
6. **As barras de rolagem da V2-T48**, os dois itens: a janela nunca tem barra de rolagem própria
   (cada região rola o seu conteúdo), o terminal se reajusta em **qualquer** mudança de tamanho
   (inclusive a primeira maximização e o recolher da lateral), e o bloco de status quebra linha
   longa, inclusive dentro de caminho.

**Regras de construção:**

- **Texto dito pela CLI e pela janela mora num lugar só.** O que hoje está em `packages/cli/src/
  format-project.ts` e a janela precisa dizer igual (a explicação da adoção, a pergunta do commit)
  sai de `cli/` para um módulo que os dois alcancem — o mesmo movimento que a V2-T35 fez com o aviso
  do lock (`core/project-lock-message.ts`). `app/` e `cli/` continuam sem se importar (D-043).
- **`renderer.ts` e `main.ts` não crescem.** Os dois já passam de mil linhas, contra o teto de 500
  do `AGENTS.md`. O que esta tarefa acrescenta entra em módulos novos e testados (a lógica em
  `sidebar/`/`state/`, puros; a fiação o mínimo necessário). Dividir o que já existe **não** é desta
  tarefa — vira tarefa própria.
- **Nenhuma operação destrutiva na janela.** `remove`, `remove-repo`, `revert-adoption` e `add-repo`
  continuam só na CLI nesta tarefa.
- **Custo (régua do `docs/DESEMPENHO.md`):** a lista de projetos é lida na subida e depois de cada
  ação de projeto; o estado do lock e o `adoptions.json` são lidos no ciclo de 10 s que já existe
  (um arquivo pequeno por projeto). Remedir subida e repouso pelo método do documento e registrar o
  antes/depois no relatório.

**O que não entra:** as operações destrutivas acima; qualquer harness além do `claude`; mudar a
posse do daemon; a V2-T49 (clique no aviso do Linux); dividir `renderer.ts`/`main.ts`.

**Aceite do mantenedor:** abrir o app e ver os projetos no topo, cada um com as suas sessões e o
estado do lock; recolher a lateral, fechar e reabrir o app, e ela continuar recolhida, com o terminal
na largura toda; **Open** de um projeto abre numa aba, e o lock mostra a sessão; com o projeto aberto
também pela CLI, o **Open** da janela mostra o aviso e pergunta; criar um projeto de teste pela
janela e adotar nele uma sessão sem importância pela lista, aceitando o commit, e **Open project**
abrir o projeto; e a primeira maximização sem barra de rolagem nenhuma.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementado (absorve a V2-T48, itens 1-2, junto):

**Item 1 — Projects no topo.** `sidebar/project-sessions.ts#groupSessionsByProject` (pura) casa
sessão↔projeto só por evidência (cwd normalizado, `AdoptionRecord.forkSessionId`, `sessionId` do
lock — nunca por repositório associado, nunca a original de uma adoção); `state/projects-panel.ts
#buildProjectsPanelData` junta isso ao `ProjectLockStatus` de cada projeto (texto pronto:
"unlocked" / "held by session X (pid N) since ..." / "stale — ... (reclaimable)"). Sessões sem
projeto caem em "Other sessions". `electron/project-ipc.ts#wireProjectIpc` lê `listProjects`/
`readAdoptions`/um `.seeya-lock` por projeto a cada ciclo de 10s (reusa o `SidebarRow[]` que o
ciclo já calcula, sem segunda descoberta) e depois de cada ação de projeto; `CHANNELS.
getProjectsPanel` (invoke) cobre a PRIMEIRA pintura — achado medindo com uma janela real
descartável: o primeiro tick do laço ambiente dispara antes do renderer terminar de carregar e
registrar `onProjectsUpdate`, perdendo esse primeiro push (mesmo mecanismo de `getTodayPanel`/
`onTodayUpdate`).

**Item 2 — lateral recolhível.** `state/sidebar-collapse.ts` (parse protegido: sem valor ou
malformado abre aberta, D-025) + `electron/project-panel-view.ts#wireSidebarCollapse` (localStorage
do renderer, nunca `config.json`). O botão fica sempre visível, mesmo recolhida.

**Item 3 — `open` em aba, sem bloquear a janela.** `resume/project-tab-launcher.ts
#ProjectOpenTabLauncher` implementa `HarnessLauncher` reusando o `TabResumeOpener` que a V2-T4 já
tem (mesmo mecanismo de montar aba para um pty já lançado, nunca resume-específico). `electron/
project-ipc.ts` chama o MESMO `openProject` da engine, com `SUPPORTED_HARNESS` ('claude') sempre
passado explicitamente (o app não escolhe harness) e o pid/procStart do PRÓPRIO processo principal
do app (Q-087 item 3), resolvidos uma vez e cacheados (`AppContext#resolveProcessIdentity`,
lazy — nunca no startup, para não pesar a medida (a) com o custo do `powershell.exe` que a CLI já
mediu). O handler nunca é esperado pelo clique: a aba aparece via o mesmo push `resumeTabOpened`
já existente; só o texto curto de "como ficou" espera a promise (`state/project-open-result.ts`).
Lock read-only pede confirmação por diálogo (mesmo texto de `core/project-lock-message.ts
#renderReadOnlyOpenQuestion`, extraído do `cli/format-project.ts` sem mudar a saída da CLI).

**Item 4 — Novo projeto.** Diálogo simples (`projectId` só, como a CLI) → `createProject` real,
refresh imediato do painel.

**Item 5 — Adotar pela lista.** `resume/project-tab-launcher.ts#ProjectAdoptTabLauncher`
(`SessionAdoptionLauncher`); `state/adopt-panel.ts` é a máquina de estados do fluxo (picker →
launch confirm → [aba do fork abre e fecha] → commit confirm → resultado com "Open project") —
**o diálogo fecha entre a resposta do launch confirm e o próximo push**, de propósito: um
`<dialog>` modal bloquearia a própria aba que a pessoa precisa usar. Texto da explicação e da
pergunta do commit vêm de `core/project-adoption-message.ts` (novo módulo, movido de
`cli/format-project.ts`, mesma saída da CLI preservada — `renderAdoptionLaunchConfirmation`/
`renderAdoptionCommitConfirmation` da CLI agora chamam essas funções).

**Item 6 (V2-T48).** `#status-panel` ganhou `overflow-wrap: anywhere` (quebra dentro do caminho
longo do autostart, texto da CLI inalterado) e `html,body { overflow: hidden }` (nunca barra de
rolagem do documento). `renderer.ts#wireWindowResize` trocou `window.resize` por um
`ResizeObserver` em `#terminal-host` — **medido**: o recolher da lateral nunca dispara `resize` da
janela (é só flexbox), então esse era o único mecanismo capaz de cobrir os dois casos ao mesmo
tempo. Rodei uma instrumentação temporária (removida antes do commit) comparando `resize` ×
`ResizeObserver` em torno de um `maximize()` programático nesta máquina, em modo offscreen: os
dois dispararam quase juntos, já com o tamanho pós-maximização — não reproduziu o defeito do
mantenedor (a mesma ressalva que `docs/DESEMPENHO.md` já registra para o modo offscreen), então o
evento exato que falta na maximização real não foi confirmado por medição direta; o
`ResizeObserver` é a correção de qualquer forma, por ser estritamente pós-layout e por já ser
necessário, sem alternativa, para o item do recolhimento.

**Compartilhamento de texto (regra do enunciado).** `core/project-lock-message.ts` ganhou
`renderReadOnlyOpenQuestion`; novo `core/project-adoption-message.ts` tem
`renderAdoptionLaunchExplanationLines`/`renderAdoptionCommitChangedFilesLines`. `cli/
format-project.ts` só chama essas funções e concatena o sufixo de prompt (`[y/N]` etc.) — saída da
CLI byte-idêntica, testes da CLI passam sem editar texto esperado.

**Linhas de `renderer.ts`/`main.ts`.** `main.ts`: 1116 → 1128 (+12: import, construção de
`projectIpc`, uma chamada no tick). `renderer.ts`: 1381 → 1390 (+9 líquido: import +
`wireProjectPanel()`; removida a função `renderSidebar`/lista plana de sessões, ~24 linhas, e a
função de resize antiga trocada pela versão com `ResizeObserver`). Todo o resto (painel de
projetos, diálogos, IPC dos itens 3/4/5) foi para `electron/project-panel-view.ts` (novo,
~540 linhas) e `electron/project-ipc.ts` (novo, ~280 linhas) — os dois na mesma categoria de
`electron/` já isenta de piso de cobertura (dependem de DOM/Electron reais); a lógica pura ficou em
`sidebar/project-sessions.ts`, `state/projects-panel.ts`, `state/adopt-panel.ts`, `state/
project-open-result.ts`, `state/adopt-session-result.ts`, `state/sidebar-collapse.ts`,
`resume/project-tab-launcher.ts`, `resume/pending-confirmations.ts` — todos testados.

**Desempenho (docs/DESEMPENHO.md), antes (2026-09-20) → depois:**
- (a) tempo até a lista: 5782–5801ms → 5716–5734ms (sem piora).
- (b) memória em repouso: 335,6–338,0 MiB → 345,5–365,3 MiB (acima do teto anterior — Q-096 aberta
  para o mantenedor julgar; suspeita mais provável é código novo carregado sempre, não o custo de
  runtime por projeto, já que a medição rodou com zero projetos).
- (c) CPU ocioso: 0,39%–0,57% → 0,26%–0,34% (melhor, dentro do ruído).

**Prova real (janela descartável, `SEEYA_APP_HOME_OVERRIDE`, offscreen).** Duas sessões sintéticas
(pid morto, nunca um processo real) seedadas à mão num `~/.claude` descartável — uma com `cwd`
igual ao diretório previsto do projeto de teste (prova o agrupamento), outra em diretório não
relacionado (prova "Other sessions"/Adopt). Criei "demo-project" pela janela de verdade, adotei a
sessão não relacionada até o diálogo de confirmação do lançamento e RECUSEI ali (nunca cheguei a
chamar `claude` de verdade — este ambiente tem `claude` no PATH, e resumir um `sessionId` sintético
seria um processo real e desnecessário para provar a UI). Capturas em
`%TEMP%\claude\...\scratchpad\v2t30-screenshots\` (fora do repositório): lateral aberta com os dois
projetos vazios, lateral recolhida, projeto com a sessão agrupada e a outra em "Other sessions",
diálogo de confirmação de adoção (mesmo texto do `core/project-adoption-message.ts`), resultado da
recusa. `~/.seeya` e o espaço de trabalho REAIS conferidos depois: `HEAD`/mtimes do workspace real
inalterados, nenhum `adoptions.json`/`forks.json` novo.

**O que fica para o aceite do mantenedor / fora desta entrega:**
- O fluxo real de `claude` sendo aberto por `Open`/`Adopt` (Proceed) não foi exercido de ponta a
  ponta por este agente — só via os testes unitários dos lançadores (`ProjectOpenTabLauncher`/
  `ProjectAdoptTabLauncher`, args e ciclo de vida da aba) e a reutilização direta do `openProject`/
  `adoptSession` da engine, já testados nas tarefas V2-T28/V2-T29/V2-T33/V2-T35. Evitei deliberado
  spawnar `claude` de verdade nesta verificação (custo real, sem necessidade para provar a UI).
- O aviso de lock lido por OUTRA sessão viva (CLI segurando o lock enquanto a janela tenta abrir)
  não foi provado em coreografia multi-processo — a lógica é a mesma `openProject`/
  `confirmReadOnlyOpen` já testada pela V2-T35; só a costura do diálogo na janela é nova aqui.
- `npm run verificar:linux` não rodou (só o `npm run verificar` do Windows, que passou). CI
  cobre os três sistemas de qualquer forma.
- Glossário do AGENTS.md não ganhou entradas novas para os termos desta tarefa (grupo de sessão
  por projeto, `ProjectOpenTabLauncher`/`ProjectAdoptTabLauncher`, `getProjectsPanel`) — decisão
  de escopo do agente, dado o tamanho já grande da entrega; o mantenedor/PO pode preencher ou pedir
  isso como item separado.
- Q-096 aberta (memória em repouso acima da faixa anterior) — decisão do mantenedor se é aceitável
  ou se vira tarefa de otimização.

`npm run verificar`: verde (build, tipos, lint, `dependency-cruiser`, cobertura — 96,39%
statements geral, `core/` 99,33%, `app/src/state` 98,78%).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-24 17:28
---
Requisitos do mantenedor em 2026-09-24, para entrar na especificação: (1) PROJETOS como foco da listagem — a lateral organiza por projeto, não por sessão solta; (2) a lateral esquerda precisa RECOLHER — hoje ocupa espaço demais da tela. A interface pode continuar provisória no resto; estes dois pontos não esperam. Motivo declarado: ele precisa usar o seeya no dia a dia, e a dor principal hoje são sessões perdendo memória — projetos e adoção são o foco agora. A V2-T48 (barras de rolagem) entra junto com esta.
---

author: dev
created: 2026-09-25 03:35
---
Resposta à revisão do PO de 2026-09-25 (três pontos):

**1. `electron/project-panel-view.ts` (549 linhas) dividido por responsabilidade.** Cinco arquivos
novos, nenhum com decisão própria: `sidebar-collapse-view.ts` (68 linhas, toggle de recolher),
`projects-list-view.ts` (162 linhas, listas Projects/Other sessions + Open), `new-project-dialog-view.ts`
(46 linhas), `project-lock-confirm-dialog-view.ts` (47 linhas), `adopt-flow-view.ts` (281 linhas,
o fluxo inteiro de adoção — mantido junto por ser UMA máquina de estados, não quatro diálogos
independentes). `project-panel-view.ts` agora é um agregador de 29 linhas; o import do `renderer.ts`
não mudou. `electron/project-ipc.ts` ficou em 284 linhas (já estava abaixo do teto, mas revisado
igual).

Lógica que estava escondida em template literals/ternários inline saiu para módulos testados:
`state/create-project-result.ts` (o texto de erro do diálogo "New project"), `state/
adopt-session-result.ts` ganhou `formatSessionNotDiscoverableText`, `state/adopt-picker.ts`
(`resolveChosenAdoptProjectId` — qual `projectId` o rádio/select/input do picker resolveu),
`text/messages.ts` ganhou `projectSessionRowLabel`/`otherSessionRowLabel` (as duas linhas de rótulo
que antes eram template literal direto no código de DOM). Quatro arquivos de teste novos/ampliados
para essas quatro peças.

**2. Glossário do AGENTS.md.** Oito linhas novas na tabela, mesmo formato das vizinhas: agrupamento
de sessão por projeto (`groupSessionsByProject`/`resolveAdoptEligibility`), painel de projetos
(`buildProjectsPanelData`), lateral recolhível (`state/sidebar-collapse.ts`, chave de localStorage
`seeya.sidebarCollapsed`), os dois lançadores de aba (`ProjectOpenTabLauncher`/
`ProjectAdoptTabLauncher`), a máquina de estados do fluxo de adoção (`state/adopt-panel.ts`), o
texto compartilhado da adoção (`core/project-adoption-message.ts`), a pergunta do lock legível
compartilhada (`renderReadOnlyOpenQuestion`), e os canais de IPC novos.

**3. Q-096 refeita como A/B na mesma sessão.** `main` (commit b3d5425, via `git archive` — nunca um
segundo worktree da mesma branch) contra esta branch, três rodadas cada, ALTERNADAS, com zero
projetos e depois com 3 projetos (`seeya project create` × 3, `USERPROFILE` para um diretório
descartável, nunca `HOME`, nunca o `~/.seeya` real), separado por processo (principal/renderer/
GPU/utilitário, via uma variante só-desta-investigação de `process-tree-stats.ps1` lendo o
`CommandLine`/`--type=` de cada pid).

**Resultado: a memória NÃO piorou** — a comparação original (2026-09-20 vs. 2026-09-24) media dois
dias e dois estados de máquina diferentes, não o código desta tarefa; retratada em `docs/QUESTOES.md`.
Nas seis rodadas do A/B, a branch ficou ligeiramente ABAIXO do `main` (~368 MiB vs. ~379 MiB), dentro
do próprio ruído entre rodadas.

**CPU ociosa tem uma diferença real, mas pequena e localizada**: a branch consumiu mais CPU que o
`main` em 5 das 6 rodadas, ~0,1–0,2 pontos percentuais de UM núcleo a mais na média (~0,02% da
máquina inteira de 8 núcleos) — e a diferença mora inteira no processo PRINCIPAL (GPU/utilitário/
renderer saíram estatisticamente iguais nas duas variantes). Bate com o próprio custo que a
especificação já previa e aprovou: `listProjects`/`readAdoptions`/um `.seeya-lock` por projeto a
cada ciclo de 10s, tudo no processo principal. Tabela bruta completa e a leitura, em `docs/
QUESTOES.md` (Q-096, seção "Reaberta").

`npm run verificar` verde depois de tudo isso (96,40% statements geral, `core/` 99,33%, `app/src/
state` 98,81%). Scripts de investigação do A/B (o `.mjs` e a variante do `.ps1`) não foram
commitados — instrumentação de uma medição só, não ferramenta permanente.
---
<!-- COMMENTS:END -->
