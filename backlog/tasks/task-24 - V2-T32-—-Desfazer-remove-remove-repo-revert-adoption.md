---
id: TASK-24
title: 'V2-T32 — Desfazer: remove, remove-repo, revert-adoption'
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-25 00:31'
labels:
  - desfazer
  - d-047
milestone: m-0
dependencies:
  - TASK-20
  - TASK-23
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T32 — Desfazer: `seeya project remove` e `seeya project remove-repo`.** Especificada
pelo PO em 2026-09-22, a partir de uma pergunta do mantenedor no mesmo dia (*"criamos
remove/delete project?"*). Não criamos: hoje o projeto só tem `create`, `list`, `show`,
`add-repo` e `open`, e nada que desfaça.

**O que entra:**
1. **`seeya project remove <id>`** apaga o diretório do projeto do espaço de trabalho e
   **commita a remoção**. Como o espaço de trabalho é um repositório git, remover não é
   destruir: o conteúdo continua no histórico, e a saída do comando diz em uma linha como
   recuperar (o commit anterior). Pede confirmação antes, com o nome do projeto e quantos
   arquivos ele tem.
2. **`seeya project remove-repo <id> <nome>`** tira o repositório do `seeya.json` e commita.
   A entrada no mapa do dispositivo (`repository-map.json`) só sai se nenhum outro projeto
   usar a mesma identidade.
3. **`seeya project revert-adoption <id>`** (acrescentado pela D-047 item 4): lista os commits
   da sessão adotada naquele projeto — é o identificador de sessão que cada commit carrega
   desde a V2-T33 que torna isso possível —, mostra, pede confirmação e reverte do mais novo
   para o mais antigo. **Recusa e diz qual** se algum commit posterior de outra sessão mexeu
   nos mesmos arquivos: nunca reverte pela metade. Depois de reverter, apaga a cópia de
   adoção e desmarca a sessão original, que volta a poder ser adotada. **Depende da V2-T33 e
   da V2-T29.**
**Revisão do PO em 2026-09-24**, depois que a V2-T29 construiu a adoção (`adoptions.json`, a cópia
promovida que sai do `forks.json`, o lock com o id da cópia):

5. **`revert-adoption <id> [<sessão>]`** — um projeto pode ter mais de uma sessão adotada (a D-047
   só proíbe uma sessão em dois projetos), então a sessão é obrigatória quando houver mais de uma
   adoção no projeto; com uma só, pode ser omitida. A sessão é identificada pelo nome ou prefixo,
   como no `adopt`, e casa com `adoptions.json` pela original **ou** pela cópia.
6. **A cópia adotada pode ter continuado em uso** — pela D-047 ela vira a sessão do projeto. Antes
   de apagá-la no revert, o seeya compara o transcript da cópia com o momento da adoção
   (`adoptedAt`): se ela cresceu depois, **avisa, diz quanto, e só apaga com confirmação explícita**
   (a resposta padrão é manter). A autorização para apagar vem do registro em `adoptions.json` — a
   cópia promovida já saiu do `forks.json` —, e continua valendo a regra de só apagar o que o seeya
   criou e registrou (D-012).
7. **`remove` com adoções**: remover um projeto tira de `adoptions.json` as adoções daquele projeto
   (as originais voltam a poder ser adotadas) e **não** apaga as cópias — pelo item 4, remover nunca
   apaga sessão; elas passam a ser sessões comuns na descoberta. A saída diz quais eram.
8. **Lock (D-047):** `remove`, `remove-repo` e `revert-adoption` recusam, com o texto de aviso da
   V2-T35, quando outra sessão viva segura o lock do projeto; com o lock livre, tomam e soltam no fim,
   como o `open`.

4. **Nada toca fora do espaço de trabalho e do `~/.seeya/`.** Remover um projeto nunca apaga
   repositório associado, sessão ou transcript — o seeya só é dono do que ele criou.

**O que não entra:** "mover" uma sessão adotada para outro projeto como operação própria —
pela D-047, uma sessão não é adotada por dois projetos; mudar de projeto é reverter a adoção
(item 3) e adotar de novo.

**Cuidados:** nenhuma dependência nova; confirmação obrigatória no `remove`; testes com
espaço de trabalho descartável.

**Aceite do mantenedor:** remover o projeto de teste criado no aceite da V2-T28, ver que o
repositório associado continua intacto, e recuperar o projeto pelo histórico seguindo a linha
que o comando imprime. E, com uma adoção de teste aceita, rodar `revert-adoption`: os commits da
adoção somem do projeto, a sessão original volta a poder ser adotada, e a cópia só é apagada
depois da pergunta.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Relatório do agente (branch `tarefa/V2-T32-desfazer`, worktree isolada, a partir da `main`/po-gate).**

**Três comandos entregues, cada um com lock (D-047 item 8) e sem dependência nova.**

1. **`seeya project remove <id>`** — `application/project-remove.ts#removeProject`. Toma o lock
   do projeto (recusa se outra sessão viva o segura; toma e solta no fim, como o `open`), pede
   confirmação com o nome e o número de arquivos rastreados (`WorkspaceRepository.countProjectFiles`,
   `git ls-files` escopado), e, aceita, `WorkspaceRepository.removeProjectDirectory` (apaga o
   diretório) + `commitAll` (nunca `-A`; `git add <projectId>` já registra a remoção, confirmado por
   teste real). A saída sempre repete o `HEAD` de ANTES da remoção
   (`WorkspaceRepository.currentCommit`) como linha de recuperação (`git checkout <commit> --
   <projectId>`). Nunca apaga repositório associado, sessão ou transcript — nenhum vive dentro de
   `root/projectId`. Item 7: tira de `adoptions.json` toda adoção do projeto removido (as originais
   voltam a poder ser adotadas) e reporta quais eram; as cópias promovidas continuam intocadas.

2. **`seeya project remove-repo <id> <nome>`** — `application/project-remove-repo.ts#removeRepository`.
   Mesmo lock; sem confirmação (precedente do próprio `add-repo`: reversível pelo histórico do
   espaço de trabalho). Tira o `AssociatedRepository` de `seeya.json` e commita; a entrada em
   `repository-map.json` só sai se nenhum OUTRO projeto ainda usa a mesma `RepositoryIdentity`
   (repositório sem remoto é sempre exclusivo do projeto que o registrou, sai sempre).

3. **`seeya project revert-adoption <id> [<sessão>]`** — `application/project-revert-adoption.ts#revertAdoption`.

   - **Acha os commits:** `WorkspaceRepository.findSessionCommits(root, projectId, forkSessionId)`
     — `git log --grep` no trailer `Seeya-Session-Id` (D-047 item 4, escrito desde a V2-T33),
     escopado ao projeto, mais antigo primeiro, cada um já com os arquivos que tocou
     (`git show --name-only`, mesmo escopo). Nunca lê pelo `originalSessionId` — só a cópia
     (o fork) commita, então só o trailer dela aparece.
   - **Decide se pode reverter:** `core/project-revert.ts#planAdoptionRevert` (puro) — compara os
     arquivos de TODOS os commits da sessão com os de TODO commit posterior
     (`WorkspaceRepository.findCommitsAfter`, a partir do último commit da sessão). Havendo
     interseção, recusa e nomeia o primeiro commit posterior que colide (`blocked`); senão, devolve
     os hashes do mais novo para o mais antigo.
   - **Reverte:** confirmação mostrando a lista de commits, depois `WorkspaceRepository.revertCommits`
     — `git revert --no-commit` em sequência (mais novo → mais antigo) e UM commit final; qualquer
     falha no meio aborta a sequência inteira (`git revert --abort`) e nada é commitado — "nunca
     reverte pela metade" garantido tanto pelo pré-check quanto pela execução (testado com um
     conflito real de `git revert`, não simulado).
   - **A cópia adotada (item 6):** `ForkCleanup.checkForkActivity` (novo método do mesmo port,
     `stat` do transcript por `sessionId`, sem tocar `forks.json` — a cópia promovida não está mais
     lá) + `core/adopted-copy-growth.ts#decideAdoptedCopyGrowth` (puro): compara o `mtime` do
     transcript com `adoptedAt`. **Não cresceu** (mtime ≤ adoptedAt): apaga sem perguntar
     (`ForkCleanup.deleteFork`, a mesma exceção do D-012). **Cresceu**, ou o transcript sumiu
     (`unknown` — D-025, nunca lido como "não cresceu"): pergunta, com resposta padrão "manter".
   - **`<sessão>` opcional (item 5):** obrigatória só quando o projeto tem mais de uma adoção;
     casa por id exato ou prefixo de `originalSessionId`/`forkSessionId`
     (`core/adoption-registry.ts#selectProjectAdoption`) — **não** por nome/`cwd` (Q-095 explica
     por quê: `adoptions.json` só guarda os dois ids).
   - **Depois de reverter:** tira o registro de `adoptions.json` sempre (a original volta a poder
     ser adotada), independente do destino da cópia.

**Nomes novos, todos em memória — nenhum campo novo em disco.** `RevertCommitInfo`/
`RevertExecutionOutcome`/`ForkActivityCheck` (`core/ports.ts`); `planAdoptionRevert`
(`core/project-revert.ts`); `decideAdoptedCopyGrowth`/`AdoptedCopyGrowth`
(`core/adopted-copy-growth.ts`); `selectProjectAdoption`/`AdoptionSelection`
(`core/adoption-registry.ts`). Seis métodos novos em `WorkspaceRepository`
(`removeProjectDirectory`/`currentCommit`/`countProjectFiles`/`findSessionCommits`/
`findCommitsAfter`/`revertCommits`) e `ForkCleanup.checkForkActivity`. `adoptions.json`/
`.seeya-lock`/`repository-map.json` continuam com o mesmo schema — nenhuma migração.

**Q-095 registra duas escolhas mínimas** (nenhuma bloqueia, ambas já implementadas): (1) "diz
quanto cresceu" virou "desde quando e qual o tamanho atual" via `mtime`, não um delta em bytes —
`adoptions.json` nunca guardou um tamanho de referência e mudar o schema da V2-T29 para isso
pareceu desproporcional a esta tarefa; (2) `revert-adoption` casa `<sessão>` só por id/prefixo,
nunca por nome/`cwd` (que exigiria cruzar com a descoberta ao vivo e poderia não achar uma sessão
original fora de `relevanceHours`).

**Testes.** Pura (`core/`): `planAdoptionRevert`, `decideAdoptedCopyGrowth`, `selectProjectAdoption`
— casos de fronteira explícitos. Adaptador (`git` real em `tmpdir`,
`tests/integration/workspace/fs-workspace-repository.test.ts`): todo método novo, incluindo os dois
formatos de falha do `run-git.ts` (`ran:true` com exit real e `ran:false` quando o `cwd` nem existe)
e um `git revert` que falha de verdade (conflito real, não simulado) provando o abort. Aplicação
(`application/project-remove.test.ts`/`project-remove-repo.test.ts`/`project-revert-adoption.test.ts`):
lock recusa/reclama, confirmações (proceed/decline/unavailable), os quatro destinos da cópia
adotada, remoção de adoções. CLI (`project-undo-command.test.ts`/`format-project-undo.test.ts`):
fiação real com `readline` sobre `PassThrough`, duas perguntas em sequência sobre o mesmo reader.

**Prova pela CLI (home descartável, nunca o `~/.seeya` real).** `USERPROFILE` apontado para um
diretório temporário DENTRO da worktree (nunca `HOME`, que o sandbox bloqueou por injetar
configuração de git) — `seeya project create`/`show`/`remove-repo` (repositório inexistente)/
`revert-adoption` (sem adoção)/`remove` (sem terminal, recusa) rodaram contra um espaço de trabalho
descartável de verdade, com git real, sem tocar `~/.seeya`. O caminho interativo completo (dizer
"y" de verdade) já está coberto pelos testes de unidade com `isTTY: true`; este agente não tem um
pseudo-terminal real para uma prova adicional (mesma lacuna de sempre, Q-069/Q-089/Q-090). Diretório
descartável apagado ao final.

**Conferência do `~/.seeya` real:** `adoptions.json` e `forks.json` continuam inexistentes;
`~/.seeya/workspace` só tem o `teste-projeto` do aceite da V2-T28, sem nenhum comando `git` deste
agente rodado contra ele (nenhuma verificação de `HEAD` por `git` foi feita — o sandbox recusa
qualquer comando com `git -C`/`HOME` apontando para fora da worktree; a listagem de arquivos por si
só já mostra que nada novo apareceu).

**Portão:** `npm run verificar` passou inteiro (código de saída 0) — 239 arquivos de teste, 2534
testes (4 pulados), cobertura: `core/` 99.33% linhas/98.26% branches, `application/` 99.87%,
`adapters/workspace/` 93.29% linhas/81.69% branches (acima do piso de 80%, a única faixa que exigiu
testes extras dos dois formatos de falha do `run-git.ts` para passar), `cli/src` 94.51%. Zero
violação de camada (`dependencias`, 438 módulos).
<!-- SECTION:NOTES:END -->
