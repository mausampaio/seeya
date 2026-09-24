---
id: decision-44
title: 'D-044 — A CI não roda para push que só toca docs/ ou AGENTS.md'
date: '2026-09-24 00:47'
status: accepted
---
## Contexto

**Decisão do mantenedor, em 2026-09-16.**

Os dois workflows (`ci.yml`, `codeql.yml`) ganharam `paths-ignore: ['docs/**', 'AGENTS.md']` no
push e no pull request. **Medido antes de decidir:** nada do portão lê esses caminhos — o único
código que toca `docs/` é `scripts/spike-j-measure.mjs`, que grava os dados brutos do spike J e
nunca roda na CI; o `.prettierignore` já excluía os dois. Um push só de documentação custava três
sistemas por sete minutos para provar o que já se sabia, e ainda sorteava o flake do Windows
(Q-064) de graça.

## Decisão

**Por caminho, não por tipo de commit.** A lista de arquivos do push é fato; o prefixo `docs:` é
afirmação de quem escreveu, e um `docs:` que por engano tocasse código passaria sem portão.
`README.md`, `INDEX.md` e `CLAUDE.md` continuam disparando a CI porque o `prettier` os confere.

## Consequências

**O que isto não decide:** conventional commits com ferramenta (`commitlint`) e changelog/semver
gerados a partir deles. Os prefixos já são usados à mão; a ferramenta entra como decisão própria
na fronteira da v2 (D-041), quando houver o que publicar.
