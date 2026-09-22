---
id: TASK-4
title: S5-T7 — Avaliar um `--sessions` que aceite lista
status: To Do
assignee: []
created_date: '2026-09-22 11:10'
labels:
  - adiada
milestone: m-4
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**S5-T7 — Avaliar um `--sessions` que aceite lista.** Ideia do mantenedor em 2026-08-30,
ao fechar a Q-030, **com a ressalva dele de que não é para agora** — registrada aqui para
não se perder, não como tarefa aceita.
*Contexto:* a S3-T5 fez `--session` **recusar** valor ambíguo em vez de resolver várias
sessões de uma vez. Isso não removeu capacidade nenhuma: capturar todas as sessões de um
`cwd` nunca foi objetivo, era efeito colateral de comparar caminho por igualdade de string
numa flag cuja ajuda diz "limit to a single session".
*Se um dia entrar:* uma flag **separada e explícita** para várias, nunca reinterpretando a
singular. O `--session` recusando ambiguidade é o que impede escolha errada no comando que
também pode encerrar processo (D-002); relaxar aquilo para acomodar o caso plural traria o
problema de volta pela porta dos fundos.
*Critério para existir:* necessidade real de uso, não simetria de API. Se ninguém sentir
falta, esta entrada some sem custo — que é o melhor destino possível para ela.
<!-- SECTION:DESCRIPTION:END -->
