---
id: decision-4
title: D-004 — "Iniciar o dia" retoma a sessão original
date: '2026-09-23 10:53'
status: accepted
---
## Contexto

## Decisão

`seeya start-day` executa `claude --resume <sessionId>` no `cwd` original de cada
sessão pendente, injetando o plano do dia anterior como primeiro prompt.

## Consequências

- O `sessionId` do dia anterior precisa ser persistido no handoff.
- Se o `--resume` falhar (sessão expirada, projeto movido), o fallback é abrir sessão nova com
  o handoff como contexto — e avisar o usuário que houve fallback.
- Retomar N sessões significa N processos. A v1 pergunta quais retomar em vez de disparar
  todas de uma vez.
