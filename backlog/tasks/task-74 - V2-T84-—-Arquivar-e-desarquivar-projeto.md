---
id: TASK-74
title: V2-T84 — Arquivar e desarquivar projeto
status: Review
assignee: []
created_date: '2026-10-02 21:17'
updated_date: '2026-10-03 02:53'
labels:
  - feature
dependencies: []
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa docs/INTERFACE.md seção 4b. Decisão do mantenedor (2026-10-02): arquivar é o único estado de ciclo de vida do projeto — reversível, com nota opcional, sem campo de status. Entra: (1) motor — campos novos no seeya.json (data do arquivamento e nota opcional; nomes das chaves e dos tipos no glossário do AGENTS.md ANTES do código, schemaVersion do manifesto com migração: manifesto antigo lê como não arquivado, D-025), união discriminada ativo/arquivado em ProjectManifest (D-024), application archiveProject/unarchiveProject com lock do projeto (D-047 item 8), commit com trailers e SEEYA_MANIFEST_WRITE_AUTHORIZED (V2-T73), no-op honesto quando já está no estado pedido; (2) CLI — seeya project archive <id> [--note] / unarchive <id>; project list separa arquivados com data e nota; project show diz o estado; project open num arquivado recusa dizendo como desarquivar; (3) janela — filtro Archived na aba Projects, arquivados fora de favoritos/recentes/contagem da lateral e da lista padrão, ação Unarchive… na linha (pergunta só desarquivar ou desarquivar e abrir), Archive project… no diálogo Project details acima de Remove project. Arquivar não muda a captura do End day nem a descoberta de sessões. Depende da V2-T83 (o diálogo Project details).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Entregue (docs/INTERFACE.md § 4b/§ 9). Glossário do `AGENTS.md` primeiro (chaves `archivedAt`/`archiveNote`, `ProjectLifecycle`, comandos, a instrumentação nova), depois o código.

**Motor.** `core/types.ts#ProjectLifecycle` — união discriminada (`active` / `archived` com `archivedAt: Date` e `note: string | null`), campo obrigatório `ProjectManifest.lifecycle`. `adapters/workspace/project-manifest-schema.ts`: `schemaVersion` 1→2 com `PROJECT_MANIFEST_SCHEMA_MIGRATIONS` (v1 só avança a versão; sem as chaves o manifesto lê como `active`, D-025); `archiveNote` sem `archivedAt` e `archivedAt` que não é data são recusados com o caminho do campo; escrever um ativo nunca grava as duas chaves. `application/project-archive.ts#archiveProject`/`unarchiveProject` no molde de `project-remove-repo.ts` (toma o lock, escreve o manifesto, commita com trailers e `manifestWriteAuthorized: true`, `finally` solta o lock); resultados `archived`/`alreadyArchived`/`unarchived`/`alreadyActive`/`locked`/`notFound`/`invalidId`, o "já estava" é dito sem commit vazio, a data vem de `Clock`, a nota é aparada (em branco = sem nota). `openProject` recusa um arquivado com `projectArchived` ANTES do harness, dos ganchos, do lock e do `CLAUDE.md` (vale para `--resume`, que passa pelo mesmo `openProject`). Nada de descoberta, captura do End day, agrupamento ou auditoria olha `lifecycle`.

**CLI.** `seeya project archive <id> [--note]` / `unarchive <id>` (`project-archive-command.ts`); frases compartilhadas em `core/project-management-message.ts` (`formatProjectArchivedLine` etc.). `list`: seção `Archived:` depois dos ativos (data e nota); o resumo conta só ativos e diz `, N archived` só quando há; sem arquivado, a saída é byte-idêntica (teste com a string inteira). `show`: nova linha `  state: active` / `  state: archived on <data> — <nota>`. `open`/`open --resume` num arquivado: `seeya: project "<id>" is archived — run "seeya project unarchive <id>" first, then open it again.`

**Janela.** `state/projects-table.ts`: filtro `archived`; `All`/`running`/`locked`/busca/contagem olham só ativos. `state/projects-panel.ts`: `ProjectPanelRow.lifecycle`, `ProjectRowAction` ganha `unarchive` (`resolveProjectRowAction` agora recebe a linha). `state/sidebar-summary.ts` e `useSidebar.ts`: arquivados fora de Favorites, de Recent e da contagem de All projects; `favorite-projects.json` nunca muda (provado: o favorito volta ao desarquivar, captura 11). Aba Projects: `Archived` no `SegmentedControl`, coluna Lock vira `Archived` (data) com a nota sob o nome, linha sem chevron (nunca `Resume`), ação `Unarchive…` (desabilitada com o motivo se travado por outra sessão). Confirmações em `features/confirmations/`: `ArchiveProjectConfirmDialog` (nota opcional, o que muda) e `UnarchiveProjectConfirmDialog` (`Cancel` / `Unarchive` / `Unarchive and open`, cada uma explicada); a chamada ao motor roda DENTRO do diálogo, com `loading`, e qualquer recusa (lock, já arquivado, IPC rejeitada) fica na tela. Project details: `ArchiveSection` acima de `Remove project` (estado + `Unarchive` num arquivado), texto de Remove diz "para projeto criado por engano". Aba Sessions: sessão de projeto arquivado segue listada com o nome do projeto, `Resume` desligado com o motivo no `title` (`SessionRowAction.projectArchived`). IPC `archiveProject`/`unarchiveProject`.

**Pendência do PO (coluna Lock a 1200 px).** Medido no bundle real: `Locked by session 33333333` 190 > 181 e a data da última atividade 143 > 128 (também cortava). Coluna Lock mostra `Locked · <id>` (`formatProjectRowLockCellText`; frase completa no `title`), Lock 205→172 px, Última atividade 152→176 px. Medido de novo: `truncated: []` nos dois temas.

**Decisões onde a spec calou:** Q-113 (colunas do filtro Archived, contagem do cabeçalho, `Unarchive…` travado, `Unarchive` direto no Project details, adoção para arquivado, `schemaVersion` 2 recusado por `seeya` antigo, largura do Lock).

**Prova.** Unidade (schema/migração, união, filtro/contagens, ação da linha, mensagens, dois diálogos, `ArchiveSection`, Sessions), aplicação com os fakes nomeados, integração contra git real (`tests/integration/application/project-archive.test.ts`: o commit passa pelo gancho `commit-msg` de verdade, e o MESMO manifesto commitado sem a marca é recusado), CLI. Janela real, bundle não-`--dev`, `SEEYA_APP_HOME_OVERRIDE` descartável, `--user-data-dir` descartável, 11 capturas por tema + `metrics.json` (`SEEYA_APP_VERIFY_ARCHIVE_DIR`, `main/verification-archive.ts`): arquivar de verdade (lock, manifesto, commit pelo gancho — o `git log` do espaço de trabalho descartável lê `Archive project payments-api` e `Unarchive project payments-api` com trailers), `Unarchive and open` pelo `openProject` real até o harness fictício (linha do projeto no log). Registro (`seeya`, `seeya-dev`) e hash de `~/.seeya/protocol-handler.json` (`E3D8A283…`) iguais antes e depois.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Dev
created: 2026-10-03 02:53
---
Revisão do PO aplicada (2026-10-02): data do arquivamento na janela em formato local (dia, como a coluna Last activity; CLI segue em ISO), seletor de projeto da adoção sem arquivados (teste renderizado, falha sem o filtro), questão renumerada para Q-113 após o rebase sobre a V2-T85, capturas refeitas nos dois temas.
---
<!-- COMMENTS:END -->
