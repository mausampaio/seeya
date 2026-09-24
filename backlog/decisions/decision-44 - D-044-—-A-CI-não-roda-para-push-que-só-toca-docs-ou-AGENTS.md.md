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

## Nota do PO (2026-09-23): `backlog/` NÃO entra na lista, e o motivo inverte o achado

A revisão da V2-T39 apontou que `paths-ignore` ficou em `['docs/**', 'AGENTS.md']` mesmo depois de a
D-048 mover tarefas e decisões para `backlog/`, e sugeriu que o raciocínio desta decisão valeria
igual ali. **Vale o contrário, e por um detalhe que nasceu depois:** o portão **passou a ler**
`backlog/`. `tests/integration/guards/backlog-names.test.ts` (2026-09-23) confere o tamanho dos
títulos e a sincronia entre título e nome de arquivo de cada tarefa e decisão — foi criado porque um
título-frase gerou um nome de 204 caracteres e impediu um `git worktree add` de rodar no Windows.

Com esse guard no lugar, um commit só de `backlog/` **muda o resultado do portão**, que é exatamente
o critério desta decisão. Ignorá-lo na CI faria um título fora do limite passar sem ninguém ver até
alguém rodar o portão local. Então `backlog/` fica de fora do `paths-ignore` **por decisão**, não por
esquecimento — e o custo (a CI rodar nos três sistemas num commit de documentação) é conhecido e
aceito.

