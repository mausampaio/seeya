---
id: decision-14
title: 'D-014 — O wrapper PTY é v2, e é aditivo'
date: '2026-09-24 00:08'
status: accepted
---
## Contexto

## Decisão

O `seeya claude` — subir o Claude dentro de um PTY controlado pelo `seeya`, para poder pedir o
handoff à própria sessão — fica para a v2. Quando chegar, **coexiste** com a descoberta: será o
modo recomendado de abrir sessão, mas a descoberta continua funcionando para tudo que for aberto
sem ele. Nada passa despercebido por não ter usado o wrapper.

## Consequências

- A descoberta é o piso permanente da arquitetura, nunca substituída pelo wrapper.
- `ProvedorDeSessoes` precisa suportar duas origens simultâneas sem duplicar sessão: uma sessão
  aberta via wrapper aparece **uma vez**, não duas.
- É o caminho para harnesses sem transcript legível (codex e afins), conforme D-009.
- Riscos conhecidos, a tratar quando for a hora: `node-pty` é dependência nativa; o passthrough
  precisa ser impecável (resize, raw mode, alt screen, Ctrl+C); injetar texto com um diálogo de
  permissão aberto responde o diálogo. O wrapper pede o handoff **em arquivo**, nunca lê a tela.
