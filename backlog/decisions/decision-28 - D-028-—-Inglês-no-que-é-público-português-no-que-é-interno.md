---
id: decision-28
title: 'D-028 — Inglês no que é público, português no que é interno'
date: '2026-09-24 00:25'
status: accepted
---
## Contexto

**Revoga a parte de idioma de D-008**, que mandava tudo em português.

O projeto é de código aberto por intenção. Identificador em português é o sinal mais visível de
"isto não é para você" que um leitor de fora encontra — antes de qualquer documento. Mas a
documentação interna é o ativo mais incomum daqui, e ela é rica **porque escrever é barato para o
mantenedor**. Traduzi-la cobraria duas vezes: as ~22 mil palavras agora, e cada decisão futura
escrita mais devagar, para sempre, num projeto que não é o trabalho principal de ninguém.

Medido antes de decidir: `src/` tem **923 linhas**, `tests/` 2.892, documentação 2.816 linhas. O
código é barato de migrar hoje e caro depois do Sprint 2.

## Decisão

| | Idioma |
|---|---|
| Identificadores e comentários de código | **inglês** |
| README | **inglês** |
| Comandos e saída do CLI | **inglês** |
| Mensagens de commit, daqui em diante | **inglês** |
| `docs/` — decisões, spec, arquitetura, plano, spikes, questões | **português** |
| Conversa entre PO e agentes | **português** |

As 114 mensagens de commit anteriores **ficam em português**. São registro histórico; a emenda
marca quando a decisão foi tomada, e reescrever seria churn sem retorno.

**O risco desta divisão é deriva de termo** — `elegibilidade` no documento, `eligibility` no
código, e daqui a três meses alguém inventa `eligible` num terceiro lugar. A mitigação é o
**glossário de domínio em `AGENTS.md` § Idioma**, que fixa a tradução de cada termo. Termo novo
entra no glossário **antes** de entrar no código.

## Consequências

**Consequência para o CLI, e uma dívida assumida.** O CLI nasce em inglês, e isso deixa o
mantenedor digitando comandos num idioma que não é o dele. A saída é configuração de idioma,
registrada como trabalho futuro em `docs/FORA-DE-ESCOPO.md`. Para que ela seja **extração e não
arqueologia**, vale desde já: **texto voltado ao usuário fica concentrado, nunca espalhado em
`console.log` pelo meio da lógica.** Essa é a única parte da i18n que custa caro se for deixada
para depois.
