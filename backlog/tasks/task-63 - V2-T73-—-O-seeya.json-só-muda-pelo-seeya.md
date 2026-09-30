---
id: TASK-63
title: V2-T73 — O seeya.json só muda pelo seeya
status: Review
assignee: []
created_date: '2026-09-30 13:34'
updated_date: '2026-09-30 16:08'
labels: []
milestone: m-0
dependencies:
  - TASK-62
priority: high
type: feature
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T73 — O seeya.json só muda pelo seeya.** Decisão do mantenedor em 2026-09-30, depois do achado
da V2-T72 (uma sessão adotada editou o `seeya.json` num formato inválido e o projeto sumiu da
janela): instrução não basta, a regra vira mecanismo (princípio já seguido pela D-047).

**O que entra:**

1. **O gancho de git recusa commit que altere um `seeya.json` e não venha do seeya.** O seeya
   marca os próprios commits que gravam o manifesto (`WorkspaceRepository.writeProjectManifest` +
   `commitAll`, em `create`, `add-repo`, `remove-repo`, adoção…) com uma variável de ambiente no
   processo `git` que ele lança — mesmo padrão de `SEEYA_LOCK_HOLDER_PID`
   (`adapters/workspace/lock-holder-env.ts`); nome no glossário do `AGENTS.md` antes do código. A
   decisão pura mora em `core/workspace-commit-guard.ts`. Mensagem de recusa: que o `seeya.json` é
   mantido pelo seeya e que repositório entra por `seeya project add-repo`.
2. **Restauração do que ficou sem commit.** No início de cada `seeya project open` (CLI e janela) e
   no fim de cada adoção, se o `seeya.json` do disco difere da última versão commitada, o seeya
   restaura a versão commitada e diz, na saída, que restaurou e o que descartou (o diff resumido,
   nunca silêncio). Como o item 1 garante que só o seeya commita esse arquivo, a versão commitada é
   sempre a dele.
3. **Onde o guarda-corpo termina**, registrado no código e no glossário: `--no-verify` pula o
   gancho. Na sessão aberta por `open`, o gancho do harness já bloqueia `--no-verify`; na adoção
   não (a cópia roda fora do diretório do projeto) — ali a auditoria acusa o commit depois, e o
   item 2 conserta o arquivo no próximo `open`. Cobre o descuido, não o contorno deliberado.

**Testes:** gancho de verdade (como `tests/integration/workspace/commit-msg-hook.test.ts`), com o
caso proibido (sessão commitando `seeya.json`) e os permitidos (cada fluxo do seeya que grava o
manifesto); restauração com arquivo alterado, com arquivo inválido e com arquivo igual (nada a
fazer). Também sem identidade global do git.

**Depende da V2-T72** (as duas mexem no fluxo da adoção).

**Aceite do mantenedor:** pedir a uma sessão aberta num projeto que edite o `seeya.json` e commite
→ recusado com a explicação; editar à mão sem commitar e reabrir o projeto → restaurado, com aviso.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Entrega.** Os itens 1-3, na branch `tarefa/V2-T73-seeya-json-protegido` a partir de `main`
2c0cbf7 (2 commits: `9e9cdca`/`49f15e0`, HEAD `49f15e0`). `npm ci` rodado na worktree antes de
qualquer verificação. `npm run verificar` verde (exit 0): `format:check`, os três `tsc -p ...
--noEmit`, `lint`, `build`, `dependencias` (554 módulos, 1559 dependências, sem violação) e
`cobertura` (298 arquivos de teste, 2969 testes passando + 4 pulados, cobertura total
96,25%/91,92% linhas/branch — `engine/src/application` 99,89%/96,72%, `engine/src/core`
99,47%/98,37%, ambos acima dos pisos de D-048/AGENTS.md; `adapters/workspace` ficou em
80,26% de branch, acima do piso de 80%, depois de testes dedicados para os caminhos de erro
reais que este item acrescentou — ver Q-101). `npm test` isolado também passou (exit 0,
mesmos 2969 testes). A variante `GIT_CONFIG_GLOBAL=<arquivo vazio> GIT_CONFIG_NOSYSTEM=1 npm
test` foi **recusada pela proteção da worktree** ("this agent is isolated in the worktree...
Refusing to run it") — não contornei; reportando como pedido.

**Item 1 — o `seeya.json` só muda por commit marcado.** Variável de ambiente nova,
`SEEYA_MANIFEST_WRITE_AUTHORIZED` (registrada no glossário do `AGENTS.md` antes do código,
mesmo padrão de `SEEYA_LOCK_HOLDER_PID`): `adapters/workspace/manifest-write-env.ts`
(`buildManifestWriteEnv`/`readManifestWriteAuthorized`). `core/workspace-commit-guard.ts
#decideCommitGuard` ganhou um novo check, logo depois da checagem do `.seeya-lock`: qualquer
commit que estagie `<projeto>/seeya.json` é recusado a menos que `manifestWriteAuthorized`
esteja marcado — **independente** de quem segura o lock do projeto (mesmo a sessão que
legitimamente o segura é recusada; só a marca importa). A mensagem de recusa reusa
`core/project-manifest-ownership.ts#MANIFEST_OWNERSHIP_NOTE` (o mesmo texto que a V2-T72
item 3 já entrega à sessão), agora com uma segunda constante ali,
`PROJECT_MANIFEST_FILE_NAME = 'seeya.json'`, para o guard e `adapters/workspace/index.ts`
nunca soletrarem o literal duas vezes.

`WorkspaceRepository.commitAll` ganhou um quinto parâmetro opcional,
`manifestWriteAuthorized?: boolean`, dobrado no `git commit` via `buildManifestWriteEnv`. Os
QUATRO fluxos que de fato escrevem o manifesto passam `true`: `application/workspace.ts
#createProject` (o skeleton inclui `seeya.json`), `application/repository-association.ts
#addRepository` (`writeProjectManifest`), `application/project-remove-repo.ts#removeRepository`
(idem) e `application/project-remove.ts#removeProject` (a remoção do diretório apaga o
`seeya.json` junto — também precisa da marca). A sobra do `open`
(`application/project-open.ts#handleLeftoverChanges`) e o commit da adoção
(`application/project-adopt-outcome.ts#commitAdoption`) NUNCA passam a marca — são
exatamente os dois pontos onde uma sessão poderia ter sujado o manifesto, e devem ser
recusados igual a qualquer sessão.

**Testes do item 1:** `tests/unit/core/workspace-commit-guard.test.ts` ganhou três casos novos
(permitido com a marca; proibido sem marca; proibido mesmo segurando o lock legitimamente) —
puro, sem I/O. `tests/integration/workspace/commit-msg-hook.test.ts` ganhou um describe novo
("the workspace's own manifest-ownership guard") com gancho real: permitido (add-repo,
`git commit` de verdade passando), proibido sem lock, proibido segurando o lock (processo
filho real vivo, mesma técnica já usada no arquivo). Os três testes pré-existentes
"removeProject-shaped"/"removeRepository-shaped"/"createProject-shaped" (que já escreviam
`seeya.json` de verdade) precisaram do quinto argumento `true` — sem isso, o portão os teria
pego como regressão real (confirmei rodando antes da correção: os três falhavam com "this
commit changes ... maintained by seeya itself").

**Item 2 — restauração do que ficou sem commit.** Porta nova,
`WorkspaceRepository.restoreProjectManifestIfChanged(root, projectId)`, devolvendo
`ManifestRestoreOutcome` (`core/ports.ts`, união `unchanged`/`restored { diffSummary }`/
`noCommittedVersion`, D-024/D-025). Mecânica em `adapters/workspace/manifest-restore.ts`
(extraído de `adapters/workspace/index.ts` — esse arquivo já estava acima do teto de 500
linhas antes desta tarefa, então segui o mesmo recorte que `revert.ts`/`audit.ts` já dão a
ele: `FsWorkspaceRepository`'s own método é um delegate de uma linha). A restauração é
`git diff --quiet HEAD -- <path>` (unchanged se exit 0) seguido de `git diff --stat` (o
resumo) + `git checkout HEAD -- <path>` (que corrige staged+worktree juntos — cobre alterado,
inválido — git diffa texto, nunca valida JSON —, apagado e só staged). `noCommittedVersion`
quando `HEAD` não resolve (nunca confundido com "unchanged").

Chamada no INÍCIO de `application/project-open.ts#openProject`, logo depois de resolver
`root` e ANTES de `readProjectManifest` — importante: um `seeya.json` inválido no disco faria
`readProjectManifest` lançar antes de qualquer correção rodar, então a ordem é deliberada.
Reportada via `OpenProjectCallbacks.onBeforeLaunch`'s own `manifestRestore` (mesmo padrão de
`audit`/`claudeMd`). Chamada no FIM de `application/project-adopt-outcome.ts#finishAdoption`,
antes de `listChangedFiles`/`findSessionCommits` — assim um manifesto sujo pela cópia nunca
aparece como algo a perguntar à pessoa. Adicionado como campo `manifestRestore` nos cinco
casos de `AdoptSessionResult` que passam por `finishAdoption` (`noChanges`/`declined`/
`confirmationUnavailable`/`adopted`/`commitFailed`).

**Aviso sem silêncio nas duas pontas:** CLI via `cli/format-manifest-restore.ts` (módulo novo,
deliberadamente fora de `format-project.ts` — ver Q-100/Q-101 abaixo) — linhas no aviso
pré-lançamento do `open` e sufixo no relatório do `adopt`. Janela via
`packages/app/src/state/manifest-restore-suffix.ts` (mesmo texto, uma sentença) —
`electron/project-ipc.ts`'s own `openProject` handler captura `manifestRestore` pelo
`onBeforeLaunch` (a janela não usava esse callback antes) e anexa ao `outcomeText` final;
`state/adopt-session-result.ts#formatAdoptSessionOutcomeText` já lê o campo direto do
resultado.

**Testes do item 2:** `tests/integration/workspace/manifest-restore.test.ts` (novo, git real)
— unchanged, alterado, inválido, apagado, staged-mas-não-commitado, `noCommittedVersion`,
projectId inexistente (no-op), e dois testes de falha real (repo inexistente; `.git/index`
corrompido — `git diff`/`checkout` reportam exit 128 de verdade, medido). Adicionado à lista
`REAL_CHILD_PROCESS_GIT_AND_STORAGE_FILES` do `vitest.config.ts` (mesmo padrão de
`fs-workspace-repository.test.ts`, "added here preemptively"). Testes unitários com fakes em
`tests/unit/application/project-open.test.ts` (onBeforeLaunch recebe `manifestRestore`,
`unchanged` e `restored`) e `tests/unit/application/project-adopt.test.ts` (idem, mais a
prova de que `restoreProjectManifestCalls` mira o projeto certo). Formatação testada em
`tests/unit/cli/format-manifest-restore.test.ts` e
`tests/unit/app/state/manifest-restore-suffix.test.ts` (novos).

**Item 3 — onde o guarda-corpo termina.** Documentado no docstring de
`core/workspace-commit-guard.ts` (seção "V2-T73 item 3") e no glossário do `AGENTS.md`:
`--no-verify` ainda pula o gancho por inteiro; a sessão do `open` roda DENTRO do diretório do
projeto, onde o gancho do harness já bloqueia `--no-verify`, mas a cópia da adoção roda no
`cwd` ORIGINAL da sessão — o gancho do harness nunca é instalado ali (limite já documentado
por `core/harness-hook-config.ts` desde a V2-T34), então um `--no-verify` deliberado ali pode
comitar o manifesto quebrado, virando a NOVA linha de base commitada (o item 2 só restaura
contra o que já está commitado — não desfaz aquele commit). O que aparece depois é a
auditoria (`seeya project audit`), pela falta/erro de trailer que um `--no-verify` também
pula — mesmo limite "cobre o descuido, não o contorno deliberado" que D-047 já registra.

**Questão aberta:** Q-101 em `docs/QUESTOES.md` — `packages/engine/src/adapters/workspace/index.ts`
já estava acima do teto de ~500 linhas (543) antes desta tarefa; ficou em 562
mesmo depois de eu extrair a mecânica de `restoreProjectManifestIfChanged` para
`manifest-restore.ts` (mesmo recorte de `revert.ts`/`audit.ts`) — o parâmetro novo de
`commitAll` e a troca do literal `'seeya.json'` pela constante ainda somam algumas linhas.
Mesmo precedente da Q-100 (`format-project.ts`), registrado em vez de recortar o arquivo
inteiro sozinho — não era consequência mínima desta tarefa.

**Prova com `claude` real:** não fiz — os itens 1/2 são cobertos por gancho de git real e
processo filho real (não precisam de harness); o aceite do mantenedor
("pedir a uma sessão aberta num projeto que edite o seeya.json e commite" /
"editar à mão sem commitar e reabrir o projeto") ainda precisa ser confirmado por ele.
<!-- SECTION:NOTES:END -->
