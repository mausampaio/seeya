---
id: TASK-45
title: 'V2-T55 — Achar a sessão certa: id, diretório e busca'
status: To Do
assignee: []
created_date: '2026-09-25 13:35'
updated_date: '2026-09-25 13:40'
labels: []
milestone: m-2
dependencies: []
priority: medium
type: feature
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T55 — Achar a sessão certa: id explícito, agrupamento por diretório e busca.** Especificada
pelo PO em 2026-09-25 a partir do uso do mantenedor no Ubuntu, numa máquina com muitas sessões.

**O que ele viveu:** o `claude` entrega o **id** da sessão ao sair; a janela lista as sessões por
nome e diretório, **sem o id**, e com muitas sessões a lista fica confusa — a única saída era clicar
sessão por sessão até acertar. No `seeya sessions` (que mostra o id), a sessão também não aparecia:
não era defeito — ela tinha sido fechada havia mais de 12 horas, fora de `relevanceHours`.

**A distinção que falta** (conversa de 2026-09-25): "quais sessões importam hoje" (a janela de
`relevanceHours`, que serve à captura do fim do dia e a não encher a lista) é outra pergunta que
"quero **esta** sessão". Com um id explícito, a escolha já foi feita, e janela de tempo nenhuma deve
estar no caminho — a adoção é exatamente o caso de uma sessão antiga, longa e cheia do que só ela
sabe.

**O que entra:**

1. **Id explícito ignora `relevanceHours`.** Quando a referência a uma sessão é um id (inteiro ou
   prefixo), o seeya procura o transcript **direto** pelo id — no Claude Code, o nome do arquivo é o
   id — em vez de procurar só na lista das 12 horas. Vale para `seeya project adopt` e para a busca
   da janela. Prefixo que casa com mais de uma sessão: lista as candidatas e pede mais caracteres,
   nunca escolhe (D-025). A busca por nome continua na lista da janela de tempo. A procura direta
   fica em `adapters/` (é conhecimento do Claude Code) e roda **só quando pedida** — nunca no ciclo
   de 10 s.
2. **Sessões agrupadas por diretório** na lateral: em "Other sessions", uma linha por diretório, com
   a contagem de sessões.
3. **O modal do diretório:** clicar na linha abre a lista de todas as sessões daquele diretório,
   com nome, **id curto e copiável**, estado (com o rótulo da V2-T52) e última atividade (data e
   hora), mais a ação **Adopt…** — e as que vierem depois (V2-T53).
4. **Busca por id na lateral:** um campo que aceita o id ou o começo dele e vai direto à sessão,
   inclusive fora da janela de 12 horas (item 1).

**Custo (régua do `docs/DESEMPENHO.md`):** nada novo no repouso — a procura direta só roda sob
demanda. Dizer no relatório o custo de uma busca numa máquina com muitos projetos do Claude Code.

**Cuidados:** texto num lugar só (CLI↔janela); `renderer.ts`/`main.ts` não crescem (o novo em
módulos próprios); nenhuma sessão real do mantenedor retomada; nada no `~/.seeya` real.

**Aceite do mantenedor:** no Ubuntu, adotar pela CLI uma sessão fechada há mais de 12 horas, dando
só o id; na janela, achar uma sessão pelo id na busca, abrir o modal de um diretório e ver as sessões
com id, estado e data.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-25 13:40
---
Acréscimo do PO em 2026-09-25, a partir de outro uso do mantenedor no Ubuntu: a mesma sessão aparecia como '<diretório>-<código>' enquanto aberta e só como '<diretório>' depois do exit. Causa: o nome com código é o que o próprio Claude Code grava no registro de sessões vivas (nameSource derived, adapters/discovery); fechada, o registro some e o seeya deriva o nome do diretório (deriveNameFromCwd). Item 5 desta tarefa: em todo lugar que lista sessão — lateral, modal, painel Hoje — o id curto (application/session-id-display.ts, o mesmo do seeya sessions) aparece SEMPRE ao lado do nome, aberta ou fechada; é o que identifica a sessão de verdade. Guardar o nome do Claude Code visto em vida fica de fora (arquivo novo em disco para um nome que não é da pessoa); o nome dado pela pessoa é a V2-T56.
---
<!-- COMMENTS:END -->
