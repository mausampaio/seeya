---
id: TASK-42
title: V2-T52 — Sessão fechada aparece como unknown
status: To Do
assignee: []
created_date: '2026-09-25 11:12'
labels: []
milestone: m-2
dependencies: []
priority: low
type: bug
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T52 — Sessão fechada aparece como `unknown`.** Aceite da V2-T29/V2-T30 pelo mantenedor
(2026-09-25): a sessão adotada, depois de fechada, aparece no projeto como `unknown`; e uma sessão
nova, aberta pelo `open` e fechada, também.

**Por que acontece, e está certo pelas regras:** o seeya sabe se uma sessão está viva pelo registro
de processos do Claude Code (um arquivo por sessão aberta, com o pid). Quando a sessão fecha, esse
registro some, e sobra só o transcript — sem pid para conferir. Pela D-016 com a D-025, o estado é
`unknown` (`core/classification.ts`). A regra é honesta; **o rótulo é que engana**: para quem acabou
de fechar a sessão, "unknown" parece erro.

**O que entra:** trocar só o **texto mostrado** para sessão sem pid — na janela e na CLI (`seeya
sessions`, painel de projetos, "Other sessions") — por uma frase que diga o fato sem afirmar mais do
que se sabe: algo como **"no running process"** (não se achou processo em execução). O valor de
enum `unknown` em disco e no código **não muda** (é identificador, D-027), nem a regra de
classificação — mudar a regra (tratar ausência de registro como "encerrada") exigiria medir se o
Claude Code sempre apaga o registro ao sair, e é outra decisão.

**Cuidados:** o texto mora num lugar só, compartilhado CLI↔janela (mesmo movimento da V2-T35/V2-T30);
testes que afirmam o rótulo antigo mudam junto, e um teste novo fixa que o enum continua `unknown`.

**Aceite do mantenedor:** fechar uma sessão e ver o rótulo novo na janela e no `seeya sessions`.
<!-- SECTION:DESCRIPTION:END -->
