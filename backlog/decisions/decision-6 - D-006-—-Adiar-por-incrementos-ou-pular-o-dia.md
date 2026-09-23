---
id: decision-6
title: 'D-006 — Adiar por incrementos, ou pular o dia'
date: '2026-09-23 10:53'
status: accepted
---
## Contexto

## Decisão

Quando a notificação de encerramento dispara, o usuário pode:
- **adiar** por um incremento (+15min, +30min, +1h);
- **pular hoje**, o que desliga o encerramento automático até o próximo dia;
- deixar passar, e o encerramento acontece.

## Consequências

O estado de adiamento é persistido em `estado.json` e é por dia. Reiniciar o
daemon não zera adiamentos já feitos. Não há limite de adiamentos — "pular hoje" é a válvula
de escape explícita, então forçar um teto seria redundante.
