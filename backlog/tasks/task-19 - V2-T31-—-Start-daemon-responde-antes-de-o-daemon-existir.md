---
id: TASK-19
title: V2-T31 — Start daemon responde antes de o daemon existir
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
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
