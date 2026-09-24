---
id: decision-20
title: D-020 — cli/ é a única raiz de composição
date: '2026-09-24 00:11'
status: accepted
---
## Contexto

`docs/ARQUITETURA.md` diz que todo acesso ao mundo passa por uma porta de `nucleo/portas.ts`,
mas as regras de camada não impediam `application/` de importar `adapters/` direto. Verificado
na prática: `application` importando `adapters/git` passa sem reclamação. Isso deixaria um caso
de uso instanciar adapter concreto e furar as portas — e levaria junto a garantia de que teste
unitário não toca disco.

## Decisão

Só `cli/` pode nomear adapter concreto. É ele que constrói as implementações e as injeta em
`application/` e em `scheduler/`.

| De → Para | |
|---|---|
| `application` → `adapters` | **proibido** — dependa da porta em `core/` |
| `scheduler` → `adapters` | **proibido** — recebe injetado do `cli` |
| `cli` → `adapters` | permitido — é a raiz de composição |
| `cli` → `scheduler`, `cli` → `application` | permitido |
| `scheduler` → `application` | permitido |

## Consequências

- Todo caso de uso recebe suas dependências por parâmetro ou construtor. Nenhum faz `import` de
  implementação.
- É isto que torna executável a regra de `docs/TESTES.md` de que nenhum teste unitário toca
  disco: sem acesso ao adapter, não há como tocar.
- `docs/ARQUITETURA.md` ganha esta tabela; a regra de dependência lá deixa de ser só o diagrama
  de setas.

## Emendada

**Emendada pela D-043** (V2-T1): com o monorepo `@seeya-ai/engine`/`@seeya-ai/cli`/`@seeya-ai/app`,
`cli/` deixa de ser a única raiz de composição — "`cli/` e `app/` são as duas raízes de
composição", nenhuma outra. A tabela acima e a proibição para `application`/`scheduler`
continuam valendo; o que muda é que `app/` ganha os mesmos direitos de `cli/` sobre `adapters/`.
