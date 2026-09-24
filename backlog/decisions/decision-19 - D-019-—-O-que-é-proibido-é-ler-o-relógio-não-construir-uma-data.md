---
id: decision-19
title: 'D-019 — O que é proibido é ler o relógio, não construir uma data'
date: '2026-09-24 00:10'
status: accepted
---
## Contexto

O guard de S0-T2 baniu o identificador `Date` inteiro fora de `adapters/relogio/`. O review
apontou, com razão, que isso vai além do que `CLAUDE.md` pedia e gera atrito real: `new
Date(stringIso)` para parsear um timestamp de transcript, de `procStart` ou de data de commit é
**transformação determinística de dado**, não leitura do "agora". Sem isso, S1-T2, S1-T4 e S2-T1
precisariam de `eslint-disable` em cascata — e guard que todo mundo desliga deixa de ser guard.

## Decisão

O que é proibido fora de `adapters/relogio/` é a **fonte não-determinística de tempo**, não o
tipo `Date`:

| Construção | Fora de `clock/` |
|---|---|
| `new Date()` sem argumento | **proibido** — use a porta `Relogio` |
| `Date.now()` | **proibido** — use a porta `Relogio` |
| `setTimeout` / `setInterval` | **proibido** |
| `new Date(valor)` com argumento | **permitido** |
| `Date.parse(valor)`, métodos de instância | **permitido** |

## Consequências

- `no-restricted-globals` não distingue aridade; a regra passa a ser `no-restricted-syntax` com
  os seletores `NewExpression[callee.name='Date'][arguments.length=0]` e
  `CallExpression[callee.object.name='Date'][callee.property.name='now']`.

## Limitação conhecida e aceita

O review mediu: o seletor casa forma sintática, não fluxo de dados, então quatro construções
escapam — `const D = Date; D.now()`, `Date['now']()`, `globalThis.Date.now()` e `new
Date(...[])`. Nenhuma delas é escrita por acidente, e as formas literais `new Date()` e
`Date.now()`, que são o risco real, são pegas. O guard cobre o descuido, não o contorno
deliberado — e isso é suficiente, porque contorno deliberado também passa por review. Não chame
estes seletores de "à prova de bala" na documentação.

- A porta `Relogio` **não** ganha método de parsing. Ela existe para responder "que horas são", e
  essa continua sendo a única pergunta não-determinística.
- Testes de guarda obrigatórios para os dois lados: `new Date()` reprovado, `new Date(iso)`
  aprovado, ambos fora de `clock/`. Sem o teste do caso permitido, a regra pode voltar a ser
  estrita demais sem ninguém notar.
