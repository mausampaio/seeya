---
id: decision-21
title: D-021 — Campo de exibição nunca torna uma sessão invisível
date: '2026-09-24 00:12'
status: accepted
---
## Contexto

O schema do registro de sessões nasceu exigindo `name`, `entrypoint` e `kind`. O review mediu a
consequência: um registro sem qualquer um dos três é rejeitado inteiro, e a sessão desaparece da
descoberta por registro. D-016 dá uma segunda chance pela varredura de transcripts, mas as duas
falhas se cruzam — registro rejeitado **e** transcript suprimido (D-013) — e a sessão fica
totalmente invisível. É estreito, e é exatamente a classe de bug que este projeto existe para
evitar.

## Decisão

Os campos do registro se dividem em dois grupos, com tratamento diferente:

| Grupo | Campos | No schema |
|---|---|---|
| **Identidade e liveness** | `sessionId`, `cwd`, `pid`, `procStart`, `startedAt` | obrigatórios |
| **Classificação e exibição** | `kind`, `entrypoint`, `name` | `.optional()`, com padrão no adapter |

Padrões do adapter: `name` ausente vira o nome derivado do `cwd`; `kind` e `entrypoint`
ausentes viram `"desconhecido"`.

## Consequências

- Nenhum campo cosmético pode reprovar um registro. Se dá para identificar e localizar a sessão,
  ela entra.
- Vale como princípio geral, não só para este schema: ao validar dado externo, campo que só
  serve para exibir é sempre opcional.
- Teste obrigatório em S1-T3: registro sem `name` é descoberto, com o nome derivado do `cwd`.
