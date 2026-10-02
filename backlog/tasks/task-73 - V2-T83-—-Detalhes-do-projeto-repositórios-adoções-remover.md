---
id: TASK-73
title: 'V2-T83 — Detalhes do projeto: repositórios, adoções, remover'
status: To Do
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
