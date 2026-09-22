---
id: TASK-20
title: >-
  V2-T33 — Fundação da D-047, parte 1: o lock do projeto, e commits de um
  projeto só e com dono
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-22 11:47'
labels:
  - fundacao
  - d-047
milestone: m-0
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
priority: high
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T33 — Fundação da D-047, parte 1: o lock do projeto, e commits de um projeto só e com
dono.** Especificada pelo PO em 2026-09-22. Primeira da fila de projetos depois da D-047 — a
adoção (V2-T29) e o desfazer (V2-T32) dependem dela.

**Vocabulário, fixado antes do código** (glossário do `AGENTS.md` na primeira leva): lock do
projeto → um arquivo **dentro do diretório do projeto** (nome fixado no glossário), com o
identificador da sessão, o `pid`, o `procStart` e o instante em que foi tomado; identificador
da sessão no commit → um trailer na mensagem (nome fixado no glossário), mais outro com o
`projectId`.

**O que entra:**
1. **Tomar, conferir e liberar o lock**, por porta. Tomar um lock livre funciona; tomar um lock
   de sessão **viva** recusa, dizendo quem o segura e desde quando; lock de processo **morto** é
   velho e pode ser tomado, com aviso. A vivacidade é a **mesma** checagem do `daemon.lock`
   (pid + `procStart`, `scheduler/daemon-state.ts#checkLiveLock` e companhia) — reusar, não
   reescrever. Liberar lock que não é seu recusa.
2. **O lock nunca é commitado**: entra no `.gitignore` do espaço de trabalho, criado ou
   atualizado pelo próprio seeya.
3. **O commit do seeya passa a tocar um projeto só.** Hoje `WorkspaceRepository.commitAll` faz
   `git add -A` no espaço de trabalho inteiro — se dois projetos tiverem mudança pendente,
   viram um commit, e reverter um desfaz o outro. Passa a adicionar só o diretório do projeto
   da operação, e todo commit do seeya leva os dois trailers. Teste de regressão: com mudança
   pendente em dois projetos, o commit de um não leva o outro.
4. **`seeya project open` toma o lock** ao abrir e **libera ao sair** (o `open` já espera o
   harness terminar, V2-T28). Com o lock de outra sessão viva, o `open` avisa quem o segura e
   abre **para leitura** — a sessão pode trabalhar no código dela, mas é avisada de que não
   escreve no projeto. Registrar o limite: "para leitura" é instrução nesta tarefa; a guarda
   que impede escrever é da V2-T34.
5. **`seeya project show`** passa a dizer se o projeto está com lock, de quem e desde quando.

**O que não entra:** os ganchos de git e do harness, e a auditoria (V2-T34); qualquer
mudança na adoção.

**Cuidados:** o lock é arquivo dentro do espaço de trabalho, escrito de forma atômica como tudo
o mais; `process.platform` só nas raízes de composição; nenhuma dependência nova; testes com
espaço de trabalho descartável e processos de verdade onde a vivacidade precisar ser provada
(o mesmo cuidado dos testes do `daemon.lock`).

**Aceite do mantenedor:** abrir um projeto numa sessão, tentar abrir o mesmo projeto em outra
e ver o aviso de lock com o nome da primeira; fechar a primeira e ver a segunda conseguir.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Relatório do agente (branch `tarefa/V2-T33-lock-do-projeto`, worktree isolada, a partir da
`main` em `ee16b8c`).** Os cinco itens, nesta ordem:

1. **Lock por porta.** `ProjectLock` (`core/ports.ts`) — `read`/`write`/`clear` de
   `.seeya-lock`, um arquivo DENTRO de `<root>/<projectId>/`, implementado por
   `adapters/workspace/project-lock.ts#FsProjectLock` (mesma disciplina de
   `resolveSchemaVersion`/`writeFileAtomic` que `FsWorkspaceRepository` já usa). A decisão
   pura — tomar, recusar, e a NOVA "liberar lock que não é seu recusa" — é
   `core/project-lock.ts#decideProjectLockAcquisition`/`decideProjectLockRelease`, reusando a
   vivacidade do `daemon.lock` (`ProcessControl.isAlive(pid, procStart)`, nunca uma checagem
   nova); a orquestração é `application/project-lock.ts#checkProjectLock`/`acquireProjectLock`/
   `releaseProjectLock`/`describeProjectLockStatus`.
2. **Nunca commitado.** `FsWorkspaceRepository#commitAll` reafirma (cria ou atualiza) uma
   linha `.seeya-lock` no `.gitignore` do espaço de trabalho antes de todo `git add` — não só
   na primeira inicialização, para que um espaço de trabalho já existente (criado antes desta
   tarefa) também fique protegido.
3. **Commit de um projeto só, com os dois trailers.** `commitAll` ganhou `projectId` e passou
   a rodar `git add <projectId> .gitignore` em vez de `git add -A`; a mensagem já chega pronta
   de `core/project-commit.ts#buildProjectCommitMessage` (trailers `Seeya-Project-Id`/
   `Seeya-Session-Id`, este último `unknown` quando não há `CLAUDE_CODE_SESSION_ID` — D-025).
   Teste de regressão em `tests/integration/workspace/fs-workspace-repository.test.ts`
   ("commitAll only ever stages the one project it was called for"): com mudança pendente em
   `auth-hardening` e `billing-v2`, comitar `auth-hardening` só leva `auth-hardening/INDEX.md`
   — `billing-v2/INDEX.md` continua modificado e não commitado (`git status --porcelain`
   mostra ` M billing-v2/INDEX.md`, o espaço inicial confirmando "não staged"). Revertido o
   fix (`git add -A` de volta), o mesmo teste falha exatamente como o defeito descrevia — a
   prova de que ele provava algo antes de a correção existir.
4. **`project open` toma/libera o lock.** `application/project-open.ts#openProject` tenta
   `acquireProjectLock` antes de abrir o harness; lock de sessão viva → `ProjectOpenLockOutcome`
   `readOnly` (abre mesmo assim, com aviso — "para leitura" é só instrução nesta tarefa, a
   guarda é da V2-T34); lock livre ou de processo morto → `acquired` (com `reclaimedStale`
   quando havia um lock morto a reclamar, o "aviso" que a spec pede). O lock é sempre liberado
   ao sair, best-effort, só quando esta sessão de fato o tomou. `pid`/`procStart` são os do
   PRÓPRIO processo `seeya project open` (ele bloqueia `stdio: 'inherit'` pelo tempo inteiro
   do harness — ver Q-087 item 3 para o raciocínio).
5. **`project show` mostra o lock.** `ShowProjectResult.lockStatus`, três estados nunca
   achatados (D-024): `unlocked` / `staleLock` (arquivo existe, pid morto — reclamável) /
   `heldByLiveSession` (de quem, e desde quando).

**Vivacidade com processo de verdade.**
`tests/integration/application/project-lock.test.ts` reusa a técnica de
`tests/integration/scheduler/lock.test.ts`: um filho real spawnado fica no lugar do "processo
que o lock aponta", provando o mesmo desempate de pid reciclado (`procStart` divergente →
lock morto mesmo com o pid genuinamente vivo) sem reescrever nada da checagem — adicionado a
`PROCESS_HEAVY_INTEGRATION_FILES` em `vitest.config.ts`, roda no projeto
`integration-process`.

**Questão registrada:** Q-087 — de onde vem "o identificador da sessão" (a spec nunca nomeia
uma fonte concreta): adotado `process.env.CLAUDE_CODE_SESSION_ID`, lido só na raiz de
composição, `undefined`/`unknown` quando ausente (D-025), nunca uma sessão inventada.

**Portão:** `npm run verificar` passou inteiro nesta worktree — formatação, `tsc`, lint,
`dependencias` (410 módulos, 0 violação) e `cobertura` (2322 testes, 4 pulados; `core/`
99.5%, `application/` 100%, `adapters/workspace/` 94.07%, `cli/src` 96.65% — todos acima do
próprio piso). Fica em `[~]` até o aceite do mantenedor.


**Revisão do PO (2026-09-22) — mesclada na `main`.** Portão do PO no formato sem cobertura
(`docs/TESTES.md`); a cobertura é a do portão completo do agente. Revisão sem ajustes no código.

**Uma resposta à Q-087, que vira insumo da V2-T34:** o identificador da sessão vir de
`CLAUDE_CODE_SESSION_ID` funciona para os comandos que um agente roda de dentro de uma sessão, mas
**no `open` a sessão do Claude ainda não existe** quando o lock é tomado — o identificador dela só
nasce depois. Resultado: aberto de um terminal comum, o lock fica sem `sessionId`, e a V2-T34 não
teria com o que comparar o commit do agente que está dentro. O Claude Code aceita receber o
identificador da sessão já na partida (`--session-id <uuid>`, medido na S2-T2 para os forks da
captura): o `open` pode **gerar o identificador, passá-lo ao `claude` e gravá-lo no lock** — aí o
dono do lock é conhecido de forma determinística. Registrado na V2-T34 como pré-requisito.
<!-- SECTION:NOTES:END -->
