---
id: TASK-66
title: V2-T76 — Dividir format-project.ts e adapters/workspace/index.ts
status: To Do
assignee: []
created_date: '2026-10-01 19:21'
labels: []
milestone: m-0
dependencies: []
type: chore
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fecha a Q-100 e a Q-101: `packages/cli/src/format-project.ts` e `packages/engine/src/adapters/workspace/index.ts` passaram do teto de 500 linhas do AGENTS.md. Dividir por responsabilidade (a CLI por comando de projeto; o adaptador por grupo de operação, no mesmo recorte de `revert.ts`/`audit.ts`/`manifest-restore.ts`), sem mudar comportamento nem saída (a CLI byte-idêntica, provada pelos testes existentes), preservando comentários e usando `git mv`/commits de movimento separados. Nenhuma API pública muda; importadores atualizados. Fechar Q-100 e Q-101 em docs/QUESTOES.md.
<!-- SECTION:DESCRIPTION:END -->
