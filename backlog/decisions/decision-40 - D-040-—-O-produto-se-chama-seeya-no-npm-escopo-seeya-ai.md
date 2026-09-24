---
id: decision-40
title: 'D-040 — O produto se chama seeya; no npm, escopo @seeya-ai'
date: '2026-09-24 00:43'
status: accepted
---
## Contexto

Título original completo: "O produto se chama `seeya`: repositório, pasta e binário; no npm,
escopo `@seeya`".

**Decisão do mantenedor, em 2026-09-13.** O nome longo (`see-you-tomorrow-ai`) sai do repositório
e da pasta; o produto, o binário e o escopo npm são `seeya`.

**O fato que forçou a decisão:** `seeya` como pacote npm já está ocupado (um `0.0.0` parado desde
2022). Renomear na fronteira de versão, como a D-039 previa, não era só trocar string.

## Decisão

A saída é **escopo**: `@seeya/cli`, que abre espaço para outros pacotes (`@seeya/core`,
`@seeya/app`) sem disputar nome. Verificado em 2026-09-13: nenhum usuário nem organização `seeya`
no npm, nenhum pacote no escopo `@seeya` — mas o npm **recusou** a organização `seeya`, porque o
nome colide com o pacote existente. **A organização `seeya-ai` foi criada pelo mantenedor em
2026-09-13**, e o pacote é `@seeya-ai/cli`; **o binário continua `seeya`**.

## Consequências

O repositório no GitHub é renomeado (o GitHub redireciona a URL antiga); a pasta local muda, o que
refaz o `npm link` e muda a chave que o Claude Code usa para memória e transcripts daquele
diretório; `package.json` ganha o nome escopado; os documentos que citam o nome longo são
atualizados onde ele é identificador, não onde é história. Tudo isso numa tarefa só (S5-T0), num
momento sem agente no ar.
