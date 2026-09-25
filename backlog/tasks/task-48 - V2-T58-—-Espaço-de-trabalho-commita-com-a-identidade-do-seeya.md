---
id: TASK-48
title: V2-T58 — Espaço de trabalho commita com a identidade do seeya
status: To Do
assignee: []
created_date: '2026-09-25 21:24'
labels: []
milestone: m-0
dependencies: []
priority: high
type: bug
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T58 — O espaço de trabalho commita sempre com a identidade do seeya.** Decisão do mantenedor em
2026-09-25, registrada como emenda à **D-047**, a partir do uso real no Ubuntu dele: o git global da
máquina tinha nome mas não e-mail, o commit de uma sessão falhou, e a sessão **gravou sozinha** um
`user.email` local no repositório do espaço de trabalho para conseguir commitar.

**O que entra:**

1. **Identidade local do espaço de trabalho**: ao inicializar o espaço de trabalho **e a cada
   `open`** (como os ganchos, reafirmada sempre), o seeya grava no repositório do espaço de trabalho
   — `git config --local`, **nunca** `--global` — `user.name`/`user.email` iguais à identidade que
   os commits do próprio seeya já usam (`adapters/workspace/index.ts#COMMIT_IDENTITY_ENV`), num lugar
   só (a constante passa a servir aos dois). Sobrescreve uma identidade local que alguém tenha posto
   ali (o caso do mantenedor); não toca em mais nada da configuração.
2. **As regras de trabalho** (`core/project-working-rules.ts`, V2-T34 item 5) ganham: não alterar a
   configuração do git; a identidade já vem pronta, e a autoria da sessão sai nos trailers.
3. **Teste que reproduz o caso**: um espaço de trabalho descartável, sem identidade global
   (`GIT_CONFIG_GLOBAL` apontando para arquivo vazio, `GIT_CONFIG_NOSYSTEM=1`), e um commit feito como
   a sessão faria (sem as variáveis de identidade no ambiente, com o gancho instalado) — tem de passar,
   com o autor igual à identidade do seeya e os trailers da sessão. Falha antes da correção.

**Cuidados:** nada no espaço de trabalho real (o do mantenedor será corrigido pelo próprio `open`
depois de instalado); texto das regras num lugar só; nome da identidade não muda (não é chave nova em
disco, é valor que já existe).

**Aceite do mantenedor:** no Ubuntu, depois de instalar, abrir um projeto, pedir à sessão um commit, e
ele passar sem ela mexer em configuração; `git -C ~/.seeya/workspace config --local --list` mostra a
identidade do seeya.
<!-- SECTION:DESCRIPTION:END -->
