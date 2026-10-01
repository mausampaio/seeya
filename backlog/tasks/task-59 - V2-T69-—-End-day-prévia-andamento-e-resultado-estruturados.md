---
id: TASK-59
title: 'V2-T69 — End day: prévia, andamento e resultado estruturados'
status: Review
assignee: []
created_date: '2026-09-30 10:34'
updated_date: '2026-10-01 23:07'
labels: []
milestone: m-2
dependencies:
  - TASK-65
type: feature
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 6 (item 8): listas estruturadas no lugar do relatório da CLI em <pre>, barra de progresso, Hide sem interromper a captura, resultado com Open Today. Os dados vêm dos mesmos resultados do endDay, não do texto formatado.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Entrega.** Branch `tarefa/V2-T69-end-day` a partir de `main` `5b7b2f1`, commit
`a53c500de131927cc486ae0c1a417bd583418a40`. `npm ci` rodado na worktree antes de qualquer
verificação.

**O que saiu.** `renderer/legacy/end-day-dialog-view.ts` apagado inteiro. O bloco
`<Dialog id="end-day-dialog">` (`<pre>` do relatório, `<p>` do custo/progresso, botões por id cru)
saiu de `renderer/legacy/dialogs-shell.tsx`. `renderer.tsx` não chama mais `wireEndDayDialog`. As
quatro regras CSS órfãs (`#end-day-dialog-report`/`-cost`/`-progress`/`-actions`) saíram de
`renderer/legacy/legacy.css`; `#end-day-dialog`/`#end-day-dialog h3` ficaram (o `Dialog` novo ainda
usa esse id e aquele h3, só a largura/margem). Duas referências já defasadas a
"`#end-day-button` é âncora legada" (`Button.module.css`, `FavoritesSection.tsx`) foram corrigidas
para o estado real.

**Árvore de `renderer/features/end-day/`:**
```
end-day/
  EndDayDialog.tsx / .module.css        — raiz: troca de pane por fase
  useEndDay.ts                          — hook: useReducer sobre state/end-day-panel.ts + IPC
  index.ts
  PreviewPane/   (PreviewPane.tsx/.module.css/index.ts)   — fases preview/starting
  ProgressPane/  (idem)                                    — fase running
  ResultPane/    (idem)                                     — fase result
```
Componentes novos em `renderer/components/` (D-052: pasta própria, CSS module, teste renderizado,
`index.ts`): `ProgressBar/` (duas `<div>`, nunca `<svg>` sem tamanho explícito — o defeito da
V2-T75 citado no despacho) e `StatusList/` (lista genérica de itens com badges `Chip`, reaproveitada
pelas três fases e por qualquer lista futura do mesmo formato).

**Máquina de estados reescrita.** `state/end-day-panel.ts` — seis fases:
`idle → previewPending → preview → starting → running → result → idle`. `starting` é nova: mesma
forma de `preview`, mas com `Run end-day now` em `loading` e `Cancel` escondido — cobre o intervalo
real entre o clique e o primeiro evento de progresso (`application/end-day.ts` refaz discovery +
elegibilidade antes da primeira sessão começar). `running.current` nunca é `null` (D-024): só se
entra em `running` via `sessionStarted`, que sempre carrega o evento. `visible` (só em
`running`/`result`) é o que `hidden`/`reopened` alternam — Hide nunca muda a fase, só esconde o
diálogo; a captura segue no fundo. `describeEndDayFooterLabel` é a nova função que decide o rótulo
do botão `#end-day-button` no rodapé quando o diálogo está escondido ("Capturing i of N…"/"End day
finished — view results") ou idle ("End day…") — um lugar só, testado.

**Campos estruturados acrescentados (D-024, nenhuma mudança na saída da CLI):**
- `state/end-day-sessions.ts` (novo) — `buildEndDayPreviewRows`/`buildEndDayResultRows`, a partir
  do mesmo `EndDayResult` que `formatEndDayReport` já lia. `EndDaySessionSummaryRow` (sessionId,
  name, cwd já formatado, state, mode) para "will be captured"/"captured";
  `EndDayNotCapturedRow`/`EndDayReasonRow` para as três origens de "não capturado"
  (`ineligible`/`closed`/`failed`), com a razão em frase — nunca o token cru.
- `state/end-day-reasons.ts` (novo) — `formatIneligibilityReasons` (frase por
  `IneligibilityReason`) e `CLOSED_SESSION_REASON` (D-031).
- `sidebar/directory-label.ts` ganhou `abbreviateHomeDirectoryPath`/`formatSessionDirectory` —
  colapsa o `cwd` sob o home para `~` (case-insensitive só no win32, mesma disciplina de
  `core/cwd-normalization.ts`) antes de `shortenDirectoryPath` truncar.
- `ipc/channels.ts` — `EndDayPreviewResponse` perdeu `reportText`, ganhou
  `willBeCaptured`/`notCaptured`; `EndDayRunResponse` perdeu `reportText`, ganhou
  `captured`/`failed`/`skipped`; `EndDayProgressUpdateEvent` virou união `started`/`finished`,
  agora com `sessionId` (a V2-T5a descartava `captureFinished` de propósito; a lista por sessão
  pede o evento de volta — `state/end-day-progress.ts`'s own docstring explica a reversão).
- `main.ts` — os dois handlers chamam `buildEndDayPreviewRows`/`buildEndDayResultRows` com
  `context.homeDir`/`context.platformHint`, no lugar de `formatEndDayReport`.

**Instrumentação de verificação (nunca lida por `npm run app`).**
`composition/index.ts#BuildAppContextOverrides` ganhou `leanGenerator`/`deepGenerator` opcionais.
`composition/verification-fake-generator.ts` (novo) — `VerificationFakeHandoffGenerator`, um
`HandoffGenerator` fictício que `await clock.sleep(delayMs)` (D-019: `Clock` injetado, nunca
`setTimeout` cru) e devolve um `GeneratedUnderstanding` fixo, nomeando-se como fixture no próprio
texto. `main.ts` liga isto a `SEEYA_APP_VERIFY_END_DAY_FAKE` (`'preview'|'progress'|'result'|
'hidden'`): quando setada, os dois geradores viram o fictício (`END_DAY_FAKE_DELAY_MS = 2000`) e um
bloco de clique-automação dirige a janela real até a fase pedida (dispensa primeiro um diálogo
solto de transição de posse do daemon — medido: o botão fica desabilitado/"Working…" por um tempo
depois do load, daí os 3000ms antes do clique de dispensa). `resolveEndDayFakeScreenshotDelayMs`
decide o atraso de `captureVerificationScreenshot` por cenário — números medidos empiricamente
contra `captureConcurrency: 1` na fixture (ver abaixo), não chutados.

**Prova visual — real, com dados fictícios, nos dois temas.** Técnica: `node scripts/build.mjs`
(sem `--dev`) em `packages/app`, Electron lançado direto (`node_modules/electron/dist/electron.exe`
— baixado uma vez com `node node_modules/electron/install.js`, não existia ainda) com
`--user-data-dir` descartável e `SEEYA_APP_HOME_OVERRIDE` apontando para um `~/.claude`+`~/.seeya`
descartável por execução (nunca `npm run app`/`build.mjs --dev`). Seis sessões fictícias por
execução (registro em `.claude/sessions/<pid>.json`, UUIDs sintéticos
`11111111-…`…`66666666-…`): `alpha`/`beta` (lean, elegíveis), `gamma-deep` (transcript real +
`projectPolicy.deepCapture`, mostra o modo "Deep" e a elipse de truncamento de diretório —
`…ct-name-for-the-screenshot-demo`), `delta-ignored` (no `config.ignore`, motivo "This directory is
in the ignore list."), `closed-session` (só transcript, sem registro — D-031, "Session closed — no
running process was found"), `zeta-poisoned` (registro elegível + um handoff CORROMPIDO
pré-gravado em `~/.seeya/days/<hoje>/sessions/<id>.json`, texto deliberadamente inválido — explora
o caminho já documentado em `eligibility-assembly.ts#evaluateFullEligibility`, "corruption is a
visible failure", nunca o gerador: a falha mostrada no resultado é a mensagem REAL de
`SyntaxError` do JSON inválido). `config.json` da fixture: `captureConcurrency: 1` (sequencial,
timing previsível) e `theme` trocado por execução.

Quatro cenários × dois temas, oito capturas reais (`webContents.capturePage()`, offscreen),
conferidas uma a uma antes deste relatório:
- `preview-light.png`/`preview-dark.png` — "Will be captured · 3" (alpha/beta/ended/Lean,
  gamma-deep/ended/Deep) e "Not captured · 2" (delta-ignored/Skipped, closed-session/Closed, cada
  um com a frase do motivo), caixa de custo, Cancel/Run end-day now.
- `progress-light.png`/`progress-dark.png` — "Capturing 2 of 5: beta…", barra de progresso em ~1/5,
  lista com alpha=Captured (verde), beta=Capturing (azul), gamma-deep/delta-ignored/zeta-poisoned=
  Waiting (as três estados do item 8 do despacho, numa imagem só), botão Hide.
- `result-light.png`/`result-dark.png` — "Captured · 3" (alpha/beta/gamma-deep, estado+modo),
  "Failed · 1" (zeta-poisoned, com o caminho do arquivo e o `SyntaxError` real do JSON corrompido),
  "Skipped · 2" (delta-ignored/closed-session, com a frase de cada um), Close/Open Today.
- `hidden-light.png`/`hidden-dark.png` — diálogo fechado (Hide clicado em pleno "running"), rodapé
  da lateral mostrando `Capturing 2 of 5…` no lugar de "End day…" — a captura seguiu no fundo.

Caminhos (fora do repo, no scratchpad desta sessão do agente, nunca commitados):
`<scratchpad-da-sessão>\v2t69-verify\screenshots\{preview,progress,result,hidden}-{light,dark}.png`.
Os scripts de verificação (`lib.mjs`/`run-one.mjs`/`run.mjs`, descartáveis) moram na mesma pasta.

**Confirmado, só leitura, antes e depois das oito execuções:** `HKCU\Software\Classes\seeya` e
`\seeya-dev` inalterados (mesmo valor `URL:seeya`/`URL:seeya-dev`); hash SHA-256 de
`~/.seeya/protocol-handler.json` real idêntico antes/depois
(`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`, conteúdo
`{"schemaVersion":2,"activeScheme":"seeya-dev"}`) — `SEEYA_APP_HOME_OVERRIDE` faz
`shouldRegisterProtocolScheme` pular os dois (V2-T57). Lista dos arquivos mais recentes em
`~/.seeya` real conferida depois: nenhum com mtime durante a sessão. Nenhum `claude -p` real
disparado (fictício injetado o tempo todo); nenhuma sessão real tocada; nada escrito fora dos homes
descartáveis.

**Testes.** 14 arquivos novos/alterados diretamente desta tarefa, 116 casos, todos verdes:
`end-day-panel.test.ts` (reescrito, 6 fases), `end-day-progress.test.ts` (reescrito, `started`/
`finished`), `end-day-sessions.test.ts` (novo), `end-day-reasons.test.ts` (novo),
`directory-label.test.ts` (+10 casos), `verification-fake-generator.test.ts` (novo),
`ProgressBar.test.tsx`/`StatusList.test.tsx` (novos, `@testing-library/preact`),
`EndDayDialog.test.tsx`/`PreviewPane.test.tsx`/`ProgressPane.test.tsx`/`ResultPane.test.tsx`/
`useEndDay.test.tsx` (novos — o último mede inclusive a ordem de `act()` certa para um `.then()`
guardado por `stateRef`, documentado no topo do arquivo: um único `act(async…)` combinando clique e
`await Promise.resolve()` nunca flush a render do Preact a tempo do `.then()` já agendado; dois
`act()` separados, sim — achado medido escrevendo este arquivo, não suposição), `SidebarFooter.test.tsx`
(+2 casos, incluindo a integração real com o diálogo).

**`npm run verificar`, do zero (dist apagado), contra o commit acima: verde.** `format:check`,
os três `tsc -p ... --noEmit`, `lint`, `build`, `dependencias` (712 módulos, 2063 dependências, sem
violação) e `cobertura` — 356 arquivos de teste, 3407 testes passando + 4 pulados, cobertura
95.54%/91.27%/94.71%/95.74% (statements/branches/functions/lines). `renderer/features/end-day/`
sozinho: 92.45% statements.

**`GIT_CONFIG_GLOBAL=<vazio> GIT_CONFIG_NOSYSTEM=1 npm test`:** recusado pela proteção da worktree
("a worktree-isolated agent's git operations must target its own worktree... Refusing to run it")
— não contornei; reportando como pedido pelo despacho. O mesmo conjunto de testes (`unit` +
`integration` + `integration-process` + `guards`) já rodou verde via `npm run verificar`'s own
`cobertura`, acima.

**Regras invioláveis — confirmado.** `~/.seeya`/`~/.claude`/espaço de trabalho reais, registro,
autostart, daemon e instância real do mantenedor nunca tocados (checado antes/depois, só leitura).
Nenhum `npm run app`/`build.mjs --dev`. Nenhum modelo chamado de verdade. `git mv` não foi
necessário (nenhum arquivo trocou de título/nome nesta tarefa).

**Onde este guarda-corpo termina (D-025, honesto).** `resolveEndDayFakeScreenshotDelayMs` e o
bloco de clique-automação em `main.ts` são números fixos calibrados empiricamente nesta máquina,
nesta execução — não uma espera por evento real (não há um `did-finish-load`-like para "a fase X
do diálogo chegou"); uma máquina muito mais lenta/rápida pode exigir recalibrar. Documentado no
próprio comentário de `resolveEndDayFakeScreenshotDelayMs`, nunca escondido.

**Questões abertas:** nenhuma. Nada exigiu desviar de `docs/DECISOES.md`/`docs/ESPECIFICACAO.md`
nem inventar comportamento não especificado.
<!-- SECTION:NOTES:END -->
