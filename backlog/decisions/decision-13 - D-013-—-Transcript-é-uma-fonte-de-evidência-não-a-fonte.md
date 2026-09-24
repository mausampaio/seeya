---
id: decision-13
title: 'D-013 — Transcript é uma fonte de evidência, não a fonte'
date: '2026-09-24 00:08'
status: accepted
---
## Contexto

Existem sessões sem transcript utilizável, e a causa é **conhecida** desde o Spike D: o Claude
Code 2.1.233 suprime a persistência em três situações — marcador de sessão filha herdado,
`CLAUDE_CODE_SKIP_PROMPT_HISTORY` definido, e falha de escrita do transcript. Nos dois primeiros
casos o próprio produto avisa que **`--resume` não encontrará a sessão**. No terceiro, o
transcript existe mas está incompleto, sem sinal externo que o distinga de uma sessão curta.

Caso real: as sessões do agente `agente-interno` caem no primeiro caso. O estado real delas vive
numa issue e num **worktree** criado no projeto.

A decisão abaixo não depende da causa: mesmo com a supressão corrigida via
`CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1`, transcript ausente, incompleto ou ilegível continua
sendo caso a tratar — e o worktree continua sendo a fonte mais informativa desse tipo de sessão.

## Decisão

A captura coleta evidências de **várias fontes independentes**, e o transcript é apenas uma
delas. As fontes da v1, por ordem de confiabilidade:

1. **Git** — branch, commits do dia, diff não commitado, e **worktrees** do repositório, com o
   estado de cada um.
2. **Transcript**, quando existe.
3. **Registro de processos** — `cwd`, nome, horário de início.

Um handoff é útil se **qualquer** fonte responder. Sessão sem transcript mas com worktree ativo
gera handoff bom.

**Além disso:** o `seeya` detecta a ausência de transcript **assim que vê a sessão**, não no fim
do dia, e notifica na hora — quando ainda dá para reagir.

## Consequências

- `adapters/git` cresce: precisa enumerar worktrees (`git worktree list`), não só o `cwd`.
- O handoff ganha `fontes: []` declarando de onde cada informação veio.
- `source: "noTranscript"` é um estado normal, não um erro.
