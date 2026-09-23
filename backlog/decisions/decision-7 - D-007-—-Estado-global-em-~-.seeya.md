---
id: decision-7
title: D-007 — Estado global em ~/.seeya
date: '2026-09-23 10:53'
status: accepted
---
## Contexto

## Decisão

Config, estado, handoffs e histórico ficam em `~/.seeya/`. O app
**nunca** escreve dentro dos repositórios das sessões capturadas.

## Consequências

O `start-day` lê tudo de uma fonte só. Nenhum `.gitignore` de terceiro
precisa ser tocado. O caminho raiz é injetável para que os testes rodem em `tmpdir`.
