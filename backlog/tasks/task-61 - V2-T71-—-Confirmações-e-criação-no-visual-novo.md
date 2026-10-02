---
id: TASK-61
title: V2-T71 — Confirmações e criação no visual novo
status: Review
assignee: []
created_date: '2026-09-30 10:34'
updated_date: '2026-10-02 14:59'
labels: []
milestone: m-2
dependencies:
  - TASK-65
type: feature
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 9 (item 10): projeto travado, mudanças pendentes, retomada que não deu, transição de posse do daemon e New project.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**V2-T71 — Confirmações e criação no visual novo.** Branch `tarefa/V2-T71-confirmacoes`, a partir
de `origin/main` (`bdfdc05`). Seis commits.

**Onde cada diálogo ficou.** `packages/app/src/renderer/features/confirmations/` (escolha: região
própria, não `renderer/features/<região-do-fluxo>/`, porque os cinco diálogos não pertencem a uma
única região da janela — lock/mudanças pendentes nascem do fluxo "Open" da aba Projects, a
retomada que falhou nasce da aba Today, a transição de posse não nasce de ação nenhuma da pessoa —
e cada um já tinha, antes desta tarefa, um lar diferente em `renderer/legacy/`. Uma pasta por
preocupação transversal, como `renderer/components/` já é para o design system, pareceu mais
honesta que forçar cada um para dentro da região que o dispara):
- `ProjectLockConfirmDialog/` — projeto travado.
- `LeftoverChangesConfirmDialog/` — mudanças pendentes de outra sessão.
- `ResumeFallbackDialog/` — retomada que não deu como estava.
- `DaemonOwnershipTransitionDialog/` — transição de posse do daemon.

"New project" já tinha componente (V2-T67, `renderer/features/projects/NewProjectDialog/`) — só
ganhou a validação local do formato nesta tarefa.

**O que saiu do legado.** `renderer/legacy/fallback-dialog-view.ts`,
`daemon-ownership-transition-view.ts`, `project-lock-confirm-dialog-view.ts`,
`project-leftover-changes-confirm-dialog-view.ts` — apagados, junto dos quatro `<Dialog>` estáticos
correspondentes em `dialogs-shell.tsx`. `renderer.tsx`/`project-panel-view.ts` pararam de os
wirear. Os quatro IDs de dialog/botão são os mesmos de antes (ids preservados onde a instrumentação
de verificação de tarefas anteriores já os usa — `fallback-dialog-skip`,
`daemon-ownership-transition-decline`, etc.).

**Dados/IPC novos.**
- `ConfirmProjectLockOpenRequestEvent` trocou `questionText` (uma frase pronta) por
  `heldBySessionId`/`heldByPid`/`heldByAcquiredAt` — os fatos crus, para a janela montar o próprio
  título+contexto (`state/project-lock-confirm.ts#formatLockHolderLine`, `toLocaleString()` como o
  resto da janela já faz para datas). A sentença antiga (`renderReadOnlyOpenQuestion`) continua
  intocada, só para a CLI.
- `ConfirmLeftoverChangesOpenRequestEvent` trocou `questionLines` por
  `changedFiles: ChangedFileRow[]` (path + status M/A/D/R/other). Isto exigiu um dado que a spec
  pede mas o motor não guardava: `listChangedFiles` descarta o status na linha porcelain (decisão
  deliberada de quando foi escrita, V2-T29). Acrescentei **`WorkspaceRepository
  .listChangedFilesWithStatus`** — método **aditivo** no mesmo port, nunca uma mudança no método
  existente: `listChangedFiles` segue exatamente como estava, porque o fluxo de adoção
  (`project-adopt-outcome.ts`, território da V2-T70, em paralelo) já o chama e eu não podia
  arriscar o tipo dele mudando debaixo dos pés de outra tarefa em voo. O parser puro mora em
  `packages/engine/src/core/changed-file-status.ts` (`ChangedFileEntry`/`ChangedFileStatus`/
  `parseChangedFileStatusLine`) — **o PO já confirmou que a V2-T70 vai reusar este mesmo tipo e
  parser**; mantive os dois desacoplados dos diálogos de propósito (vivem em `core/`, testados
  isoladamente, `ipc/channels.ts` só redeclara a forma própria `ChangedFileRow`/
  `ChangedFileDisplayStatus` para a fronteira de IPC, nunca importa o tipo do motor ali — mesma
  disciplina que `FallbackConfirmRequestEvent` já segue).
- Nenhuma mudança em `ConfirmLeftoverChanges`/`OpenProjectResult.changedFiles` (CLI) nem em
  `AdoptSessionCallbacks`/`listChangedFiles` (adoção) — só o essencial para a tela nova.

**Layout — dois defeitos achados pela própria captura real, corrigidos antes de reportar.**
1. `LeftoverChangesConfirmDialog`: as explicações de cada opção viviam no corpo rolável, acima da
   lista — com uma lista longa, rolavam para fora junto com ela. Movidas para o rodapé, empilhadas
   sobre o próprio botão.
2. `ResumeFallbackDialog`: com os três cartões (quando `offersResumeWithoutPlan`), o botão do
   terceiro (o recomendado, primário) ficava cortado abaixo da borda da janela — este diálogo não
   tem um rodapé único para fixar (cada cartão carrega o próprio botão), então a área dos cartões
   ganhou sua própria região rolável e limitada (`max-height: 60vh`).

**Foco ao fechar.** `dialog-focus-return.ts` continua valendo sem mudança nenhuma — ele varre todo
`<dialog>` já no documento quando `wireDialogFocusReturn()` roda, e os quatro novos ficam montados
incondicionalmente em `App.tsx` (igual `SettingsDialog`/`NewProjectDialog` já faziam), antes dessa
varredura.

**Prova visual.** Instrumentação nova em `main.ts` (documentada no `AGENTS.md`, junto das demais):
`SEEYA_APP_VERIFY_CONFIRMATIONS_DIR` (lock/mudanças-pendentes/retomada×2/new-project×3, sete PNGs —
lock e mudanças-pendentes/retomada despachados como eventos IPC fictícios diretos, nunca pelo fluxo
real de `openProject()`/retomada — abrir de verdade exigiria um segundo processo `seeya` real ou
uma falha real de `claude --resume`, nenhum apropriado aqui; "New project" roda de verdade contra o
espaço de trabalho descartável da fixture) e `SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR` (repouso +
loading, diálogo real — chegar a `shouldOffer: true` de propósito usa
`SEEYA_APP_VERIFY_FAKE_INSTALLED_LAUNCH_PATH` — `BuildAppContextOverrides.appInstallation`
fictício, nunca consulta o registro/`dpkg`/`/Applications` real — mais um `daemon.lock` de fixture
nomeando um processo filho REAL nascido pelo script de verificação, com `procStart` lido pelo
`adapters/process/proc-start.ts#captureObservedProcStart` de verdade, nunca inventado). O clique de
`loading` é sempre em `Leave it as it is` — nunca `Let seeya take over`, que tocaria autostart/
daemon reais.

Dezoito capturas (9 cenários × 2 temas), todas olhadas uma a uma contra a § 9 antes deste relatório
— duas rodadas de correção de layout (acima) vieram exatamente desse processo. Script descartável
no scratchpad do agente, nunca commitado. Conferido antes/depois: `HKCU\Software\Classes\seeya`/
`seeya-dev` inalterados, hash de `~/.seeya/protocol-handler.json` real bate com `E3D8A283…`,
`~/.seeya/daemon-ownership-transition.json` real inalterado (`"answer":"accepted"`, preexistente).

**`npm run verificar`: passou do zero** (`389` arquivos de teste, `3670` testes, `4` skipped, `0`
falhas) — depois de uma sessão de depuração ambiental: uma invocação anterior do próprio comando
ficou presa em segundo plano (relatada como "falha" pela ferramenta, mas o processo `node`
continuou rodando de verdade) e colidiu com tentativas seguintes nos mesmos arquivos de fixture
transitórios dos guards de eslint (`_guard-*`), produzindo `ENOENT` espúrios. Identificado via
`Get-CimInstance Win32_Process` (linha de comando de cada `node.exe`), não via `tasklist` (que não
mostrava os processos por algum motivo de filtro/locale). Resolvido esperando o processo zumbi
terminar sozinho, sem interferir mais.

**Questões abertas:** nenhuma — nenhuma ambiguidade da spec exigiu decisão do PO. A única pergunta
que caberia (se "id curto" do lock, mencionado no despacho da tarefa, deveria substituir o
`sessionId` completo que o resto da janela já mostra para lock — ex.: `ProjectsTable`'s own coluna
de lock) foi resolvida sem precisar perguntar: mantive o id completo, porque é o que
`formatLockHolderDescription`/a coluna de lock da aba Projects já mostram — "id curto" no despacho
lia como paráfrase ("sessão, id curto" = "a sessão, [identificada por um] id curto"), não como
exigência de encurtar especificamente aqui.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Claude (agente)
created: 2026-10-02 14:59
---
PO review round 1 addressed. 1) Lock dialog now shows the SHORT session id (state/project-lock-confirm.ts#shortLockHolderSessionId, same computeDisplaySessionIds scheme as the Projects tab lock column), full id moved to the context line's title attribute (hover tooltip). 2) LeftoverChangesConfirmDialog footer rebuilt: both explanations are now full-width stacked lines (Continue without committing: .../Commit now: ...) above a single aligned button row, primary on the right -- same shape as the lock and daemon-ownership dialogs. 3) ResumeFallbackDialog cards compacted (title+chip on one line, margin:0 on title/explanation/context to remove the browser UA-default gap that Stack's own gap does not collapse against) -- all three cards (promptTooLarge variant) now fit without scrolling at the standard verification window height; cardsScroll max-height stays as a small-window safety net only. 4) Confirmed: core/changed-file-status.ts (ChangedFileEntry/ChangedFileStatus/parseChangedFileStatusLine) is the sole parser behind WorkspaceRepository.listChangedFilesWithStatus; the dialog only consumes the already-typed ChangedFileRow via state/changed-file-row.ts -- untouched this round, available for V2-T70 to reuse as-is. Screenshots 01-04 regenerated in both themes via the existing scratchpad verify.mjs driver (never committed); npm run verificar run clean from scratch after the fixes.
---
<!-- COMMENTS:END -->
