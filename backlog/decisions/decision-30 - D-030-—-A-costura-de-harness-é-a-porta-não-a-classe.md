---
id: decision-30
title: 'D-030 — A costura de harness é a porta, não a classe'
date: '2026-09-24 00:26'
status: accepted
---
## Contexto

**Proposta do mantenedor, em 2026-08-30**, ao revisar a Q-027 item 1: o `seeya` hoje só funciona
com o Claude Code, mas há intenção de suportar outros harnesses, e ele pediu **ambiente agnóstico
desde já** — sem propor o suporte agora.

O título completo desta decisão é "Independência de harness: a costura é a porta, não o nome da
classe".

## Decisão

A independência de harness mora em `core/ports.ts`. Cada porta é declarada em vocabulário neutro
(`SessionProvider`, `TranscriptReader`, `HandoffGenerator`, `SessionResumer`, `ProcessControl`,
`Storage`) e cada adaptador é nomeado pelo que **de fato** amarra (`ClaudeSessionResumer`). Isso
não é acidente de nomenclatura: é onde a troca acontece.

**Por que escrever agora, sem suporte a segundo harness no horizonte.** Porque o custo de perder a
costura é assimétrico: mantê-la é de graça (já está assim), e recuperá-la depois de alguém
"generalizar" o nome do adaptador ou enfiar um ramo de harness no núcleo é caro. Esta decisão não
pede trabalho nenhum hoje — ela impede trabalho errado amanhã.

## Consequências

Três consequências, que é o que esta decisão existe para não deixar decair:

1. **Adaptador não vira genérico no nome.** Renomear `ClaudeSessionResumer` para
   `HarnessSessionResumer` tornaria o nome **menos** exato — a classe spawna `claude --resume` e
   depende de flags específicos dele. Nome de adaptador descreve a amarração, não a aspiração.

2. **Segundo harness é adaptador novo, não hierarquia.** Nada de classe-base `HarnessResumer` com
   uma subclasse. O que varia entre harnesses não é um algoritmo comum com ganchos: é se
   `--resume` existe, como sessão é identificada, se dá para reatar sessão. Dois adaptadores
   compartilhariam a assinatura da porta — que já ganham implementando-a — e quase nada além. A
   escolha de qual usar é do `cli/`, a única raiz de composição (D-020).

3. **O núcleo pode citar um harness em texto para humano; nunca em tipo, ramo de decisão ou
   caminho de arquivo.** Auditado em 2026-08-30: os únicos pontos de `src/core/` que nomeiam o
   Claude Code são `early-warnings.ts` (conselho que cita `CLAUDE_CODE_*`) e `resume-notice.ts`
   ("claude exited with code N"). Os dois são mensagem impressa, e ficam. Um `if` sobre qual
   harness é, um campo de tipo com nome de harness ou um caminho como `~/.claude` dentro de
   `core/` seriam violações — esses pertencem a `adapters/`.
