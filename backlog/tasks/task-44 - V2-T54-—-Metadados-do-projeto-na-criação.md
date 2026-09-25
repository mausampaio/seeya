---
id: TASK-44
title: V2-T54 — Metadados do projeto na criação
status: To Do
assignee: []
created_date: '2026-09-25 12:41'
labels: []
milestone: m-0
dependencies: []
priority: low
type: feature
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T54 — Metadados do projeto na criação (a especificar).** Sugestão do mantenedor em 2026-09-25,
no teste da V2-T34: ao criar um projeto, pela CLI ou pela janela, a pessoa poderia já informar
informações que servem de metadado — descrição, rótulos "e coisas do gênero".

**Por que importa:** hoje o projeto nasce só com o id (`seeya project create <id>`); o
`seeya.json` guarda `name` igual ao id, porque nenhum nome de exibição é pedido. Uma descrição curta
dada pela pessoa é o contexto mais barato e mais confiável que uma sessão nova pode receber — melhor
que o que ela adivinha a partir do id.

**A especificar, mais para frente:** quais campos (nome de exibição, descrição, rótulos, harness
padrão, trackers — alguns já existem vazios no `seeya.json`), quais são opcionais (a regra: **todos**,
criar um projeto continua sendo um comando só), onde aparecem (o `AGENTS.md`/`INDEX.md` do esqueleto,
a lateral da janela, `project show`), e se dá para editar depois. Chave nova em `seeya.json` é
identificador em disco: entra no glossário antes do código.
<!-- SECTION:DESCRIPTION:END -->
