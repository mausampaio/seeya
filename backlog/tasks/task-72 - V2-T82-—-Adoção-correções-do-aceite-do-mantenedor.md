---
id: TASK-72
title: 'V2-T82 — Adoção: correções do aceite do mantenedor'
status: To Do
assignee: []
created_date: '2026-10-02 17:29'
labels:
  - ui
dependencies: []
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Aceite do mantenedor da V2-T70 (2026-10-02, instalador 13:40, adoção real). (1) Close abre o projeto: em renderer/features/adoption/AdoptionDialog.tsx os botões Close e Open project chamam o mesmo controls.closeResult, que em useAdoption.ts chama api.openProject sempre que state.adopted — Close tem de só fechar; só Open project abre. Esc/fechar pelo diálogo = Close. Teste renderizado que trava os dois caminhos (falha antes da correção). (2) Cartão do resultado colado nos botões: o rodapé do Dialog compartilhado (components/Dialog/Dialog.module.css#.footer) não tem espaço em relação ao corpo — corrigir no componente (vale para todo diálogo com footer), conferindo os outros diálogos que usam footer (End day, confirmações, New project) para não dobrar espaço onde o corpo já termina com margem. (3) Diálogo de revisão ocupa a vertical inteira com 9 arquivos: max-height hoje é 100vh menos uma margem pequena; dar um teto próprio (algo como min(80vh, 720px), medido nas capturas) com a lista rolando por dentro, cabeçalho e rodapé fixos; conferir que End day e mudanças pendentes ficam coerentes com o mesmo teto. (4) A revisão lista arquivos que não entram no commit: a tela mostrou '9 files' incluindo teste-projeto/.claude/settings.json e teste-projeto/.seeya-audit, mas o commit da adoção teve 7 — os dois são ignorados pelo .gitignore do espaço de trabalho (.seeya-audit, **/.claude/). O commit está certo; a lista está errada. Achar a causa com medição (hipótese: listChangedFilesWithStats roda antes de o .gitignore do espaço de trabalho ganhar os padrões, que só são garantidos no commitAll; ou a contagem de arquivos novos lê o disco sem passar pelo ignore) e corrigir de modo que a lista seja exatamente o que commitAll vai commitar — teste de integração contra repositório git real temporário que falha antes da correção, cobrindo também listChangedFiles/listChangedFilesWithStatus (mudanças pendentes do open) se tiverem o mesmo defeito. Capturas reais nos dois temas: revisão com 9+ arquivos (altura), resultado de sucesso (espaço), e prova por instrumentação de que Close não abre aba e Open project abre.
<!-- SECTION:DESCRIPTION:END -->
