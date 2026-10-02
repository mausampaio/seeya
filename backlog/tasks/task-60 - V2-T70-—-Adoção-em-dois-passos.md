---
id: TASK-60
title: V2-T70 — Adoção em dois passos
status: Review
assignee: []
created_date: '2026-09-30 10:34'
updated_date: '2026-10-02 16:28'
labels: []
milestone: m-2
dependencies:
  - TASK-65
type: feature
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 7 (item 9): seletor de projeto e explicação num diálogo só, revisão dos arquivos com tipo e linhas antes do commit, falha nunca em silêncio.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Relatório do agente (branch `tarefa/V2-T70-adocao`, worktree isolada, a partir da `main`;
commits `fc6a946`, `39f527e`, `0c3f622`, `3e3516a`).**

**Porta nova no motor.** `core/ports.ts#WorkspaceRepository.listChangedFilesWithStats(root,
projectId)` devolve `readonly ChangedFileEntry[]` — união discriminada por `kind`
(`added`/`modified`/`deleted`), com `path` e `lines: ChangedFileLineCounts | null`
(`added`/`removed`). Implementada em `adapters/workspace/changed-file-stats.ts`
(`FsWorkspaceRepository.listChangedFilesWithStats`, V2-T70): `git status --porcelain
--untracked-files=all` para o tipo, `git diff --numstat`/`git diff --cached --numstat` para as
linhas dos arquivos rastreados, leitura direta + contagem de quebras de linha para os não
rastreados (detecção de binário por byte NUL). Renomeio vira `modified` com o caminho inteiro
`"old -> new"` e `lines: null` — nunca recasado contra a grafia diferente (`old => new`) do
`--numstat` (decisão registrada em `docs/QUESTOES.md` Q-108). 10 testes de integração contra um
repositório git real (`tests/integration/workspace/changed-file-stats.test.ts`).

**Diálogo único de adoção (`docs/INTERFACE.md` § 7).**
`packages/app/src/renderer/features/adoption/` — `AdoptionDialog.tsx` (raiz, um `Dialog` cujo
corpo troca por `PickPane`/`ReviewPane`/`ResultPane` conforme `state.kind`, mesmo formato de
`EndDayDialog.tsx`), `useAdoption.ts` (controles: validação do id de projeto novo via
`isValidProjectId`, prévia ao vivo pelo canal `previewAdoptionLaunch`, `submit`/`cancel`/
`answerCommit`/`closeResult`), `PickPane/` (passo 1: cartão da sessão, `SegmentedControl`
Existing/New, `Select` ou `TextField`, explicação em `InfoBox`), `ReviewPane/` (passo 2: reusa
`StatusList` — tipo A/M/D com badge colorido e `+N −M` por arquivo), `ResultPane/` (passo 3:
sucesso ou falha, nunca fecha em silêncio — falha passa por `summarizeErrorReason` para o texto
curto com `title` completo). `adoption-dialog-bridge.ts` é o pub/sub módulo-nível que
`useSessions.ts#onAdopt` usa para abrir o diálogo a partir da aba Sessions. Substitui inteiramente
`renderer/legacy/adopt-flow-view.ts` (apagado) e os 4 diálogos estáticos que
`renderer/legacy/dialogs-shell.tsx` tinha.

**IPC.** `previewAdoptionLaunch` (invoke) substitui o antigo par
`confirmAdoptionLaunchRequest`/`answerAdoptionLaunchConfirm` — a confirmação do passo 1 agora é
síncrona dentro do próprio diálogo da janela (`confirmLaunch: () => Promise.resolve('proceed')`
em `main/project-ipc.ts`), sem ida e volta. `confirmAdoptionCommitRequest` passou a carregar
`changedFileEntries: readonly ChangedFileEntry[]` (dados estruturados) em vez de linhas de texto
já formatadas — a prévia dos arquivos é dado real do motor, nunca uma segunda formatação.

**CLI: nenhum impacto.** `cli/format-project.ts`/`project-adopt-types.ts` não foram tocados; o
fluxo de linha de comando (`seeya project adopt`) continua exatamente como estava.

**Prova visual — janela real, offscreen, `SEEYA_APP_HOME_OVERRIDE` isolado, nos dois temas.**
Instrumentação nova (nunca lida por `npm run app`): `SEEYA_APP_VERIFY_ADOPTION_FAKE` (troca o
`SessionAdoptionLauncher` real por `composition/verification-fake-adoption-launcher.ts` — nunca
lança `claude` de verdade; escreve `context/know-how.md`, modifica `INDEX.md`, apaga `AGENTS.md`
e mais 14 arquivos pequenos em `context/notes/` só para a lista do passo 2 provar que rola),
`SEEYA_APP_VERIFY_ADOPTION_FAKE_COMMIT_FAILURE` (`composition/verification-fake-failing-commit.ts`
— um `Proxy` sobre o `WorkspaceRepository` real cujo `commitAll` sempre recusa) e
`SEEYA_APP_VERIFY_ADOPTION_FLOW_DIR` (dirige `captureAdoptionFlowVerification`, `main/main.ts`).
Achado ao depurar a captura: o passo 2/3 dependem de uma viagem real (lock do projeto, `git
init`+commit da criação, o atraso do fork fictício, o IPC de volta) — trocados os `sleep` fixos
por `waitForElement` (poll com `clock.now()`/`clock.sleep`, nunca `Date.now()`, D-019). E: com
`COMMIT_FAILURE` ligado, `ensureProjectExists` também falharia na CRIAÇÃO do projeto (o wrapper
recusa todo `commitAll`) — o cenário de falha teria que ser provado antes mesmo de chegar à
revisão. Corrigido com um segundo lançamento reaproveitando o MESMO `homeDir` de um primeiro
lançamento (que já criou "adoption-fixture-project"): o segundo roda em modo `Existing project`
(já pré-selecionado), `ensureProjectExists` cai no ramo `alreadyExists` e só a falha do commit da
ADOÇÃO em si é provada — `run-pair.mjs` no scratchpad do agente é o script de duas passadas.

Capturas finais (scratchpad do agente,
`v2t70-verify/screenshots-final/{light,dark}/`): `01-pick-existing-empty.png` (passo 1, Existing
project, lista vazia — primeira adoção, nenhum projeto ainda), `02-pick-new-invalid-id.png` (passo
1, New project, "Invalid ID!" digitado, erro "Use lowercase letters, digits and hyphens — for
example payments-webhooks." visível), `03-review-long-list.png` (passo 2, 17 entradas A/M/D com
contagem de linhas, barra de rolagem visível — prova a rolagem pedida),
`04-result-success.png` (passo 3, sucesso), `05-pick-existing-with-project.png` (bônus: Existing
project com uma opção real pré-selecionada), `06-review-before-failure.png` (passo 2 do cenário de
falha), `07-result-failure.png` (passo 3, falha, nunca um fechamento silencioso). Confirmado
depois de todas as capturas: `HKCU:\Software\Classes\seeya`/`seeya-dev` continuam apontando para o
checkout real (nunca para um diretório temporário), e `~/.seeya/protocol-handler.json` manteve o
hash SHA-256 `e3d8a283d81e8feef088cbd050c06100ced744f976a2845dc1c3b842ea013072` — nenhuma das
capturas tocou o registro ou o `~/.seeya` reais.

**`npm run verificar`: verde, a partir de build limpo** (`dist/` dos três pacotes apagado antes).
Cobertura agregada: Statements 95.37%, Branches 91.38%, Functions 95.07%, Lines 95.63% — acima dos
pisos de `docs/TESTES.md`.

**Correções encontradas na própria verificação visual (fora do escopo da spec, mas necessárias
para a prova rodar):** `SessionsTable.tsx` — `Button.tsx` não repassa `data-*` arbitrário
(interface fechada), então o marcador `data-adopt-session-id` nunca chegava ao DOM quando passado
direto ao `Button`; movido para um `<span>` que o envolve, mesma razão já documentada para
`SessionIdCopyButton`.

**Pendência de coordenação (V2-T71, nunca executada ainda — aviso do PO em
2026-10-02):** a V2-T71 (branch `tarefa/V2-T71-confirmacoes`, commit `732cc29`) acrescentou no
motor `listChangedFilesWithStatus`/`core/changed-file-status.ts`, que lê o mesmo `git status
--porcelain` que `adapters/workspace/changed-file-stats.ts` (desta tarefa) também lê — duas
leituras de status não podem conviver no motor. Combinado com o PO: a V2-T71 entra primeiro em
`main`; só quando avisado que ela já está lá, este branch rebaseia e a contagem de linhas desta
tarefa passa a reusar o parser/tipo de status dela, estendendo-os em vez de duplicá-los. Essa
coordenação **não foi executada** nesta sessão (o aviso de "já está em main" nunca chegou) — fica
registrada aqui para quem revisar ou continuar.

**Sem questões novas em `docs/QUESTOES.md`** além da Q-108 (já registrada no commit `0c3f622`).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Claude Sonnet 5
created: 2026-10-02 16:28
---
Resposta a revisao do PO (rodada 2), commits 1a7552b->rebase->64cef07/1df885b em tarefa/V2-T70-adocao.

Itens 1-6 corrigidos, com prova visual refeita nos dois temas (v2t70-verify/screenshots-final/{light,dark}/, scratchpad do agente):

1. Rolagem horizontal eliminada nos tres lugares. Causa raiz: o SessionsTable.tsx tinha larguras de coluna nunca medidas (soma 1054px) - com table-layout: fixed, a tabela cresce alem do conteiner em vez de encolher as colunas, e a coluna Name media 0px de verdade (getBoundingClientRect() contra o bundle real). Larguras remedidas (soma 800px), guarda unitario novo travando o orcamento. No dialogo de adocao: o cartao da sessao (nome+id+chip) agora quebra linha (Stack wrap) em vez de forcar o dialogo a abrir mais largo que os outros; PickPane.module.css#.pane ganhou overflow-x: hidden escopado (achado: a mesma regra no Dialog.module.css compartilhado quebrou a transicao review->result da adocao por um motivo nao rastreado a tempo - revertida de la, mantida so aqui). legacy.css#.page-pane tambem ganhou o mesmo backstop.
2. What happens next abrevia ~ para exibicao, caminho completo so no title - main/project-ipc.ts chama renderAdoptionLaunchExplanationLines duas vezes (abreviado para tela, bruto para o tooltip), a funcao e a saida da CLI nao mudaram. Dialogo do passo 1 ganhou largura propria (AdoptionDialog.module.css, min(560px, 100vw-32px), mesma formula do LeftoverChangesConfirmDialog da V2-T71).
3. Existing project mostra so o nome, id entre parenteses so quando difere.
4. Resultado de falha mostra a mensagem completa, sempre visivel, abaixo do resumo curto (nunca so title) - ResultPane.module.css#.fullReason, com quebra e rolagem propria para uma mensagem muito longa.
5. Revisao ganhou a linha de contexto (N files changed in project X, no corpo) e Discard/Commit explicados no rodape fixo, acima dos botoes - mesmo padrao que LeftoverChangesConfirmDialog/ProjectLockConfirmDialog (V2-T71) ja estabeleceram.
6. Q-107 renomeada para Q-108 (V2-T78 ja tinha Q-107) - docs/QUESTOES.md, mais as duas referencias no backlog.

Item 7 (rebase sobre a V2-T71, ja em main): feito. WorkspaceRepository.listChangedFilesWithStats (adapters/workspace/changed-file-stats.ts) agora reusa core/changed-file-status.ts#parseChangedFileStatusLine/ChangedFileStatus da V2-T71 para o tipo de cada linha - uma unica chamada de git status --porcelain por listagem, nunca duas. renamed/other colapsam em modified/lines: null (Q-108). Meu proprio tipo (core/ports.ts) foi renomeado de ChangedFileEntry para ChangedFileStatsEntry para nao colidir com o ChangedFileEntry mais simples ({ path, status }) que a V2-T71 ja tinha com esse nome em core/changed-file-status.ts - os dois nomes e a distincao estao documentados nos dois arquivos e no glossario do AGENTS.md.

Achado durante a correcao do item 1, registrado mas nao perseguido: overflow-x: hidden no Dialog.module.css compartilhado (a correcao obvia para o scroll horizontal) travava a transicao review->result do fluxo de falha da adocao de um jeito que nao investiguei ate a causa exata (confirmado isolando a mudanca num build real, revertendo e testando de novo - o sintoma ia e voltava exatamente com essa linha). Preferi resolver no escopo mais estreito (PickPane.module.css, que e meu e nunca participa dessa transicao) a arriscar o mesmo efeito colateral nos dialogos da V2-T71 que ja usam o componente compartilhado.

npm run verificar verde a partir de build limpo, depois do rebase: Statements 95.46%, Branches 91.34%, Functions 95.12%, Lines 95.71%. dependency-cruiser sem violacao (806 modulos, 2427 dependencias). Registro/protocol-handler.json (e3d8a283...) conferidos sem alteracao antes e depois de todas as capturas desta rodada.
---
<!-- COMMENTS:END -->
