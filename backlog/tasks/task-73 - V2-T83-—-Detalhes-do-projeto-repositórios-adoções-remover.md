---
id: TASK-73
title: 'V2-T83 — Detalhes do projeto: repositórios, adoções, remover'
status: Review
assignee: []
created_date: '2026-10-02 20:22'
labels:
  - ui
dependencies: []
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa docs/INTERFACE.md seção 4a. Pedido do mantenedor (2026-10-02): trazer para a janela o que ainda só existe na CLI — add-repo, remove-repo, revert-adoption e remove. Diálogo Project details aberto por um botão de ícone (Manage project) na linha do projeto na aba Projects: cabeçalho (nome, id, lock, caminho), Repositories (lista com remoto e caminho neste dispositivo; Add repository… pelo seletor de pasta do sistema; Remove por linha), Adopted sessions (lista com Revert…, confirmação com a contagem de commits, recusa com motivo, pergunta manter/apagar a cópia) e Remove project (confirmação com nome, contagem de arquivos e o que não é apagado; resultado com o commit de recuperação). Reusa application/repository-association.ts#addRepository, project-remove-repo.ts#removeRepository, project-revert-adoption.ts#revertAdoption e project-remove.ts#removeProject — nenhuma regra nova no motor; o que faltar de dado estruturado (ex.: o caminho local de cada repositório, as adoções do projeto) entra tipado em state/ e na IPC. Ações que escrevem ficam desabilitadas, com o motivo, quando o projeto está travado por outra sessão. Capturas reais nos dois temas de cada seção e de cada confirmação, com dependências fictícias onde a ação lançaria algo real.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Entregue (docs/INTERFACE.md § 4a/§ 9). Nenhuma regra nova no motor: `addRepository`,
`removeRepository`, `revertAdoption` e `removeProject` são as mesmas funções da CLI, chamadas pela
janela (`main/project-details-ipc.ts`, `composition/index.ts#build*Deps`).

**Onde mora.** `renderer/features/project-details/` (pasta própria, não dentro de `projects/`: é um
modal aberto da aba Projects mas não é região dela, e é montado por `App.tsx` pelo mesmo motivo do
`NewProjectDialog` — um `<dialog>` dentro de uma aba escondida nunca aparece). As três confirmações
vivem em `features/confirmations/` (`RevertAdoptionConfirmDialog`,
`DeleteAdoptedCopyConfirmDialog` — `Keep` é o primário e o Esc mantém —,
`RemoveProjectConfirmDialog`), cada uma respondendo a um callback do próprio motor pelo mesmo
`PendingConfirmations` do `open`. `ProjectsTable` ganhou só uma coluna estreita com o `IconButton`
**Manage project** (prop `onManage`); a ação principal da linha não mudou.

**Dados novos, tipados.** `state/project-details.ts` (`ProjectDetailsData`: caminho local por
repositório — `onThisDevice`/`notOnThisDevice`, D-025 —, adoções do projeto com ids curtos,
contagem de arquivos, `writeAccess` aberto/bloqueado, `resolveWriteBlockedReason`),
`composition/project-details-reader.ts#readProjectDetails` (sem `electron`, exercitado de verdade
em `tests/integration/app/project-details-reader.test.ts`), `state/project-details-result.ts`
(resultado do motor -> tom + frases da CLI, `switch` exaustivo). IPC novos: `getProjectDetails`,
`addProjectRepository`, `removeProjectRepository`, `revertProjectAdoption`, `removeProject` e três
pares `confirm*Request`/`answer*Confirm` (`ipc/channels.ts`). O seletor de pasta reaproveita o
`pickDirectory` da V2-T64.

**Frases compartilhadas.** Movidas de `cli/format-project-{open,undo,shared}.ts` para
`core/project-management-message.ts` (a CLI só chama); a saída da CLI é byte-idêntica (os testes
`format-project*.test.ts` e `project-undo-command.test.ts` passam sem alteração). `AdoptedCopyOutcome`
mudou de lugar e é reexportado por `application/project-revert-adoption.ts`.

**Componentes.** `Button` ganhou `tone` (`neutral`/`error`, vocabulário `Tone` da D-052) e
`IconButton` um `title` opcional.

**Defeito achado pela prova visual (com teste de regressão).** Uma ação de escrita segura o lock;
um tick ambiente que começava durante ela terminava depois do push da própria ação e deixava
"Locked by an unidentified session" na tela (capturado: projeto `Unlocked` mostrando `Locked` logo
após **Remove**). `main/project-ipc.ts#pushProjectsUpdate` agora só envia o push mais novo
(`composition/latest-only.ts#deliverLatestOnly`, `tests/unit/app/composition/latest-only.test.ts`;
falha sem a correção). Vale para todo push de projeto; nenhum outro comportamento mudou.

**Instrumentação nova (AGENTS.md).** `SEEYA_APP_VERIFY_PROJECT_DETAILS_DIR`
(`main/verification-project-details.ts`, treze capturas por cliques reais; toda ação do motor roda
de verdade num espaço de trabalho descartável, sem lançar `claude`) e
`SEEYA_APP_VERIFY_PICKED_DIRECTORIES` (`composition/verification-picked-directories.ts`, no lugar do
diálogo nativo de pasta).

**Questão aberta:** Q-109 (projeto aberto numa aba da própria janela; frase da CLI "it kept writing"
tem gramática torta e foi mantida por exigência de saída inalterada; ordem de push; caminho cru no
erro de `pathNotFound`).

`npm run verificar` do zero (`rm -rf packages/*/dist`): passou (formato, tipos dos três tsconfigs,
lint, build, dependências, cobertura 95.7% linhas).
<!-- SECTION:NOTES:END -->
