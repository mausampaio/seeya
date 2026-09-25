---
id: TASK-41
title: V2-T51 — Dividir renderer.ts e main.ts abaixo de 500 linhas
status: To Do
assignee: []
created_date: '2026-09-25 03:41'
labels: []
milestone: m-2
dependencies: []
references:
  - packages/app/src/electron
priority: low
type: chore
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T51 — Dividir `renderer.ts` e `main.ts` abaixo do teto de 500 linhas.** Achado do PO ao
especificar a V2-T30 (2026-09-24): `packages/app/src/electron/renderer.ts` tem ~1.390 linhas e
`main.ts` ~1.130, contra o teto de 500 do `AGENTS.md` ("se um começar a crescer, o sinal é que ganhou
uma segunda responsabilidade"). A V2-T30 foi proibida de engordá-los e não os dividiu, de propósito:
dividir o que existe é trabalho próprio.

**O que entra:** separar cada arquivo por responsabilidade — no `main.ts`, os grupos de handlers de
IPC (sessões, painel Hoje, end-day, daemon/autostart, configurações, projetos), o ciclo de
atualização e a criação da janela; no `renderer.ts`, cada painel da lateral, as abas/terminal e os
diálogos. O que for **lógica** (decisão, texto, transição) sai para módulos puros testados em
`state/`/`sidebar/`/`ipc/`/`text/`, como a V2-T30 fez; `electron/` fica só com fiação de DOM/Electron.

**Regras:** refatoração pura — nenhum comportamento muda, nenhum texto muda; os testes existentes
passam sem editar o esperado; os comentários com medição são **preservados** e acompanham o código
que explicam. Nenhum arquivo acima de 500 linhas no fim.

**Custo:** subida e repouso remedidos em A/B na mesma sessão (lição da Q-096) — não pode piorar.

**Aceite:** do PO — portão verde, nenhum arquivo acima de 500 linhas, A/B sem piora; do mantenedor —
usar a janela normalmente um dia e não notar diferença nenhuma.
<!-- SECTION:DESCRIPTION:END -->
