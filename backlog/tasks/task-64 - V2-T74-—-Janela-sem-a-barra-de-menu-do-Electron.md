---
id: TASK-64
title: V2-T74 — Janela sem a barra de menu do Electron
status: To Do
assignee: []
created_date: '2026-09-30 18:38'
labels: []
milestone: m-2
dependencies: []
type: feature
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T74 — Janela sem a barra de menu do Electron.** Pedido do mantenedor em 2026-09-30, ao ver o
build da V2-T63: a janela mostra a barra de menu padrão do Electron ("File Edit View Window"), que
o app não usa. `docs/INTERFACE.md` § "Estrutura da janela", parágrafo "Moldura da janela".

**O que entra:**

1. **Windows e Linux:** sem barra de menu. A barra de título do sistema continua, com minimizar,
   maximizar e fechar do próprio SO (nada de moldura desenhada pelo app).
2. **macOS:** menu mínimo do app com o menu Edit — sem ele, copiar e colar deixam de funcionar nos
   campos de texto. Medir/confirmar pela documentação do Electron e citar.
3. **Atalhos que o menu padrão dava de graça:** listar quais existiam (recarregar, ferramentas de
   desenvolvedor, zoom, tela cheia…) e dizer quais somem. Copiar/colar no terminal e nos campos
   continuam funcionando (provar). As ferramentas de desenvolvedor não precisam existir no app
   instalado; se fizer falta no desenvolvimento, só no `npm run app`.

**Aceite do mantenedor:** o app instalado abre sem a barra de menu, com os três botões da janela, e
copiar/colar segue funcionando no terminal e nos campos.
<!-- SECTION:DESCRIPTION:END -->
