---
id: TASK-10
title: V2-T18 — Caixa de seleção e painel Hoje parado
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels: []
milestone: m-2
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: bug
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T18 — Correção: a caixa de seleção não volta para a sessão retomada, e o painel "Hoje"
não se atualiza sozinho.** Especificada pelo PO em 2026-09-20 a partir de dois achados do
mantenedor no mesmo dia, com captura de tela.

**O defeito, medido.** No painel "Hoje", a linha de uma sessão retomada antes aparece como
texto simples — *"resumed earlier, not running now"* — **sem caixa de seleção**, e por isso
não há como retomá-la de novo pela janela; o mantenedor voltou a usar o terminal. Isso é
exatamente o que a V2-T9 item 4 existia para corrigir, e o estado já está certo: o módulo
`state/today-panel.ts` distingue as três formas (`runningNow`/`resumedEarlier`/
`neverResumed`) e a docstring dele diz, com todas as letras, que em `resumedEarlier` **"a
caixa volta"**. Quem não cumpre é o desenho: `electron/renderer.ts
#renderTodaySessionRow` trata `resumedEarlier` no mesmo ramo de `runningNow` e devolve um
texto sem caixa. O estado está certo, a tela mente. (A revisão do PO olhou o módulo de
estado e não o desenho — registro para não repetir.)

**Segundo achado, do mesmo relato.** A linha dizia "not running now" para uma sessão que
estava aberta. `renderTodayPanel` só é chamado **na subida da janela** e depois de "Resume
selected" — o painel nunca acompanha o ciclo de atualização de 10 segundos que o resto da
janela usa. Ou seja, a vivacidade mostrada ali é uma fotografia do instante em que a janela
abriu, e envelhece calada. É o mesmo tipo de defeito da V2-T16 (responder com um valor lido
na subida), em outro lugar.

**O que entra:**
1. **A caixa volta em `resumedEarlier`**, com a nota ao lado dizendo que a sessão já foi
   retomada hoje — a informação continua visível, o que muda é que ela deixa de impedir a
   ação. Só `runningNow` fica sem caixa, que é o único caso em que retomar não faz sentido.
2. **O painel "Hoje" acompanha o ciclo ambiente**, como a faixa de horário e a barra lateral
   já fazem, reusando a MESMA descoberta do ciclo (nunca uma segunda consulta). Cuidado ao
   redesenhar: não apagar caixa que a pessoa acabou de marcar nem o diretório escolhido no
   seletor "Resume in" — se isso exigir atualizar em vez de redesenhar, atualize.
3. **Teste de regressão nos dois**: um provando que a linha `resumedEarlier` traz caixa
   (faixa de unidade sobre o que o desenho produz, no formato que o projeto já usa para o
   renderer), e outro provando que uma sessão que passa a estar viva **depois** da subida
   aparece como tal sem reabrir a janela.

**O que não entra:** mudar a regra de quando o briefing deixa de estar pendente
(`resumed.json` continua decidindo isso); qualquer mudança na CLI.

**Cuidados:** nenhuma dependência nova; nada no `~/.seeya` real; a prova manual usa
`SEEYA_APP_HOME_OVERRIDE` e captura de tela.

**Aceite do mantenedor:** com uma sessão já retomada hoje e fechada, a caixa dela aparece e
"Resume selected" funciona; abrindo uma sessão fora da janela, a linha dela vira "running
now" sozinha, sem reabrir o app.

**Relatório.** Os dois defeitos exigiam decisão de desenho: `electron/` (renderer.ts e
main.ts) é código de fiação sem teste de unidade possível (módulo Electron, exclusão de
cobertura já documentada em `vitest.config.ts` — importar `renderer.ts` fora de um
`BrowserWindow` real já lança na primeira linha, `window.seeya.getTerminalFontConfig()`).
Para que o item 3 ("faixa de unidade... no formato que o projeto já usa para o renderer")
fizesse sentido, a correção de cada defeito extraiu a ÚNICA decisão que
`renderTodaySessionRow`/o ciclo ambiente precisavam para uma função pura em
`packages/app/src/state/today-panel.ts` (D-041, o mesmo padrão que já rege `schedule-strip.ts`,
`resume-summary.ts` etc.) — `renderer.ts`/`main.ts` só consomem, nunca redecidem.

**Item 1 (a caixa volta).** `state/today-panel.ts#offersResumeCheckbox(status)` — `true`
para qualquer `TodayResumeStatus` exceto `runningNow`. `electron/renderer.ts
#renderTodaySessionRow` passou a decidir o ramo por essa função (antes: dois `if`
independentes, um agrupando `resumedEarlier` com `runningNow`); a nota "resumed earlier, not
running now" virou sufixo do texto da caixa, em vez de texto sem caixa.

**Item 2 (o painel acompanha o ciclo).** `state/today-panel.ts#refreshTodayPanelLiveness
(inputs, liveSessionIds)` recomputa o painel reaproveitando o `lookup`/`cwdHistoryBySessionId`
já lidos por `getTodayPanel` (cache `latestTodayPanelInputs` em `main.ts`, análogo a
`latestSidebarRows`) e só troca `liveSessionIds` — a MESMA `buildLiveSessionIndex(rows)` que
o ciclo já calcula para a barra lateral, nunca uma segunda `SessionProvider.list()` nem um
segundo `findPendingBriefing`/`readCwdHistory`. `main.ts`'s own `onTick` manda o resultado
pelo novo canal `CHANNELS.todayUpdate` (`ipc/channels.ts`), no mesmo tick de
`sessionsUpdate` — o nome do canal é uma constante partilhada por `main.ts`/`preload.ts`/
`renderer.ts`, então o clássico descompasso de nome de canal do Electron é estruturalmente
impossível aqui (o próprio propósito documentado de `ipc/channels.ts`).

**Cuidado ao redesenhar (item 2).** `renderer.ts#renderTodayPanelPreservingSelections`
tira uma foto das caixas marcadas e do "Resume in" escolhido
(`snapshotTodayPanelSelections`) ANTES de `renderTodayPanel` reconstruir o DOM do zero, e
devolve essa escolha depois (`restoreTodayPanelSelections`) — uma sessão que deixou de
oferecer caixa (agora `runningNow`) simplesmente não tem onde restaurar, o que é o
comportamento certo. Usada em TODO redesenho do painel (subida, `resumeSelected`,
`endDayRun` e o próprio `onTodayUpdate`), não só no tick — um benefício colateral: antes, um
"Resume selected" parcialmente falho já perdia a marcação das caixas não tentadas; agora não
perde mais.

**Teste de regressão (item 3).** `tests/unit/app/state/today-panel.test.ts`:
`offersResumeCheckbox` (3 casos: `resumedEarlier`→true, `neverResumed`→true, `runningNow`
com e sem `matchedTabId`→false) e `refreshTodayPanelLiveness` (3 casos: `null` sem
`inputs`; uma sessão que fica `runningNow` numa "tick" LATER sem reconsultar `lookup`; o
caso `noBriefing`). Todos os 21 testes do arquivo passam depois da correção; revertendo só a
mudança de `renderer.ts`/`main.ts` (mantendo as duas funções novas em `today-panel.ts`) os
testes de estado continuariam passando — a prova de que o defeito nunca esteve na função
pura, e sim no consumo — é exatamente por isso que a prova manual abaixo cobre o que o
teste de unidade estruturalmente não alcança (o DOM de fato produzido e o `ipcMain`/
`ipcRenderer` de fato ligado).

**Prova manual.** Duas rodadas, cada uma com `SEEYA_APP_HOME_OVERRIDE` apontando para uma
pasta descartável em `tmpdir` (nunca `~/.seeya`/`~/.claude` reais) e `SEEYA_APP_OFFSCREEN=1`
(máquina sem tela interativa). Fixture construída com o `StorageAdapter` de produção
(`saveHandoff`/`saveResumedSessionIds`), nunca JSON digitado à mão.

1. *Defeito 1.* Um briefing com duas sessões — "alpha" nunca retomada, "beta" marcada em
   `resumed.json`. Captura de tela: as DUAS linhas têm caixa; "beta" traz o sufixo "resumed
   earlier, not running now" e continua marcável. Confirma o aceite ("a caixa dela aparece").
2. *Defeito 2.* Uma sessão "gamma" nunca retomada, MAIS um processo real de longa duração
   (`tests/fixtures/process/graceful-child.mjs`, o mesmo fixture que os testes e2e já usam)
   cujo `procStart` real foi capturado com `adapters/process/proc-start.ts
   #captureObservedProcStart` — o mesmo par pid/procStart que a descoberta real exige. A
   janela abriu com a sessão AINDA não descoberta (captura de tela 1: caixa, "não
   retomada"); só DEPOIS, com a mesma janela já rodando, um registro de sessão foi escrito no
   `.claude` equivalente da própria pasta descartável (nunca o `~/.claude` real — `claudeHome`
   é `homeDir/.claude`, injetável, `resolveAppHome`'s own docstring). Passados ~22s (mais de
   um ciclo de `REFRESH_INTERVAL_MS`), a segunda captura de tela mostra "gamma" como
   "running now" na barra lateral E no painel "Hoje", SEM reabrir a janela — a captura em
   dois momentos veio do Chrome DevTools Protocol (`--remote-debugging-port`, um recurso
   padrão do Electron, sem mudar `main.ts`) porque a instrumentação `SEEYA_APP_SCREENSHOT_PATH`
   só tira uma foto por execução. Confirma o aceite ("a linha dela vira 'running now'
   sozinha, sem reabrir o app").

Os dois scripts de apoio e as capturas ficaram fora do repositório (pasta de scratch,
removida ao final da tarefa) — nada versionado depende deles.

**Achado à parte, já esperado.** Abrir a janela registra `seeya-dev://` no registro do
Windows (`HKCU\Software\Classes\seeya-dev`) apontando para ESTA worktree, que será apagada
(V2-T10, comportamento automático e documentado, não um bug desta tarefa). A mesma rodada
também revelou que este `seeya` já está instalado nesta máquina
(`C:\Program Files\seeya\seeya.exe`), o que disparou o diálogo real "seeya found a daemon or
autostart already set up on this machine" (V2-T13/D-045) — nenhum dos dois botões foi
clicado (`SEEYA_APP_QUIT_AFTER_MS`/o `kill()` do script encerraram a janela antes), então
nada do autostart/daemon real foi tocado.

**Portão.** Máquina com pouca memória: rodado em partes. `format:check`, `tsc -p
tsconfig.json --noEmit`, `lint`, `build` e `dependencias` (todos verdes, cada um em
primeiro plano) e depois `npx vitest run --project unit --project integration --project
integration-process --project guards --maxWorkers 2` (198 arquivos, 2.018 testes passando,
4 pulados) seguido de `--coverage` na mesma composição (mesmo resultado de testes; cobertura
96,4%/92,62%/94,95%/96,76% — todos os pisos por diretório cobertos, incluindo
`packages/app/src/state/**` em 99,09%). `npm run verificar:linux` não foi rodado (opcional).

**Nenhuma questão nova aberta.** A extração das duas funções puras foi uma escolha de
implementação dentro dos limites da spec (D-041 já estabelecido no código), não uma
ambiguidade dela — registrada aqui, não em `docs/QUESTOES.md`, porque não bloqueou o
trabalho nem exigiu decisão do mantenedor.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 198 arquivos, 2.018 testes
passando, 4 pulados; cobertura 96,40%/92,62%/94,95%/96,76%). Revisão com um ajuste: duas
frases em português tinham ficado dentro de comentários de código, que por contrato são em
inglês (D-028). Fica em `[~]` até o aceite do mantenedor.
<!-- SECTION:DESCRIPTION:END -->
