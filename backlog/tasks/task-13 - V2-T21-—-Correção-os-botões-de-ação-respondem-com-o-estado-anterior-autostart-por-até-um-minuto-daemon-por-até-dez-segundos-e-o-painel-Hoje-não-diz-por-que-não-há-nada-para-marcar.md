---
id: TASK-13
title: >-
  V2-T21 — Correção: os botões de ação respondem com o estado anterior
  (autostart por até um minuto, daemon por até dez segundos); e o painel "Hoje"
  não diz por que não há nada para marcar
status: Review
assignee: []
created_date: '2026-09-22 11:11'
labels: []
milestone: m-2
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: bug
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T21 — Correção: os botões de ação respondem com o estado anterior (autostart por até
um minuto, daemon por até dez segundos); e o painel "Hoje" não diz por que não há nada para
marcar.** Especificada pelo PO em 2026-09-20 a
partir de dois achados do mantenedor no mesmo dia, com captura de tela. Pequena, e independente
das outras da fila.

**Defeito 1, medido.** Depois de clicar em **Disable autostart**, a mensagem confirma
("Autostart disabled: seeya daemon will no longer start on login") mas **o botão continua
escrito "Disable autostart"** — não vira "Enable autostart". A opção de religar existe, só
demora a aparecer. **Causa:** o estado do autostart é lido com cache de 60 segundos
(`state/autostart-cache.ts`, `DEFAULT_AUTOSTART_REFRESH_INTERVAL_MS`), e o handler de
`CHANNELS.autostartControl` (`electron/main.ts`) **não invalida esse cache** depois de agir —
o rótulo só se corrige no próximo ciclo em que o cache vence. Mesma família da V2-T16
(responder a partir de um valor velho), aqui num cache em vez de um campo.

**E não é só visual — o mantenedor mediu o resto.** Quem decide QUAL ação mandar é a
disponibilidade do lado do desenho (D-041), a mesma que está velha: clicando no botão ainda
escrito "Disable autostart", o app **manda desligar de novo**, e responde *"Autostart was
already disabled. Nothing changed."*. Ou seja, durante até um minuto o botão não só mostra o
estado anterior como **age por ele**, e a pessoa não consegue fazer o que quer — que era
religar. Isso tira esta correção da categoria "cosmética": o caminho da ação está errado,
não a pintura.

**Defeito 2, do mesmo relato.** Com as três sessões do plano abertas, todas aparecem como
"running now" e **nenhuma tem caixa** — que é a regra certa (retomar o que já está aberto
abriria uma segunda cópia). Mas a tela não diz isso: sobra um botão **Resume selected** que
não faz nada, e a leitura natural é "o app quebrou", que foi exatamente a do mantenedor
(*"agora não consigo dar resume em sessão nenhuma"*). Ausência de explicação vira suspeita de
defeito.

**Defeito 1b, medido pelo mantenedor no mesmo dia.** O mesmo vale para o botão do daemon,
só que com dez segundos em vez de sessenta: clicando em **Start daemon**, o daemon sobe mas
o botão continua escrito "Start daemon" até o ciclo ambiente seguinte. Pergunta dele, que é
a solução: *"não conseguiríamos executar o service do status logo que o botão fosse
apertado?"*. Sim — e é o que `snoozeToday` já faz com a faixa de horário desde a V2-T5b: a
resposta da própria ação traz o estado recomputado. **A regra vale para os dois botões**, e
é assim que a spec abaixo a escreve: um botão de ação nunca devolve só texto; devolve
também a disponibilidade recomputada, e quem desenha usa essa, não a do último ciclo.

**O que entra:**
1. **O rótulo do autostart e o do daemon corrigem na hora.** A resposta de cada ação
   (`autostartControl`, `daemonControl`) passa a trazer a disponibilidade recomputada, do
   mesmo jeito que `snoozeToday` já devolve a faixa de horário pronta — e o cache do
   autostart é invalidado junto, senão o ciclo seguinte reporia o valor velho. O cache de
   60s continua valendo para o ciclo ambiente — ele existe por medição (Q-071), e esta
   tarefa não o remove.
2. **O painel "Hoje" explica quando não há o que marcar.** Quando nenhuma linha oferece
   caixa, uma frase diz o porquê — "todas as sessões do plano de hoje já estão abertas" — e o
   botão **Resume selected** não fica sozinho oferecendo uma ação vazia (desabilitado, com o
   motivo à vista; nunca um botão que aceita clique e não faz nada). O texto fica em
   `text/messages.ts`.
3. **O status não mostra dois horários sem dizer qual é qual.** Medido pelo mantenedor no
   Mac em 2026-09-20: depois de adiar, a faixa e a linha de agenda mostram 15:30, mas a
   PRIMEIRA linha do status continua "End-of-day time: 15:00 local" — que é o horário
   **configurado**, e está certo (adiar não muda a configuração, muda só o dia de hoje). Só
   que os dois números aparecem juntos sem nada distinguindo, e a leitura natural é "não
   atualizou". Quando houver adiamento ou pulo no dia, essa linha diz as duas coisas numa só
   (`application/format-status.ts#formatEndOfDayLine`) — e isso vale para a CLI e para a
   janela, que compartilham o mesmo texto.
4. **Teste dos quatro**: a disponibilidade recomputada depois da ação; **um clique logo após a
   ação anterior mandando a ação certa** (o caso que o mantenedor mediu — desligar e, em
   seguida, conseguir religar sem esperar um minuto); e a frase aparecendo exatamente quando
   nenhuma linha oferece caixa (e não aparecendo quando alguma oferece); e a linha de
   horário dizendo as duas coisas quando há adiamento, e só uma quando não há.

**O que não entra:** permitir retomar uma sessão que já está aberta (abriria uma segunda
cópia da mesma sessão — se o mantenedor quiser isso um dia, é decisão, não correção); mudar o
cache de 60s.

**Cuidados:** nenhuma dependência nova; nada no `~/.seeya` real, no autostart real ou no
registro — a disponibilidade é testada com dublê da porta `Autostart`.

**Aceite do mantenedor:** desligar o autostart e o botão virar "Enable autostart" na hora;
com todas as sessões do plano abertas, a janela dizer isso em vez de parecer quebrada.

**Relatório.**

*Item 1 — os dois botões devolvem a disponibilidade recomputada.* `DaemonControlResponse`/
`AutostartControlResponse` (`packages/app/src/ipc/channels.ts`) ganharam um campo
`availability`. Em `electron/main.ts`, o handler de `CHANNELS.daemonControl` roda a ação e
então repete o MESMO `checkLiveLock` que `buildStatusPanelText` já faz, devolvendo
`resolveDaemonControlAvailability(liveLockCheck)`; o handler de `CHANNELS.autostartControl`
força uma releitura (`resolveAutostartReport(null, ...)`, o mesmo helper do ciclo ambiente,
nunca uma segunda implementação) — isso substitui `autostartCache` por um valor fresco, então
o próximo ciclo de 10s também para de repetir o valor velho. `reduceDaemonControl`/
`reduceAutostartControl` (`state/*-control-panel.ts`) passaram a usar
`event.availability` (do próprio `finished`) em vez do `state.availability` anterior ao
clique, e o evento `clicked` agora é aceito também a partir de `result`, não só `idle` — sem
isso, o rótulo corrigiria na hora mas um segundo clique continuaria bloqueado até o próximo
`availabilityUpdated`. `renderer.ts`'s own `handleDaemonControlClicked`/
`handleAutostartControlClicked` seguem a mesma liberação.

*Item 2 — o painel "Hoje" explica quando não há nada para marcar.* Nova função pura
`hasResumableSession` (`state/today-panel.ts`), usada por `renderTodayPanel`
(`electron/renderer.ts`): quando nenhuma linha oferece caixa, aparece o texto
`MESSAGES.todayAllSessionsRunning` — *"All of today's planned sessions are already open —
nothing to resume."* — e o botão **Resume selected** nasce com `disabled = true` e sem
listener de clique (nunca um botão clicável que não faz nada).

*Item 3 — a linha de horário do status diz as duas coisas quando há adiamento/pulo.* Novo
tipo `TodayEndOfDayOverride` e função `resolveTodayEndOfDayOverride`
(`application/format-status.ts`), calculados a partir do MESMO `decideSchedule`/`DayState`
que `scheduler/daemon-state.ts#describeDaemonState` já lia para a seção do daemon —
`describeDaemonState` passou a devolver `{ report, todayEndOfDayOverride }`
(`DaemonStateReport`) em vez de só a string, e os três chamadores (`cli/daemon-command.ts`,
`cli/status-command.ts`, `app/src/state/status-panel.ts`) foram ajustados. A formatação nova
de `formatEndOfDayLine`:
- sem adiamento/pulo hoje: `End-of-day time: 19:30 local` (inalterado);
- adiado: `End-of-day time: 15:00 local (today: 15:30, after snoozing)`;
- pulado: `End-of-day time: 19:30 local (skipped today)`.

Nova função pura `localTimeString` (`core/day.ts`) extrai a formatação `"HH:MM"` que já
existia, local, dentro de `describeScheduleDecision` — reaproveitada nos dois lugares em vez
de duplicada.

**Testes.** `resolveTodayEndOfDayOverride`/`formatEndOfDayLine`
(`tests/unit/application/format-status.test.ts`), a linha combinada via
`runStatusCommand` (`tests/unit/cli/status-command.test.ts`, casos "skipped"/"snoozed"/"sem
adiamento"), `localTimeString` (`tests/unit/core/day.test.ts`), `hasResumableSession`
(`tests/unit/app/state/today-panel.test.ts`) e, para o item 1, o teste de regressão pedido
pelo item 4 da spec em `tests/unit/app/state/daemon-control-panel.test.ts` e
`tests/unit/app/state/autostart-control-panel.test.ts` — "a click right after the previous
result sends the freshly recomputed action, not the stale one", reproduzindo exatamente o
caso medido (desligar, depois um clique imediato manda `enable`, nunca `disable` de novo).

**Prova manual.** `SEEYA_APP_HOME_OVERRIDE` numa pasta descartável em `scratch/`,
`SEEYA_APP_OFFSCREEN=1` + `SEEYA_APP_SCREENSHOT_PATH`: a janela sobe limpa (sem exceção nos
handlers de IPC novos), painel "Hoje" e "Status" renderizam. A janela de captura embutida
(2.500ms após `did-finish-load`) é curta demais para o primeiro ciclo ambiente terminar sua
própria consulta real de `Autostart.status()`/`checkLiveLock` neste ambiente descartável
(sem daemon nem tarefa agendada), então os botões de daemon/autostart ainda não têm rótulo
nessa captura — o comportamento dos itens 1/2 em si é provado pelos testes de unidade acima
(dublê da porta `Autostart`/`LiveLockCheck`), não por este screenshot; nenhum `~/.claude`
ou `~/.seeya` real foi tocado.

**Portão.** `npm run verificar` completo: `format:check`, `tsc --noEmit`, `lint`, `build` e
`dependencias` verdes de primeira. `npx vitest run --project unit --project integration
--project integration-process --project guards --coverage` reproduziu, em duas rodadas
seguidas, um timeout pré-existente e alheio a esta tarefa em
`tests/integration/app/composition.test.ts` (4 testes que fazem I/O real — leitura de
instalação/registro do Windows — estourando o `testTimeout` padrão de 5000ms só sob o
overhead da instrumentação de cobertura); reproduzido também em cima do `main` sem nenhuma
mudança minha, confirmando que não é efeito desta tarefa. Com `--testTimeout=20000` (só o
prazo do runner, nenhum arquivo tocado), a mesma suíte fecha em 200 arquivos, 2057 testes
passando, 4 pulados, cobertura 96,41%/92,68%/94,97%/96,77% — acima dos pisos por diretório.
`npm run verificar:linux` não foi rodado (opcional).
<!-- SECTION:DESCRIPTION:END -->
