---
id: decision-16
title: 'D-016 — Descoberta por duas estratégias, não uma'
date: '2026-09-24 00:08'
status: accepted
---
## Contexto

O Spike D mostrou que **sessão headless (`claude -p`) deixa transcript mas não se registra** em
`~/.claude/sessions/`. Uma descoberta baseada só no registro é cega para todo agente de execução,
que é justamente o caso que mais precisa de handoff.

## Decisão

`ProvedorDeSessoes` combina duas estratégias e devolve a **união deduplicada por `sessionId`**:

1. **Registro** — `~/.claude/sessions/*.json`. Dá `pid`, liveness, `kind`, `name`. Só enxerga
   interativas.
2. **Varredura de transcripts** — `~/.claude/projects/<slug>/*.jsonl` — **um nível, não
   recursivo**; sub-agentes escrevem um nível abaixo e não são sessões (ver o comentário de
   `adapters/discovery/transcript-scan.ts`) — filtrado por mtime dentro de `relevanceHours`.
   Enxerga headless também. Não dá `pid` nem liveness.

Sessão vista pelas duas tem os dados fundidos; sessão vista só pela varredura entra com
`pid: null` e estado `unknown` — nunca é candidata a encerramento de processo (D-002).

## Consequências

- A varredura precisa ser barata: `stat` por arquivo, sem ler conteúdo, antes de qualquer parse.
- Ela vê os forks do próprio `seeya`, então a exclusão de D-012 passa a ser **crítica**, não
  higiênica.
- O `cwd` de uma sessão vinda só da varredura tem de ser reconstruído do conteúdo do transcript,
  já que o slug do diretório é irreversível com segurança.
- Esta decisão substitui a suposição, agora sabidamente errada, de que o registro seria
  suficiente.
