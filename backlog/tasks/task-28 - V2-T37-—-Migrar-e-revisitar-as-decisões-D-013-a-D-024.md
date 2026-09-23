---
id: TASK-28
title: V2-T37 — Migrar e revisitar as decisões D-013 a D-024
status: To Do
assignee: []
created_date: '2026-09-23 10:37'
labels:
  - decisoes
  - d-048
dependencies:
  - TASK-27
references:
  - docs/DECISOES.md
type: chore
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T37 — Migrar e revisitar as decisões D-013 a D-024**
Especificada pelo PO em 2026-09-23, a partir de uma decisão do mantenedor no mesmo dia: migrar as 48
decisões para `backlog/decisions/`, **adaptando cada uma ao formato Contexto / Decisão /
Consequências** — e aproveitar a passagem para **revisitar** o que foi decidido. Palavras dele: *"é
um exercício custoso mas acho que vale muito a pena"*.

**Esta tarefa cobre D-013 a D-024.** As outras faixas são tarefas irmãs; não avance para fora da sua.

**O que entra:**

1. **Uma decisão por arquivo** em `backlog/decisions/`, criada pela CLI do Backlog.md
   (`backlog decision create "D-0NN — <título>" -s accepted`), com o corpo reorganizado em
   **Contexto**, **Decisão** e **Consequências**. Seções extras são permitidas quando o texto
   original tiver algo que não cabe nas três (uma medição longa, uma tabela) — nunca jogue fora.
2. **O identificador não muda.** `D-0NN` continua no título, porque é por ele que 1.309 comentários
   de código e todos os documentos citam a decisão. Nada de renumerar.
3. **Reorganizar não é reescrever.** O sentido é preservado; o texto pode ser cortado em seções e
   ter a ordem mudada, e frases de ligação podem ser ajustadas. **Medição, número, saída bruta e
   citação do mantenedor são copiados como estão.** Na dúvida entre encurtar e manter, mantenha.
4. **O que você encontrar de errado NÃO se conserta aqui.** Esta é a parte mais importante da
   tarefa: ao ler cada decisão, compare com o que o projeto virou e **liste** — em comentário na
   tarefa (`backlog task edit <id> --comment "..."`), uma entrada por achado:
   - decisão **superada** por outra mais nova (ex.: a D-036 foi emendada pela D-046);
   - decisão que o **código já não segue**, com o arquivo onde isso aparece;
   - decisão **ambígua** ou que nunca disse o que fazer num caso que hoje existe;
   - **lacuna**: algo que virou regra na prática e nunca foi decidido.
   Cada achado com o identificador, uma frase do que está em questão, e a evidência (arquivo, linha,
   ou a decisão que a supera). **Não altere o conteúdo da decisão por causa de um achado** — quem
   decide é o mantenedor, e a emenda vira decisão nova, como a D-046 fez com a D-036.

**O que não entra:** mexer em `docs/DECISOES.md` (o índice é feito no fim, pela última faixa);
mudar `AGENTS.md` ou a ordem de autoridade; corrigir código por causa de um achado.

**Cuidados:** nenhuma dependência nova; nada fora de `backlog/decisions/` e da sua própria tarefa;
o guard de termos locais roda no commit — as decisões têm caminhos e nomes que já estão anonimizados,
mantenha assim; commits pequenos (uma leva de decisões por commit) e em inglês.

**Aceite do PO:** ler os arquivos da faixa e a lista de achados, e levar ao mantenedor um achado por
vez.
<!-- SECTION:DESCRIPTION:END -->
