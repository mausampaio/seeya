---
id: TASK-28
title: V2-T37 — Decisões D-013 a D-024
status: Review
assignee: []
created_date: '2026-09-23 10:37'
updated_date: '2026-09-24 10:56'
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

5. **Os três status, e só eles** (fixado pelo PO em 2026-09-23, D-048): `accepted` para toda decisão
   vigente — é o caso das 48; `superseded` só para a que foi substituída **por inteiro** por outra
   mais nova, com o ponteiro no corpo; `proposed` para decisão escrita e ainda não confirmada pelo
   mantenedor (não é o caso de nenhuma aqui). **"Emendada" não é status:** quando uma decisão nova
   muda um pedaço de outra (a D-046 fez isso com a D-036; a D-043 com a D-020), a antiga continua
   `accepted` e ganha uma linha no corpo dizendo o que foi emendado e por quem — marcar
   `superseded` jogaria fora a parte que continua valendo.

**O que não entra:** mexer em `docs/DECISOES.md` (o índice é feito no fim, pela última faixa);
mudar `AGENTS.md` ou a ordem de autoridade; corrigir código por causa de um achado.

**Cuidados:** nenhuma dependência nova; nada fora de `backlog/decisions/` e da sua própria tarefa;
o guard de termos locais roda no commit — as decisões têm caminhos e nomes que já estão anonimizados,
mantenha assim; commits pequenos (uma leva de decisões por commit) e em inglês.

**Aceite do PO:** ler os arquivos da faixa e a lista de achados, e levar ao mantenedor um achado por
vez.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrated D-013 through D-024 to backlog/decisions/ (decision-13 .. decision-24), one file per
decision, created via `backlog decision create "D-0NN — <título>" -s <status> --plain` and
reorganized into Contexto/Decisão/Consequências. 11 of 12 stayed `accepted`; D-023 became
`superseded` because docs/DECISOES.md already marked it "REVOGADA por D-029 em 2026-08-19" --
a full revocation, not a partial amendment, so it fits the task's own rule 5 exactly.

Titles shortened to fit the 72-char guard where the original heading was longer: D-022 kept its
full original wording (69 chars, fit); D-023 and D-024 needed shortening (originals were 76 and
~89 chars) -- the shortened titles keep the same subject and the full original wording is
preserved verbatim inside each file's body. D-017 and D-019 had backticks around code terms in
the original heading (`seeya`, `claude`) which were dropped in the title, matching the precedent
V2-T36 set for D-010.

What needed extra structure beyond Contexto/Decisão/Consequências:
- D-014, D-018 had no separate Contexto in the original text (only Decisão and Consequências);
  left Contexto empty rather than inventing one, same precedent as V2-T36.
- D-015 kept its "CORREÇÃO (2026-08-30)" blockquote and the trailing test note inside
  Consequências, verbatim -- it corrects/refines the same decision in place, not a separate
  concern.
- D-019 needed an extra section ("## Limitação conhecida e aceita") for the guard's measured
  false-negative list (four constructs that escape the lint rule) -- it's a distinct concern from
  the plain consequences, same shape as V2-T36's D-011 extra sections.
- D-020 got an extra "## Emendada" section noting D-043 widened "cli/ is the only composition
  root" to "cli/ and app/ are the two composition roots" (V2-T1, monorepo) -- text of the amended
  decision left untouched, only the pointer was added, per the task's own D-020/D-043 example.
- D-023 kept its "REVOGADA por D-029" blockquote at the top (as in the original document) and its
  own Contexto/Decisão/Consequências; the "Medição feita antes de revogar" table that follows the
  revocation in docs/DECISOES.md actually belongs to D-029's own section (line 809 onward), not
  D-023's (line 507-556) -- copying it into decision-23 was a mistake I made and corrected before
  the final commit, replacing it with a one-line pointer to D-029 (out of this task's range).

Kept as-is on purpose (reorganizing is not rewriting): every measurement, table, raw finding
and maintainer-observed data -- D-015's Spike C/S3-T2/Spike H correction verbatim including the
"byte a byte idêntico" measurement and the ~19 KB / 32.767-character figures; D-019's guard
false-negative list and the four escaping constructs; D-022's `agentsJsonOutputSchema`
Linux-rejection finding and the exact CLAUDE.md quote; D-023's PID/`.json`/`.key` table and the
`.key`-was-discarded-as-orphan-residue finding.

Ran `npm run -s format:check` (clean, no diffs from `npx prettier --write backlog/decisions`) and
`npx vitest run tests/integration/guards/backlog-names.test.ts` (4/4 passed). `git status --short`
confirms only `backlog/decisions/` changed, so the full `npm run verificar` was not run (per the
task's own gate instructions: only needed when touching anything outside `backlog/`). Did not
touch docs/DECISOES.md or AGENTS.md. Three commits, one per leva (D-013-016, D-017-020,
D-021-024), on branch `tarefa/V2-T37-decisoes-013-024`.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: agente
created: 2026-09-24 00:16
---
Achados da migração D-013 a D-024 (V2-T37) -- nada foi alterado nas decisões por causa deles; cada um espera decisão do mantenedor.

1. D-014 -- lacuna/gap: D-014 descreve o wrapper PTY v2 como "seeya claude", que sobe o Claude num PTY para "pedir o handoff à própria sessão" ("O wrapper pede o handoff em arquivo, nunca lê a tela"). O que a v2 efetivamente construiu (packages/app/src/pty/, tabs embutidas) é um terminal embutido para lançar e retomar sessões interativas na interface -- não existe nenhum mecanismo de injetar texto na sessão viva pedindo handoff em arquivo. Evidência: packages/app/src/pty/pty-manager.ts (`write(tabId, data)` é passthrough de teclado, não pedido de handoff); grep por "requestHandoff"/"handoffRequest" no repositório inteiro não encontra nada. D-001 (emendada por D-031, achado #1 da V2-T36) já fechou a via de "falar com a sessão viva" por outro motivo (custo de contexto, não impossibilidade) -- o pedaço de D-014 que descreve texto injetado ficou orfão, nunca formalmente revisto.

2. D-023 -- superada por inteiro pela D-029 (2026-08-19), e já estava marcada assim no próprio docs/DECISOES.md ("REVOGADA por D-029"). Migrada aqui com status `superseded` e ponteiro para D-029 no corpo, conforme regra do item 5 da tarefa. D-029 fica fora desta faixa (entra em D-025-036, V2-T38) -- o texto de "Medição feita antes de revogar" e a decisão de substituir a terceira estratégia por aviso pertencem a D-029, não a D-023; removi esse trecho de decision-23 depois de o ter copiado por engano na primeira passada (corrigido antes do commit final).

3. D-020 -- emendada pela D-043 (V2-T1, monorepo): "cli/ é a única raiz de composição" virou "cli/ e app/ são as duas raízes de composição" (AGENTS.md, seção Arquitetura, e docs/DECISOES.md D-043). Registrei a emenda como uma seção extra ("## Emendada") no corpo de decision-20, sem tocar no texto original da decisão -- igual ao padrão que a V2-T36 já usou para casos assim.

Decisões conferidas contra o código e sem achado (D-013, D-015 a D-019, D-021, D-022, D-024): os mecanismos, nomes de campo e schemas descritos continuam batendo com o código atual -- D-013 (fontes git/transcript/registro em application/evidence-gathering.ts e core/evidence.ts), D-015 (a correção de 2026-08-30 já embutida no próprio texto original, sem novidade), D-016 (duas estratégias em adapters/discovery/index.ts), D-017 (lista de variáveis removidas idêntica em packages/engine/src/adapters/generation/env.ts:19-24), D-018 (aviso de sessão suprimida em core/early-warnings.ts), D-019 (guard de Date em vigor, com o mesmo teste de caso permitido/proibido), D-021 (grupos obrigatório/opcional idênticos em adapters/discovery/schemas.ts:72-79), D-022 (validação item a item ainda em vigor, comentário cita D-022 explicitamente em schemas.ts:141), D-024 (união discriminada SessionWithPid/SessionWithoutPid ainda em core/types.ts).
---

author: PO
created: 2026-09-24 10:56
---
Achado 1 da revisão (D-014, wrapper PTY) resolvido pelo mantenedor em 2026-09-24: emendar a decisão no lugar, sem número novo. A D-014 ganhou Contexto e uma seção de emenda dizendo o que se realizou (PTY = abas da janela; descoberta segue como única fonte; dedupe por pid na interface), o que foi abandonado (pedir handoff à sessão viva, pelo mesmo motivo da D-001/D-031) e o que ocupou o lugar da necessidade (V2-T40/T41). Corrigidos os dois textos que ainda apontavam para a promessa antiga: docs/FORA-DE-ESCOPO.md e docs/ARQUITETURA.md.
---
<!-- COMMENTS:END -->
