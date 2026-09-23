---
id: TASK-31
title: 'V2-T40 — Ganchos por harness: a família'
status: To Do
assignee: []
created_date: '2026-09-23 11:05'
labels: []
milestone: m-5
dependencies: []
references:
  - docs/V2-RUMO.md
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T40 — Ganchos por harness: a família.** Especificada pelo PO em 2026-09-23, a partir de
uma leitura do mantenedor no mesmo dia: o gancho antes da compactação não é uma tarefa, é uma
**família de tarefas, uma por harness** — "claude, codex, gemini...".

**Por que existe.** Duas necessidades diferentes já apontam para o mesmo lugar:

- **Guardar o saber-fazer antes de a compactação apagá-lo** (relato do mantenedor, 2026-09-21: uma
  sessão longa esqueceu qual skill usava para chegar ao banco e foi caçar credencial em manifesto).
  O momento certo de escrever é imediatamente antes da compactação, e alguns harnesses avisam.
- **Recusar o que fura as guardas** (D-047 item 5, V2-T34): um gancho no diretório do projeto que
  bloqueia `--no-verify` e a troca do diretório de ganchos do git.

**O que esta tarefa-pai guarda:** a **matriz de capacidades por harness** — para cada um: tem gancho
antes da compactação? tem gancho antes de executar comando? onde a configuração mora (tem de ser
**dentro do projeto**, nunca em `~/.claude` ou equivalente)? o que já foi medido e o que não? A
matriz vive em `docs/` e é o que impede alguém supor que o que vale para um vale para todos.

**Como cresce:** um filho por harness, criado **só quando houver o que medir** — nada de tarefa
vazia para ferramenta que ninguém usa aqui. O primeiro é o Claude Code (V2-T41). Codex e outros
entram quando alguém for usá-los de verdade neste projeto.

**O que não entra:** implementar o gancho (é do filho); escrever em configuração global de qualquer
harness — a regra do projeto continua: nada fora de `~/.seeya/` e do espaço de trabalho.
<!-- SECTION:DESCRIPTION:END -->
