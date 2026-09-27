---
id: TASK-48
title: V2-T58 — Espaço de trabalho commita com a identidade do seeya
status: Review
assignee: []
created_date: '2026-09-25 21:24'
updated_date: '2026-09-27 11:01'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Relatório do agente (branch `tarefa/V2-T58-identidade-do-espaco`, worktree isolada, a partir da
`main` em `b0e50ea`).**

1. **Porta e adaptador.** `WorkspaceRepository.configureIdentity(root)` (`core/ports.ts`) —
   `git config --local user.name`/`user.email`, nunca `--global`. Implementada em
   `adapters/workspace/index.ts#FsWorkspaceRepository`, reusando `SEEYA_IDENTITY_NAME`/
   `SEEYA_IDENTITY_EMAIL` — extraídas de `COMMIT_IDENTITY_ENV` (o mesmo que `commitAll` já
   injetava via env), num lugar só, como a tarefa pede. `git config --local <key> <value>`
   sobrescreve um valor já existente (o caso do mantenedor no Ubuntu) e não toca em mais
   nenhuma chave.
2. **Orquestração.** `application/workspace-identity.ts#ensureWorkspaceIdentityConfigured` —
   mesmo formato fininho de `ensureWorkspaceHooksInstalled` (o precedente citado na tarefa).
   Chamada em `application/workspace.ts#createProject` (logo depois de
   `ensureWorkspaceHooksInstalled`) e no início de `application/project-open.ts#openProject`
   (mesmo ponto e mesma razão do gancho de git — reasserida a cada `open`).
3. **Regras de trabalho.** `core/project-working-rules.ts` ganhou a linha "Do not change git
   configuration... the identity commits use here is already set up, and which session wrote
   what is the trailers above, not git identity." Texto continua em 1536 caracteres, bem abaixo
   do teto de 4000.
4. **Teste de regressão (item 3 da tarefa).** `tests/integration/workspace/local-identity.test.ts`
   — espaço de trabalho descartável, gancho `commit-msg` real (CLI compilada), `GIT_CONFIG_GLOBAL`
   apontando para um arquivo vazio e `GIT_CONFIG_NOSYSTEM=1`, e um `git commit` sem nenhuma
   variável `GIT_AUTHOR_*`/`GIT_COMMITTER_*` (como uma sessão rodaria). Com `configureIdentity`
   chamado, o commit passa com autor `seeya <seeya@localhost>` e os dois trailers; sem chamar
   (segundo teste do arquivo, documentando o estado anterior a esta tarefa) o mesmo commit falha
   com "Author identity unknown" — a reprodução exata do incidente do mantenedor.
   Confirmei que a correção realmente muda o comportamento: comentei temporariamente as duas
   chamadas de `ensureWorkspaceIdentityConfigured` (em `workspace.ts`/`project-open.ts`) e os
   dois novos testes unitários que checam `configureIdentityCalls` falharam
   (`expected [] to have a length of 1` / `expected [] to deeply equal [...]`); restaurei e os
   38 testes dos dois arquivos voltaram a passar.
5. **Cobertura adicional.** Caso permitido/sobrescrita e "não toca em outra chave" em
   `tests/integration/workspace/fs-workspace-repository.test.ts` (`describe('configureIdentity
   (V2-T58, D-047 emendment)')`); testes unitários da orquestração fininha em
   `tests/unit/application/workspace-identity.test.ts`; asserções de reafirmação em
   `tests/unit/application/workspace.test.ts`/`project-open.test.ts`; nova regra coberta em
   `tests/unit/core/project-working-rules.test.ts`.
6. **Glossário.** Nova linha em `AGENTS.md` — "identidade local do espaço de trabalho (V2-T58,
   emenda de 2026-09-25 à D-047)", ao lado da entrada dos ganchos de git.

**Verificação.** `npm run verificar`: verde (278 arquivos de teste, 2849 testes, 4 pulados;
cobertura 96.23% linhas geral, `engine/src/core` 99.46%). Separadamente,
`GIT_CONFIG_GLOBAL=<arquivo vazio> GIT_CONFIG_NOSYSTEM=1 npm test`: verde (mesmos 278/2849/4).

**Nada tocado fora do escopo:** nenhum `~/.seeya`/`~/.claude` real, nenhum espaço de trabalho
real, nenhuma instalação, nenhum daemon/autostart real.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-27 11:01
---
Revisão do PO (2026-09-27): aprovada para publicar. Conferido que a adoção também reafirma a identidade (adoptSession chama createProject, que grava a identidade antes da checagem de projeto existente — o caso real do Ubuntu era adoção). Portão: 278 arquivos, 2849 testes; o mesmo sem identidade global do git (GIT_CONFIG_GLOBAL vazio, GIT_CONFIG_NOSYSTEM=1). Falta o aceite do mantenedor no Ubuntu, conforme a descrição.
---
<!-- COMMENTS:END -->
