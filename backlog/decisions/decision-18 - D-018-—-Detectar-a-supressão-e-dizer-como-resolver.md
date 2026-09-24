---
id: decision-18
title: D-018 — Detectar a supressão e dizer como resolver
date: '2026-09-24 00:10'
status: accepted
---
## Contexto

## Decisão

Quando o `seeya` encontra uma sessão registrada sem transcript, ele não se limita a degradar o
handoff (D-013): informa **a causa provável e a correção**, uma vez por `sessionId`.

```
Sessão "agente-interno-ui-03" (c:\work\projeto) está sem transcript.
Causa provável: marcador de sessão filha herdado (sessão aberta de dentro de outra sessão).
Correção: definir CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 no ambiente de quem abre a sessão.
O handoff desta sessão usará git e worktree como fonte.
```

## Consequências

- O `seeya` registra a versão do Claude Code observada em cada handoff — o comportamento varia
  entre versões na mesma máquina (2.1.201 e 2.1.233 coexistindo foi o caso real).
- A captura profunda (D-011) detecta sessão suprimida e **cai para enxuto** em vez de tentar um
  `--resume` que o produto já declara que vai falhar.
