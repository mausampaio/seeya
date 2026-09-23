---
id: decision-2
title: 'D-002 — Encerrar a sessão viva é opt-in, por sessão'
date: '2026-09-23 10:52'
status: accepted
---
## Contexto

## Decisão

O comportamento padrão do encerramento é: gerar o handoff, notificar o usuário e
**deixar a sessão viva intacta**. O usuário pode marcar sessões específicas como
`canTerminate: true` na config; só essas têm o processo finalizado após o handoff ser gravado
com sucesso.

## Consequências

- A política vive em `config.json`, chaveada por `cwd` (não por `sessionId`, que muda a cada
  sessão nova).
- Encerrar exige, nesta ordem: handoff gravado e verificado em disco → só então terminar o
  processo. Falha na captura aborta o encerramento daquela sessão.
- Terminação é graciosa primeiro (SIGTERM / equivalente Windows), com prazo, e o app **não**
  faz kill forçado na v1.
