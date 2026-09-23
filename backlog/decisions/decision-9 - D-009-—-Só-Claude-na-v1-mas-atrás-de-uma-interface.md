---
id: decision-9
title: 'D-009 — Só Claude na v1, mas atrás de uma interface'
date: '2026-09-23 10:53'
status: accepted
---
## Contexto

## Decisão

A v1 suporta exclusivamente o Claude Code, porém a descoberta e a captura ficam
atrás das interfaces `ProvedorDeSessoes` e `GeradorDeHandoff`. Nenhum outro harness é
implementado agora.

## Consequências

Nada específico do Claude pode vazar para `core/`. Adicionar Cursor ou
Codex depois deve ser escrever um adapter novo, não editar o núcleo.
