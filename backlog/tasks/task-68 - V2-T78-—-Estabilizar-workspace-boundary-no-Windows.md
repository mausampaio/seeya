---
id: TASK-68
title: V2-T78 — Estabilizar workspace-boundary no Windows
status: To Do
assignee: []
created_date: '2026-10-02 00:54'
labels:
  - test
dependencies: []
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
tests/integration/application/workspace-boundary.test.ts, caso 'workspace.json (the pointer to where the workspace lives) is written outside the workspace itself', estourou 5000ms e deixou EBUSY no rmdir do diretório temporário no Windows sob carga paralela — duas vezes em 2026-10-01 (agente da V2-T69 localmente; CI windows-latest do commit beb731d, run 36944338002, verde no rerun). Achar a causa (processo git filho ainda segurando o diretório? timeout curto demais para o que o caso faz?) e corrigir a causa, não só aumentar o timeout; se o timeout for de fato a resposta, medir e justificar o número. Regra de AGENTS.md: paralelismo expõe corrida — não serializar o arquivo para esconder.
<!-- SECTION:DESCRIPTION:END -->
