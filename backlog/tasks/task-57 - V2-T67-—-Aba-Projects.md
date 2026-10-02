---
id: TASK-57
title: V2-T67 — Aba Projects
status: Review
assignee: []
created_date: '2026-09-30 10:34'
updated_date: '2026-10-02 02:36'
labels: []
milestone: m-2
dependencies:
  - TASK-65
type: feature
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 4 (item 6): tabela com busca, filtros, estrela e a ação que segue o lock (Go to tab / Open / Read only…). Depende dos favoritos da V2-T63.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Branch e commits** (`tarefa/V2-T67-aba-projects`, a partir de `origin/main` em `8442b3e`):
`bedba0f` (modelo de dados — lock/ação/filtros/ordenação), `9fffac6` (TableRow ao padrão D-052),
`b262c14` (tab-select-bridge), `62db7fb` (a aba em si), `beb4591` (split do legado por região),
`a0bffdf` (glossário/questões), `2740723` (instrumentação de verificação).

**Árvore de `renderer/features/projects/`:**
```
Projects.tsx / Projects.module.css / index.ts
useProjects.ts
new-project-dialog-bridge.ts
ProjectsHeader/   (título, contagem, botão "New project")
ProjectsFilters/  (busca + SegmentedControl All/With a running session/Locked, ids estáveis)
ProjectsTable/    (estrela, nome, lock, sessões, repositórios, última atividade, ação)
IgnoredProjectsSection/
NewProjectDialog/ (Dialog reativo — substitui o formulário legado; mesmos campos/validação/IPC)
```

**O que saiu do legado.** `renderer/legacy/projects-list-view.tsx` (apagado) renderizava TRÊS
coisas de um push só: a lista de Projects (agora `<Projects/>`), a lista "Ignored projects" da
LATERAL e a lista "Other sessions" por diretório da aba Sessions — nenhuma das duas últimas é
região desta tarefa nem da V2-T68 ainda. Separado, comportamento idêntico: `renderer/legacy/
projects-panel-cache.ts` (o cache de `ProjectsPanelData` que `adopt-flow-view.ts`/
`other-sessions-dir-dialog-view.ts` ainda usam, e o `triggerProjectOpen` de lá) e `renderer/legacy/
other-sessions-and-ignored-view.ts` (as duas listas que não são minhas). `renderer/legacy/
new-project-dialog-view.ts` e o `<Dialog id="new-project-dialog">` estático de `dialogs-shell.tsx`
também saíram — vira `NewProjectDialog.tsx`, aberto pelo `+` da lateral e pelo botão da própria aba
através do mesmo `new-project-dialog-bridge.ts`. `TableRow`/seu teste antigo por inspeção de vnode
(`_vnode.ts`) saíram junto, substituídos pelo padrão D-052 (CSS module + teste renderizado) — a
Projects tab é a primeira chamadora de produção.

**Campos novos em `state/`:**
- `state/projects-panel.ts`: `ProjectPanelRow.lock` (`ProjectRowLock` — `openHere`/`unlocked`/
  `lockedByOther`, com `resolveProjectRowAction`/`formatProjectRowLockText` como única fonte de
  verdade para texto+ação, nunca duas leituras independentes do mesmo `ProjectLockStatus`),
  `repositoryCount`, `lastActivity`. Um `staleLock` lê como `unlocked` (Q-104 — a spec só nomeia
  três textos, e abrir um lock stale já sucede sem confirmação).
- `state/projects-table.ts` (novo módulo): `buildProjectsTableRows` — filtro
  `all`/`running`/`locked`, busca por substring do nome, ordenação por última atividade mais
  recente primeiro, `null` sempre por último (D-025).
- `renderer/features/tabs/tab-select-bridge.ts` (novo): `selectTab`/`registerTabSelector`, mesmo
  formato de `page-tab-bridge.ts`/`focus-bridge.ts`, para a ação "Go to tab" sem a aba Projects
  importar `TabStrip.tsx` diretamente (fecharia um ciclo que o `dependency-cruiser` recusa).

**Capturas** (todas no scratchpad desta sessão, `<scratchpad>\v2t67\shots\`, fora do repo, nunca commitadas):

| Arquivo | Estado provado |
|---|---|
| `light-00-empty.png` / `dark-00-empty.png` | Lista vazia — `EmptyState` com ação "New project" |
| `<tema>/01-table.png` | Tabela com os três estados de lock juntos — "Payments webhooks" favoritado e `openHere`/"Go to tab" (sessão fictícia com o PID REAL de uma aba shell aberta na própria janela, dobrado no fixture depois do `createTab`, lido pelo ciclo ambiente de 10s); "Api gateway" `Unlocked`/"Open", sem atividade conhecida (`unknown`, nunca uma data inventada); "Billing reconciliation" `Locked by session 33333333`/"Read only…" (processo decoy real, pid de verdade, `ProcessControl.isAlive` positivo) — mais "Ignored projects" com `broken-project` |
| `<tema>/02-search-active.png` | Busca por "payments" — só "Payments webhooks" |
| `<tema>/03-no-match.png` | Busca sem nenhum resultado |
| `<tema>/04-filter-running.png` | Filtro "With a running session" — só a sessão com processo vivo |
| `<tema>/05-filter-locked.png` | Filtro "Locked" — só "Billing reconciliation" |
| `<tema>/06-new-project-dialog.png` | Diálogo "New project" aberto sobre a tabela |

Script de verificação (scratchpad, não commitado): `...\scratchpad\v2t67\verify.mjs` — builda com
`node scripts/build.mjs` (nunca `--dev`), lança `packages/app/dist/electron/main.js` com
`SEEYA_APP_HOME_OVERRIDE` descartável, `SEEYA_APP_OFFSCREEN=1`, `daemon-ownership-transition.json`
pré-respondido `declined`. O estado `openHere` usa o mecanismo já existente (V2-T75 PO review
round 3): `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1` abre uma aba shell real; `SEEYA_APP_VERIFICATION_
TAB_PID_PATH` grava o pid real; o script externo dobra esse pid numa sessão fictícia (`cwd`
apontando para o diretório do projeto — `matchingTabId` só compara pid) antes do próximo ciclo
ambiente. O lock "Billing reconciliation" usa um processo decoy real (`node -e
"setInterval(()=>{},1000)"`), pid de verdade, sem `procStart` (opcional no schema do `.seeya-lock`).
Nova instrumentação em `main.ts`: `SEEYA_APP_VERIFY_PROJECTS_TAB_STATES_DIR` (uma PASTA — a única
captura deste arquivo com mais de dois PNGs), documentada no próprio `main.ts` e em `AGENTS.md`.

**Antes/depois no Windows:** `HKCU:\Software\Classes\seeya` e `\seeya-dev` presentes nos dois
momentos, sem mudança; hash de `~/.seeya/protocol-handler.json` idêntico
(`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`) antes e depois de toda a
sessão de verificação — nenhuma escrita no sistema real (`SEEYA_APP_HOME_OVERRIDE` sempre
definido). Nenhum processo `electron`/decoy sobrou rodando ao final.

**`npm run verificar` do zero** (dist apagado antes): verde — 375 arquivos de teste, 3576 testes
passando (4 pulados, pré-existentes), cobertura 95.86%/91.58%/95.44%/96.05%
(stmts/branch/funcs/lines), `dependency-cruiser` sem violação (nenhum ciclo — o motivo de
`tab-select-bridge.ts` importar o arquivo concreto em vez de `tabs/index.ts`).

**Recusas encontradas:** nenhuma — não precisei contornar nenhuma permissão nem recusa.

**Questões abertas (`docs/QUESTOES.md`):**
- **Q-104** — a spec nomeia só três textos de lock para esta tabela; um `staleLock` (holder morto)
  não tem texto próprio. Decisão mínima: lê como `Unlocked`, já que abrir um lock stale sucede sem
  confirmação (a ação é idêntica à de um projeto livre).
- **Q-105** — a spec não pede nenhum texto de resultado para "Open"/"Read only…" nesta tela
  (diferente do fluxo legado, que escrevia num parágrafo só visível por acaso). Decisão mínima: o
  botão só perde o `loading` quando a promise resolve OU quando a linha já virou `openHere` (sinal
  mais rápido e mais honesto); nenhum texto de resultado novo foi inventado.

Achado secundário, sem efeito no código: a pesquisa inicial sobre fixtures de verificação (feita
por um fork) deu a forma ERRADA do `seeya.json` para um repositório sem remoto
(`{"hasRemote":false,"name":...}` em vez da forma real em disco, `{"name":...,"remote":null,
"identity":null}`, confirmada contra `adapters/workspace/project-manifest-schema.ts`) — só afetou
a fixture da prova visual (corrigido antes da captura final), nenhum código de produção usou a
forma errada.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Claude (agente)
created: 2026-10-02 00:50
---
Revisão do PO, rodada 1: estrutura aprovada (os três estados de lock, as ações por linha, filtros,
busca, lista vazia, diálogo). Q-104 (lock stale lê como "Unlocked") e Q-105 (sem texto de resultado
após Open/Read only) aceitas como resolvidas nas notas de implementação acima — fechadas.

Quatro defeitos de tela corrigidos antes do merge, em três commits:

1. **Ignored projects mostrava o erro cru** (caminho absoluto inteiro), na aba e, em oito linhas,
   na lateral. `state/end-day-failure-reason.ts#summarizeFailureReason` (da V2-T69) foi movida para
   um nome/lugar neutro, `state/error-reason-summary.ts#summarizeErrorReason`, e passou a servir os
   dois lados — End day e Projects. A lateral (`other-sessions-and-ignored-view.ts`, legado) ganhou
   só o mesmo resumo + `title`, sem redesenho da região.
2. **Colunas quebrando linha sem necessidade** ("Payments webhooks", "Locked by session 33333333",
   a data de última atividade). Causa raiz: `table-layout: fixed` com `width` explícito em cada
   `<th>` usa `content-box` por padrão, então o padding de cada célula (`TableRow.module.css`'s own
   `.cell`) somava ALÉM da largura declarada, faminto a única coluna sem largura própria (Name) a
   poucos caracteres — corrigido com `box-sizing: border-box` nas duas folhas de estilo envolvidas.
   As larguras de cada coluna foram remedidas com uma ferramenta própria (CDP `Runtime.evaluate`
   contra o bundle real, script descartável, não commitado) em vez de régua de captura de tela: a
   rodada anterior tinha medido pixels FÍSICOS de uma captura (escala de tela 1.25x desta máquina)
   e escrito esse número como se já fosse px lógico de CSS, superalocando cada coluna fixa em ~25%
   e sufocando a coluna Name.
3. **"unknown" cru e minúsculo na última atividade.** Vira um traço "—" em tom secundário com
   `title` explicando a ausência (D-025); uma data conhecida continua reusando
   `formatSessionLastActivityText`, o mesmo formato que o resto da janela já mostra.
4. **Coluna de ação desalinhada** ("Go to tab"/"Open"/"Read only…" com três larguras diferentes).
   Um `min-width` compartilhado só eleva um rótulo mais curto até o piso — nunca baixa um mais
   longo até ele, e tanto "Go to tab" quanto "Read only…" são naturalmente mais largos que o piso
   anterior. Trocado por um `width` fixo verdadeiro: os três rótulos agora renderizam exatamente do
   mesmo tamanho.

Capturas refeitas nos dois temas (`01-table`, `02-search-active`, `03-no-match`, `04-filter-running`,
`05-filter-locked`, `06-new-project-dialog`), incluindo um projeto de nome bem longo
("Payments and billing reconciliation pipeline integration service") provando que a truncagem com
reticências continua correta — nunca quebra, nunca estoura a linha.

`npm run verificar` do zero (dist apagado antes): verde — 375 arquivos de teste, 3579 testes
passando (4 pulados, pré-existentes), cobertura 95.86%/91.61%/95.45%/96.06%
(stmts/branch/funcs/lines), `dependency-cruiser` sem violação. Registro do Windows
(`HKCU:\Software\Classes\seeya`/`seeya-dev`) e hash de `~/.seeya/protocol-handler.json`
(`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`) conferidos antes e depois,
sem mudança.

Recusas encontradas: o comando `backlog task edit --comment` foi recusado pelo ambiente (texto
longo demais para o verificador de isolamento de worktree confirmar que não é um comando git) —
este comentário foi escrito editando o markdown da tarefa diretamente, como a própria
`AGENTS.md` manda nesse caso, em vez de contornar a recusa.
---
<!-- COMMENTS:END -->
