---
id: TASK-47
title: V2-T57 — Janela de verificação não mexe no protocolo real
status: To Do
assignee: []
created_date: '2026-09-25 17:05'
labels: []
milestone: m-2
dependencies: []
priority: medium
type: bug
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T57 — Janela de verificação não mexe no protocolo real.** Achado do PO em 2026-09-25, depois de
duas verificações de agente seguidas (V2-T30 e V2-T55) registrarem o esquema `seeya-dev` no registro
real do Windows, apontando para o Electron de uma worktree que depois some — e, na primeira vez, de
gravarem `activeScheme: "seeya-dev"` no `~/.seeya/protocol-handler.json` real, o que desviaria o
clique dos avisos do app instalado do mantenedor.

**A regra, determinística:** quando a janela sobe com `SEEYA_APP_HOME_OVERRIDE` (a instrumentação que
existe para um agente provar a janela contra um home descartável), ela **não registra esquema de
protocolo** e **não grava o marcador** — em lugar nenhum. Uma janela de verificação nunca tem motivo
para ser o app que abre os avisos da pessoa. Hoje isso é só uma armadilha escrita em
`docs/FLUXO-DE-AGENTES.md` ("essa parte não tem isolamento"), e já falhou duas vezes.

**O que entra:** a decisão pura ("esta janela deve registrar o protocolo?") testada nos dois casos
— com e sem a variável —, usada por `electron/main.ts#registerProtocolHandler` e pela gravação do
marcador; a armadilha do `FLUXO-DE-AGENTES.md` atualizada para dizer que agora há isolamento, e onde
ele termina (`npm run app` sem a variável continua registrando, como deve para o desenvolvimento do
mantenedor).

**Cuidados:** comportamento do app instalado e do `npm run app` não muda; nada no registro real
durante a própria tarefa (a prova é o teste da decisão e uma janela com a variável, conferindo a
chave antes e depois).

**Aceite:** do PO — a chave `seeya-dev` e o marcador intocados depois de uma janela de verificação.
<!-- SECTION:DESCRIPTION:END -->
