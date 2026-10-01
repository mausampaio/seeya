---
id: TASK-67
title: V2-T77 — Retomar sessão de projeto pelo fluxo do open
status: To Do
assignee: []
created_date: '2026-10-01 21:03'
labels: []
milestone: m-0
dependencies: []
priority: high
type: feature
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 5a. Caso real do mantenedor (2026-10-01): a máquina reiniciou no meio de uma sessão aberta por `open` e não havia como voltar a ela pelo seeya — só por `claude --continue` manual no diretório do projeto, sem lock nem proteções. Entra: (1) no motor, `openProject` aceita uma sessão para retomar (`--resume <id>` no lugar de `--session-id` novo), com lock, ganchos, CLAUDE.md, restauração do seeya.json e pergunta de mudanças pendentes iguais ao open; o lock registra a sessão retomada; (2) CLI `seeya project open <id> --resume <sessão>` (id ou prefixo); (3) janela: Resume nas sessões de cada projeto (aba Projects) e no Resume da aba Sessions quando a sessão é de um projeto. Recusa (D-024, com motivo) se a sessão estiver viva. Depois da interface (V2-T67 a V2-T71), por decisão do mantenedor; a V2-T67/V2-T68 deixam o lugar do botão previsto.
<!-- SECTION:DESCRIPTION:END -->
