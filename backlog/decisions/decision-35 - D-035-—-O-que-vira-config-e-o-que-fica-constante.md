---
id: decision-35
title: D-035 — O que vira config e o que fica constante
date: '2026-09-24 00:29'
status: accepted
---
## Contexto

**Decisão do mantenedor, em 2026-09-05**, ao revisar três números escolhidos sem medição.

O projeto vinha decidindo caso a caso, e as decisões já não combinavam. A **Q-027** manteve
`RESUME_PROMPT_ARG_LIMIT_CHARS` como constante com o argumento "é limite técnico do SO, não
preferência de produto". A **Q-025** manteve `MAX_BRIEFING_SCAN_DAYS` como constante, rotulado
"limite de E/S, não julgamento de produto" — e esse rótulo estava errado: "quantos dias procurar
para trás" é como a pessoa trabalha, não um fato do disco. Sem um critério escrito, a próxima pessoa
não teria como saber onde pôr o número dela.

## Decisão

**Constante** quando o número é determinado pelo **sistema operacional, pelo protocolo ou por um
fato técnico** — o teto de linha de comando do Windows (~32.767 unidades), quanto custa subir um
`powershell.exe` frio, o intervalo do laço do daemon. **Ninguém configura o Windows**, e um
número desses mudar significa que a medição mudou, não que a preferência mudou.

**Config** quando depende de **como esta pessoa trabalha ou do que ela topa gastar**. Aí o valor
certo é diferente por pessoa, e nenhuma medição nossa resolve — porque não é sobre o sistema, é
sobre ela.

**Vale para todo número do projeto, os que já existem e os que vierem.** Esta decisão não lista
quais chaves existem: a lista viva mora no código, em
`packages/engine/src/adapters/storage/config-schema.ts` (`EDITABLE_CONFIG_KEYS`, as mesmas chaves
que `seeya config get` e o painel de configurações mostram), e está catalogada, chave por chave,
na tabela de identificadores em disco do `AGENTS.md`. Toda chave de config cita esta decisão onde é
definida; todo número novo passa por este critério antes de escolher entre constante e config.

## Consequências

- **Cada chave de config é um identificador em disco (D-027)**, e renomeá-la depois quebra o
  `config.json` de quem usa. O critério não barateia isso — só garante que a chave existe porque é
  preferência, não por conveniência.
- **Toda chave de config nasce com o valor que o código já usava como default**, para que
  transformar constante em config nunca mude comportamento sozinho.
- **Uma constante que mudar de valor é uma medição que mudou**, e o comentário ao lado dela é o
  lugar dessa medição — não uma chave nova.

## Emenda — 2026-09-24, achado 3 da revisão da V2-T38

A versão original trazia uma tabela com as quatro chaves que viraram config naquele dia e uma lista
das constantes que ficaram. As duas envelheceram: o schema ganhou mais três chaves pelo mesmo
critério (`leadTimeHysteresisMinutes`, `terminalFontFamily`, `terminalFontSize`) sem que a tabela
acompanhasse. O mantenedor decidiu tirar as listas em vez de atualizá-las: **uma decisão vale do
momento em que é tomada até ser revogada**, e listar o estado do código naquele dia só cria um
segundo lugar para ficar desatualizado. O critério ficou; o inventário aponta para onde ele vive.
