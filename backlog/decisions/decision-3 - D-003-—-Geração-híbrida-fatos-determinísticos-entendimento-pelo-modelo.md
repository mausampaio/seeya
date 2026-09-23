---
id: decision-3
title: 'D-003 — Geração híbrida: fatos determinísticos + entendimento pelo modelo'
date: '2026-09-23 10:52'
status: accepted
---
## Contexto

## Decisão

Todo handoff tem duas camadas:

1. **Fatos** — extraídos localmente, sem custo e sem rede: últimos prompts do usuário,
   arquivos tocados, branch e sujeira do git no `cwd`, timestamp da última atividade.
2. **Entendimento** — o que estava sendo feito, o que falta e o plano de amanhã, escrito pelo
   Claude headless a partir dos fatos + transcript.

**Decisão de falha.** Se a camada 2 falhar (rede, cota, timeout, binário ausente), o handoff é
gravado **mesmo assim**, só com os fatos, e marcado `source: "deterministic"`. O encerramento
do dia nunca falha inteiro por causa do modelo.

## Consequências

A camada 1 é testável sem rede e é o que os testes cobrem com rigor. A
camada 2 é sempre mockada nos testes.
