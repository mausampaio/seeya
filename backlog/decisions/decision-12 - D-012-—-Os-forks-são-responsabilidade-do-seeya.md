---
id: decision-12
title: D-012 — Os forks são responsabilidade do seeya
date: '2026-09-23 10:54'
status: accepted
---
## Contexto

`--fork-session` copia o transcript inteiro para um arquivo novo em
`~/.claude/projects/`. Sem tratamento, o `seeya` descobriria os próprios forks como sessões e
tentaria capturá-los, gerando novos forks — laço de realimentação.

## Decisão

Todo `sessionId` de fork criado pelo `seeya` é registrado em
`~/.seeya/forks.json`. A descoberta **exclui** esses IDs. Forks com mais de
`forkCleanupDays` (default 7) são apagados.

## Consequências

Apagar arquivo dentro de `~/.claude/projects/` é a **única** exceção à regra
"nunca escreva em `~/.claude/`", e vale exclusivamente para forks que o próprio `seeya` criou e
registrou. Qualquer outro arquivo ali é intocável.
