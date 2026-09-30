---
id: TASK-62
title: V2-T72 — Adoção que commita sozinha e projeto que some
status: Review
assignee: []
created_date: '2026-09-30 13:13'
updated_date: '2026-09-30 14:41'
labels: []
milestone: m-0
dependencies: []
priority: high
type: bug
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T72 — Adoção que commita sozinha e projeto que some.** Achado do mantenedor em 2026-09-30, no
uso real no Ubuntu: numa adoção, a própria sessão commitou o que escreveu (e editou o
`seeya.json`, preenchendo `repositories` e `trackers` num formato inválido). Dois defeitos:

1. **A adoção descarta a cópia quando a sessão já commitou.** `application/project-adopt.ts`
   decide pelo que está sem commit (`listChangedFiles`); com tudo commitado, cai em `noChanges` e
   chama `discardFork` — apaga o transcript da cópia e não grava `adoptions.json`, embora o trabalho
   dela esteja no histórico. **Correção:** a adoção considera também os commits feitos no projeto
   desde que a cópia foi lançada (os com `Seeya-Session-Id` igual ao id da cópia, e qualquer commit
   novo no projeto nesse intervalo — o que for mais fiel ao que o código sabe; justificar na nota).
   Havendo commit, é adoção: registra em `adoptions.json`, tira de `forks.json` e mostra ao
   mantenedor o que já estava commitado (e ainda pergunta pelo que restar sem commit). **Nunca**
   apagar a cópia quando ela deixou commit. Teste de regressão que reproduz o caso: sessão que
   commita e fecha sem nada pendente — hoje apaga, depois registra.
2. **A janela esconde o projeto cujo `seeya.json` não valida.** A CLI mostra em "Ignored entries"
   com o motivo; a janela não mostra nada, e o projeto "some". **Correção:** a janela mostra os
   projetos ignorados, com o id e o motivo, de forma que se entenda o que consertar
   (`docs/INTERFACE.md` ganha a linha na seção 4 e na lateral antes do código).
3. **A sessão não deve escrever o `seeya.json`.** A instrução da adoção
   (`adapters/harness/adopt-instruction.ts`) e as regras de trabalho do `open`
   (`core/project-working-rules.ts`) passam a dizer que o `seeya.json` é mantido pelo seeya, e que
   repositórios entram por `seeya project add-repo`. Texto num lugar só.

**Cuidados:** nada no `~/.seeya` real nem no espaço de trabalho real; recusa não se contorna.

**Aceite do mantenedor:** no Ubuntu, uma adoção em que a sessão commita sozinha termina registrada
(a original deixa de ser adotável, a cópia continua existindo); um `seeya.json` quebrado aparece na
janela com o motivo.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Entrega.** Os três itens, na branch `tarefa/V2-T72-adocao-que-commita` a partir de `main`
317247b (5 commits: `f5de3be`/`d754330`/`af12d17`/`bbe77b1`/`c93798a`, HEAD `c93798a`).
`npm run verificar` verde (exit 0): `format:check`, os três `tsc -p ... --noEmit`, `lint`,
`build`, `dependencias` (548 módulos, 1539 dependências, sem violação) e `cobertura` (294
arquivos de teste, 2934 testes passando + 4 pulados, cobertura total 96,26%
linhas/92,05% branch — `engine/src/application` 99,89%/96,72%, `engine/src/core` 99,47%/98,35%,
ambos acima dos pisos de D-048/AGENTS.md). `npm test` isolado (unidade+integração+guards) também
passou (exit 0). A variante pedida com `GIT_CONFIG_GLOBAL=<arquivo vazio> GIT_CONFIG_NOSYSTEM=1
npm test` foi **recusada pela proteção da worktree** (mensagem: "this agent is isolated in the
worktree ..., but this command sets GIT_CONFIG_GLOBAL ... Refusing to run it") — não contornei;
só `npm test` sem essas variáveis rodou, com sucesso.

**Item 1 — a adoção não descarta mais a cópia que já commitou.**
`application/project-adopt-outcome.ts#finishAdoption` agora lê, além de
`WorkspaceRepository.listChangedFiles` (o que ainda está sem commit), também
`WorkspaceRepository.findSessionCommits(root, projectId, forkSessionId)` — os commits DO
PRÓPRIO PROJETO cujo trailer `Seeya-Session-Id` bate com o id da cópia (`forkSessionId`), nunca
"qualquer commit novo desde o lançamento". Escolhi essa forma (a mais restrita das duas que a
tarefa oferecia) porque é exatamente o que o resto do código já garante: a adoção toma o lock do
projeto com `sessionId: forkSessionId` (`adoptSession`), e o gancho de commit do espaço de
trabalho (`core/workspace-commit-guard.ts#decideSessionConflict`) só deixa passar um commit,
enquanto esse lock está ativo, vindo da própria sessão dona do lock (via `CLAUDE_CODE_SESSION_ID`,
que o `claude --session-id <forkSessionId>` da cópia seta) ou do processo que segura o lock (a CLI
do `seeya`, não a cópia). Ou seja: dentro da janela de tempo da adoção, todo commit que passou pelo
gancho já carrega `Seeya-Session-Id: <forkSessionId>` — não existe "commit novo sem essa marca" que
devesse contar como da cópia e que este filtro perderia.

**Onde o guarda-corpo termina** (documentado no próprio tipo, campo `alreadyCommittedFiles` de
`AdoptSessionResult`): um commit feito com `git commit --no-verify` (furando o gancho) não carrega
o trailer e não entra nesta lista — mesmo limite que D-047 já registra para o gancho como um todo.

Com `alreadyCommittedFiles` não vazio: `changedFiles.length === 0` (nada pendente) registra a
adoção direto, sem perguntar nada (`registerAdoption`, sem chamar `commitAll` — não há diff para
commitar). `changedFiles.length > 0` (parte commitada, parte pendente) pergunta só pelo que
sobrou (`confirmCommit(callbacks, changedFiles)` — nunca a lista já commitada), e registra a
adoção de qualquer jeito, aceite ou não a resposta (`commit`/`decline`/`unavailable`, e até se a
própria tentativa de commitar o restante falhar — nesse caso o motivo vai em
`pendingCommitFailedReason`, mas a cópia continua promovida). Sem commit nenhum
(`alreadyCommittedFiles` vazio) o comportamento de antes continua intacto: `noChanges` + descarte
quando nada mudou, e as três respostas de sempre (`declined`/`confirmationUnavailable`/`adopted`)
quando há diff pendente sem commit prévio.

O caso `adopted` de `AdoptSessionResult` ganhou três campos (D-024, união nunca achatada em
booleano): `alreadyCommittedFiles` (o que a cópia já tinha commitado), `pendingFiles` (o que ficou
sem commit depois desta chamada) e `pendingCommitFailedReason?` (só quando `pendingFiles` não é
vazio por causa de uma falha de `commitAll`, não por recusa/indisponibilidade). CLI
(`formatAdoptSessionReport`) e janela (`formatAdoptSessionOutcomeText`) mostram as três listas
separadamente, cada uma só quando tem algo a dizer — o caso comum (nada já commitado, nada
pendente) lê exatamente como antes da tarefa.

**Teste de regressão confirmado falhando antes da correção.** Reverti
`application/project-adopt.ts` para a versão de `main` (`git show main:...`), rodei só os quatro
testes novos deste item (filtro `-t "V2-T72"`) — os quatro falharam contra o código antigo (o caso
"committed everything and closed with nothing pending" batia exatamente no bug: resultado
`noChanges` em vez de `adopted`, e a asserção sobre `forkCleanup.deletedSessionIds` teria pego a
cópia sendo apagada). Restaurei o arquivo corrigido e os 23 testes do arquivo voltaram a passar.
Cobre explicitamente cinco casos: (a) commitou tudo e fechou sem pendência — registra, nunca
descarta; (b) commitou parte, deixou parte pendente — pergunta só pelo pendente, registra
independente da resposta; (c) commitou parte, pessoa aceita commitar o resto — duas listas
separadas no resultado; (d) commitou parte, aceita commitar o resto, mas o commit falha — ainda
registra, com o motivo da falha; (e) sessão não fez nada — `noChanges`, descarta (comportamento
inalterado).

`application/project-adopt.ts` tinha ido de 444 para ~570 linhas com a correção — dividido em três
arquivos (`project-adopt.ts`, 199 linhas, orquestração; `project-adopt-outcome.ts`, 256 linhas, o
que decidir depois que a cópia fecha; `project-adopt-types.ts`, 187 linhas, os tipos compartilhados
entre os dois, evitando ciclo de import) para ficar abaixo do teto de ~500 linhas de AGENTS.md. A
superfície pública (`@seeya-ai/engine/application/project-adopt.js`) não mudou —
`project-adopt.ts` reexporta os tipos.

**Item 2 — a janela mostra projetos ignorados.** `docs/INTERFACE.md` ganhou a linha antes do
código: seção 1 (lateral, item 5 "All projects") e seção 4 (aba Projects, item novo "Ignored
projects"). No código atual (a lateral ainda não foi redesenhada — isso é V2-T63/V2-T67):
`state/projects-panel.ts`, campo novo `ProjectsPanelData.ignoredProjects`
(`{projectId, reason}[]`), alimentado pelo `rejected` que `WorkspaceRepository.listProjects` já
devolvia (`electron/project-ipc.ts` já buscava e descartava esse campo — só passou a repassar). O
id vem do próprio caminho do `seeya.json` rejeitado (`<root>/<projectId>/seeya.json`), sem porta
nova: `deriveIgnoredProjectId` separa por `/`/`\` e pega o penúltimo segmento, função pura, testada
nos dois formatos (POSIX e Windows). `electron/app-shell.tsx` ganhou um
`<h2 id="ignored-projects-heading" hidden>` + `<ul id="ignored-projects-list" hidden>` (mesmos
componentes/estilo da lateral atual — `<h2>` + `<ul>`, o mesmo padrão que "Other sessions" já usa)
— escondido por inteiro quando não há nada ignorado (ao contrário de "Other sessions", que sempre
mostra algo). Texto em `text/messages.ts` (`ignoredProjectsHeading`/`ignoredProjectRowLabel`),
mesma informação que "Ignored entries" da CLI já mostra, nunca uma segunda redação.

**Item 3 — o `seeya.json` é do seeya, nunca da sessão.** Uma frase só
(`core/project-manifest-ownership.ts`, constante `MANIFEST_OWNERSHIP_NOTE`), usada literalmente
pelos dois lugares: `adapters/harness/adopt-instruction.ts#buildAdoptionInstruction` (antes da
frase de fechamento "Write only inside...", para não quebrar o teste que verifica o final exato do
texto) e `core/project-working-rules.ts#buildProjectWorkingRulesText` (como item novo da lista de
regras). Teste dedicado (`tests/unit/core/project-manifest-ownership.test.ts`) prova a mesma string
aparecendo, ao pé da letra, nos dois textos. Os dois continuam abaixo dos tetos já testados
(`buildAdoptionInstruction` < 3000 caracteres, `buildProjectWorkingRulesText` < 4000).

**Prova com `claude` real:** não fiz — não era obrigatória nesta tarefa e o tempo foi todo para os
três itens mais a divisão do arquivo. Nenhuma pasta de transcript nova foi criada.

**Questão aberta:** Q-100 em `docs/QUESTOES.md` — `packages/cli/src/format-project.ts` já estava
acima do teto de ~500 linhas antes desta tarefa (537), e ficou em 565 com o item 1 (três listas
novas no caso `adopted`). Registrei em vez de recortar sozinho: ao contrário de
`project-adopt.ts` (cujo crescimento veio inteiro desta tarefa, por isso dividi), o crescimento de
`format-project.ts` vem se acumulando desde a V2-T29 — como recortá-lo por comando é uma decisão
de escopo maior que esta correção.
<!-- SECTION:NOTES:END -->
