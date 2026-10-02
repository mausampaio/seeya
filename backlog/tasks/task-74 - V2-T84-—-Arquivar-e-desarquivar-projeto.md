---
id: TASK-74
title: V2-T84 — Arquivar e desarquivar projeto
status: To Do
assignee: []
created_date: '2026-10-02 21:17'
labels:
  - feature
dependencies: []
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa docs/INTERFACE.md seção 4b. Decisão do mantenedor (2026-10-02): arquivar é o único estado de ciclo de vida do projeto — reversível, com nota opcional, sem campo de status. Entra: (1) motor — campos novos no seeya.json (data do arquivamento e nota opcional; nomes das chaves e dos tipos no glossário do AGENTS.md ANTES do código, schemaVersion do manifesto com migração: manifesto antigo lê como não arquivado, D-025), união discriminada ativo/arquivado em ProjectManifest (D-024), application archiveProject/unarchiveProject com lock do projeto (D-047 item 8), commit com trailers e SEEYA_MANIFEST_WRITE_AUTHORIZED (V2-T73), no-op honesto quando já está no estado pedido; (2) CLI — seeya project archive <id> [--note] / unarchive <id>; project list separa arquivados com data e nota; project show diz o estado; project open num arquivado recusa dizendo como desarquivar; (3) janela — filtro Archived na aba Projects, arquivados fora de favoritos/recentes/contagem da lateral e da lista padrão, ação Unarchive… na linha (pergunta só desarquivar ou desarquivar e abrir), Archive project… no diálogo Project details acima de Remove project. Arquivar não muda a captura do End day nem a descoberta de sessões. Depende da V2-T83 (o diálogo Project details).
<!-- SECTION:DESCRIPTION:END -->
