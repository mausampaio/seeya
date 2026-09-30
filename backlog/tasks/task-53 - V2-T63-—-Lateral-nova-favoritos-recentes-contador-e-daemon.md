---
id: TASK-53
title: 'V2-T63 — Lateral nova: favoritos, recentes, contador e daemon'
status: To Do
assignee: []
created_date: '2026-09-30 10:33'
updated_date: '2026-09-30 17:02'
labels: []
milestone: m-2
dependencies:
  - TASK-52
type: feature
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 1 (ordem de entrega, item 2), sobre a fundação da V2-T62 (D-051). Inclui os favoritos por máquina (nome em disco no glossário antes do código) e a pílula do daemon com iniciar/parar. Tira da lateral o painel de status em texto, a busca por id e Other sessions — só depois que as aba Sessions (V2-T68) e o rodapé cobrirem o que eles mostravam; até lá, o que ainda não tem casa nova fica. Custo de desempenho dito na entrega (docs/DESEMPENHO.md).
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-30 17:02
---
Refinamento do PO em 2026-09-30, antes do despacho: as abas Projects e Sessions (V2-T67/V2-T68) ainda não existem. Nesta tarefa, 'All projects' e 'Sessions' já abrem ABAS de página (o mecanismo de aba de página entra aqui, reusável pelo Today na V2-T66), e o conteúdo delas é o que a lateral mostra hoje (lista de projetos com Open; Other sessions por diretório + busca por id), sem redesenho — o redesenho em tabela é da V2-T67/V2-T68. Assim nada some da janela. O painel de status em texto sai; o que ele mostrava de útil já está no rodapé (agenda, daemon) — o resto, se faltar, vira questão. Inclui o achado da V2-T62: anel de foco visível no botão de recolher ao abrir a janela. 'Recent' é derivado de evidência (D-025) — o agente justifica a fonte da última atividade de cada projeto.
---
<!-- COMMENTS:END -->
