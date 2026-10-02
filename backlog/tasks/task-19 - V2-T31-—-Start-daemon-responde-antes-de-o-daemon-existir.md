---
id: TASK-19
title: V2-T31 — Start daemon responde antes de o daemon existir
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-10-02 21:36'
labels: []
milestone: m-1
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: bug
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T31 — Correção: "Start daemon" responde antes de o daemon existir.** Especificada pelo
PO em 2026-09-21 a partir do aceite da V2-T21 pelo mantenedor, no mesmo dia. Pequena, e com
a causa localizada.

**O que o mantenedor viu.** O botão de autostart passou a funcionar como deveria: fica em
"carregando" e, quando termina, já mostra o estado oposto. O de daemon, não: a mensagem
"subiu" aparece quase na hora, mas **o botão continua "Start daemon"** até o ciclo de
atualização seguinte. Pergunta dele: é tempo de subida ou atualização de tela? E a sugestão:
*"se for tempo de subida vale um loading/disable como acontece com o autostart"*.

**Causa: é tempo de subida.** `AppContext.startDaemon`
(`packages/app/src/composition/index.ts`) lança o daemon destacado e **volta imediatamente**
— a mensagem sai antes de o processo novo ter tempo de subir e gravar o `daemon.lock`. A
V2-T21 fez a resposta trazer a disponibilidade recomputada, e ela recomputa certo — só que
num instante em que o lock ainda não existe, então a resposta diz, com razão, "não está
rodando". O autostart não tem esse problema porque a ação dele termina quando o registro já
está gravado.

**O que entra:**
1. **"Start daemon" só responde quando o daemon existe de fato**: depois de lançar, espera o
   `daemon.lock` aparecer vivo (mesma `checkLiveLock` de sempre), com prazo curto e medido —
   e o botão fica em "carregando", desabilitado, durante a espera, como o do autostart. O
   prazo e o intervalo da espera vêm de medição do tempo real de subida do daemon nesta
   máquina, registrada em comentário perto do código — não um número escolhido.
2. **Se o prazo vencer, a resposta diz a verdade**: lançado, mas ainda sem confirmação de que
   subiu (D-025) — nunca "subiu" sem ter visto o lock, e nunca "falhou" sem ter visto a falha.
3. **"Stop daemon" conferido.** Pelo código ele já espera o processo morrer e limpa o lock
   antes de responder; confirmar com teste que o botão vira "Start" na resposta, e corrigir
   se não virar.
4. **Teste** do caso lento (o lock aparece depois de algumas tentativas), do caso que vence
   o prazo, e do caso imediato — com relógio e armazenamento dublês, nunca espera real.

**O que não entra:** mudar como o daemon é lançado; mexer no ciclo de 10 segundos.

**Cuidados:** a espera usa a porta `Clock` (D-019), nunca `setTimeout` solto; nenhuma
dependência nova; nada no `~/.seeya` real.

**Aceite do mantenedor:** clicar em "Start daemon", ver o botão em "carregando" por um
instante e virar "Stop daemon" sozinho, sem esperar o ciclo.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Entrega (2026-10-02).** `packages/app/src/composition/daemon-start.ts#startDaemonAndWait` lança o
daemon e espera o `daemon.lock` aparecer vivo (`checkLiveLock`, a mesma de sempre) pela porta
`Clock` (D-019), antes de responder. `AppContext.startDaemon` (`composition/index.ts`) agora só
chama isso e `formatDaemonStartOutcome`. Resultado como união discriminada (D-024/D-025):
`alreadyRunning` / `confirmed` (lock visto, pid do lock) / `launchedUnconfirmed` ("Launched the
daemon (pid N), but it has not written its lock within 10s, so it is not confirmed as running" —
nunca "started", nunca "failed"). O botão já tinha `loading={daemon.kind === 'running'}` e o
rodapé já mostra `resultText`; a resposta do IPC já recomputa a disponibilidade, então nenhuma
mudança de tela foi necessária.

**Medição (Windows 11, Node 22 rodando o `packages/cli/dist` compilado contra uma home
descartável via `USERPROFILE`/`HOME`, `SEEYA_DAEMON_CHILD=1`, 32 lançamentos, do retorno do spawn
até `daemon.lock` legível em disco, sondado a cada 5ms; cada daemon encerrado e a home apagada):**
12 primeiras: 2286 1024 822 887 782 761 1143 791 868 974 951 776 ms; 20 seguintes: 781 879 952
1200 757 820 874 762 780 827 743 746 743 772 759 760 741 822 760 745 ms. Mediana ~790ms, 31 de 32
entre 741 e 1200ms, um outlier frio de 2286ms (o primeiro lançamento). Escolhas: prazo 10s (~4x o
pior caso visto), intervalo 100ms (~8 leituras por subida típica). **Não medido:** o Electron como
Node (`ELECTRON_RUN_AS_NODE`) — o binário não estava instalado na worktree de verificação; a
margem do prazo cobre a subida mais lenta esperada dele. O prazo conta só os `sleep`, então o
tempo real pode exceder um pouco por causa do custo de cada `isAlive`.

**Stop daemon (item 3).** Conferido por teste: depois de `runDaemonStop`, a disponibilidade que o
handler recomputa (`checkLiveLock` + `resolveDaemonControlAvailability`) é `start`. Não precisou
de correção.

**Testes:** `tests/unit/app/composition/daemon-start.test.ts` — imediato, lento (3 sondagens),
prazo vencido (100 sleeps de 100ms, texto sem "started"/"failed"), recusado, e o Stop; duplos
nomeados, nenhuma espera real.

**Capturas:** não feitas — o binário do Electron não existe nesta worktree, então não há janela
real para fotografar; prova por teste e medição.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-02 21:36
---
Revisão do PO (2026-10-02): Start daemon passa a esperar o daemon.lock vivo pela porta Clock (prazo 10s, intervalo 100ms, justificados por 32 subidas reais contra home descartável: 741–1200ms típico, 2286ms no pior caso); resultado em união discriminada alreadyRunning/confirmed/launchedUnconfirmed (nunca 'subiu' sem ver o lock, nunca 'falhou' sem ver a falha). Stop conferido por teste — o botão vira Start na resposta. Sem captura: a tela não mudou (o botão já tinha loading). Não medido: subida com Electron-como-node (a margem de 10s cobre). Mesclada no po-gate; portão do zero e npm test sem identidade git verdes (3744 testes). Agente Sonnet 5.5 (28 min).
---
<!-- COMMENTS:END -->
