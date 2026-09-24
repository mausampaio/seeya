---
id: TASK-29
title: V2-T38 — Decisões D-025 a D-036
status: Review
assignee: []
created_date: '2026-09-23 10:37'
updated_date: '2026-09-24 17:17'
labels:
  - decisoes
  - d-048
dependencies:
  - TASK-28
references:
  - docs/DECISOES.md
type: chore
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T38 — Migrar e revisitar as decisões D-025 a D-036**
Especificada pelo PO em 2026-09-23, a partir de uma decisão do mantenedor no mesmo dia: migrar as 48
decisões para `backlog/decisions/`, **adaptando cada uma ao formato Contexto / Decisão /
Consequências** — e aproveitar a passagem para **revisitar** o que foi decidido. Palavras dele: *"é
um exercício custoso mas acho que vale muito a pena"*.

**Esta tarefa cobre D-025 a D-036.** As outras faixas são tarefas irmãs; não avance para fora da sua.

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
Migrated D-025 through D-036 to backlog/decisions/ (decision-25 .. decision-36), one file per
decision, created via `backlog decision create "D-0NN — <title>" -s accepted --plain` and
reorganized into Contexto/Decisão/Consequências. All 12 stayed `accepted` -- none of this range
is superseded in full (D-029 revokes D-023, which is in the prior range and was already marked
`superseded` there, with the pointer to D-029 already in place).

Titles shortened to fit the 72-char guard where the original heading was longer: D-030 (was 75
chars) became "A costura de harness é a porta, não a classe"; D-032 (was 84 chars, "A evidência de
git segue os arquivos tocados, e são vários repositórios") became "Evidência de git segue arquivos
tocados, por repositório"; D-033 (was 73 chars) dropped "e inglesa" to become "A moldura é
pública; o conteúdo gerado espelha a sessão"; D-036 (original ~99 chars, "...captura sim, encerra
não, e virou o dia não faz nada") became "...captura sim, encerra não" (69 chars), with the full
original heading preserved verbatim as the first line of its Contexto. The other eight titles fit
within the limit unchanged.

What needed extra structure beyond Contexto/Decisão/Consequências:
- D-027 got an extra "Regra que vale além deste caso" section for the closing principle about
  cheap-before/expensive-after naming decisions -- it generalizes beyond this one directory name,
  not a plain consequence of it.
- D-029 got an extra "Medição feita antes de revogar" section for the Windows 11 version table
  that grounds the revocation -- same shape V2-T37 used for D-015/D-023's own measurement blocks.
- D-031 (the longest and most layered of the twelve) got one extra section, "A listagem da sessão
  fechada", covering the recap-isn't-persisted measurement, the ai-title/last-prompt table, and
  the ai-title contract caveat -- a distinct concern (what the listing shows) from the scope
  decision itself. The "three decisions this revises" (D-001, D-016, D-011) and the closing "why
  this matters more than it looks" paragraph stayed inside Consequências, since they're framed as
  what the decision costs/changes elsewhere, not a separate concern.
- D-034 got an extra "Fechamento (confirmado pelo mantenedor em 2026-09-17, V2-T5b)" section for
  the later confirmation that the GUI's arrival didn't reopen the no-actions decision -- same
  precedent as D-023's revocation note and D-020's "Emendada" section.
- D-036 got an extra "Emendada" section (same pattern as V2-T37's D-020) pointing to D-046, which
  added a delay ceiling above which the daemon stops capturing on its own and raises a pending
  end-day instead -- the three-case rule in D-036's own Decisão section is untouched and still
  applies below that ceiling.
- D-025, D-026, D-028, D-030, D-032, D-033, D-035 fit Contexto/Decisão/Consequências with no extra
  section; all already had those three concerns cleanly separable in the original text (D-028's
  "Revoga a parte de idioma de D-008" note became its Contexto, same precedent V2-T36 used for
  D-008 itself).

Kept as-is on purpose (reorganizing is not rewriting): every measurement, table, raw finding and
maintainer quote -- D-025's `alive`/`idle`/`null` reasoning; D-026's `null == null` bug
description; D-029's Windows 11 binary-version table and the Spike D/Spike E cross-references;
D-031's three-population table, the Spike E quote, the ai-title/388-occurrences and
last-prompt/387-occurrences table, and the exact `aiTitle` string observed; D-032's touched-files
grouping (`35`/`12`) and the schema-version-must-not-degrade argument; D-034's Spike B
"seeya://snooze30/" trailing-slash finding; D-035's four-row config-vs-constant table and the
"a inconsistência que isto conserta foi a minha" admission; D-036's three-case rule and the "atrasar
uma ação agendada... pode ser pior do que não executar nada" quote.

Ran `npm run -s format:check` (clean) and `npx vitest run tests/integration/guards/backlog-names.test.ts`
(4/4 passed). `git status --short` before each commit confirms only `backlog/decisions/` changed,
so the full `npm run verificar` was not run (per the task's own gate: only needed when touching
anything outside `backlog/`). Did not touch docs/DECISOES.md or AGENTS.md. Four commits, one per
leva (D-025-028, D-029-031, D-032-034, D-035-036), on branch `tarefa/V2-T38-decisoes-025-036`.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: agente
created: 2026-09-24 00:33
---
Achados da migração D-025 a D-036 (V2-T38) -- nada foi alterado nas decisões por causa deles; cada um espera decisão do mantenedor.

1. D-030 -- o código já não segue: a decisão diz que `core/` só pode citar um harness em texto para humano, "nunca em tipo, ramo de decisão ou caminho de arquivo", e que o único caminho tipo `~/.claude` seria violação. Hoje `packages/engine/src/core/project-skeleton.ts#buildProjectSkeleton` (V2-T27) escreve, incondicionalmente e dentro de `core/`, um arquivo com caminho literal `CLAUDE.md` (`buildClaudeMd()`) em todo projeto criado -- mesmo quando `ProjectManifest.defaultHarness` é `null` ou seria outro harness (o próprio `buildAgentsMd` já cita "Codex, Gemini or other harness session" como possibilidades). É um caminho de arquivo nomeando um harness específico, dentro do núcleo, exatamente o que a decisão proíbe -- não uma citação em comentário, mas um artefato gerado.

2. D-035 -- lacuna/deriva: a tabela da decisão lista quatro chaves que viraram config (`MAX_GIT_ROOTS_TO_VISIT`, limite de retentativa de captura, `MAX_BRIEFING_SCAN_DAYS`, limiar de disparo obsoleto). Desde então `packages/engine/src/adapters/storage/config-schema.ts` ganhou mais três chaves citando o mesmo critério da D-035 sem nunca terem entrado na tabela dela: `leadTimeHysteresisMinutes` (S4-T7), `terminalFontFamily` e `terminalFontSize` (V2-T3) -- todas comentadas como "(D-035)" no próprio código, mas a decisão nunca foi emendada para listá-las. A tarefa pediu explicitamente para conferir isto contra o schema, e é exatamente essa a divergência: o critério continua valendo, só a tabela que o exemplifica ficou desatualizada.

3. D-031 -- código já não segue integralmente a "revisão mais interessante" que a própria decisão previu: ela dizia que reavaliar a D-011 "pode resolver [a perda do texto do assistente] por escopo -- o modelo passando a ler o que o Claude escreveu -- em vez de por remendo no prompt", e a reavaliação de fato aconteceu (registrada dentro do arquivo migrado de D-011, V2-T36) mas por um caminho diferente do que D-031 sugeriu: não foi o encolhimento do conjunto candidato (menos sessões, mais barato pagar o profundo) que motivou a mudança, foi o modo enxuto parar de descartar o texto do assistente estruturalmente. Não é contradição, mas o texto de D-031 lido isoladamente prevê um caminho que não foi o tomado -- vale uma nota cruzada se algum dia D-011 e D-031 forem revisadas juntas.

Decisões conferidas contra o código e sem achado: D-025 (`classifyState`/`isIdleByTranscript` em `core/classification.ts` ainda implementam exatamente a regra `null` → `alive`, com o comentário citando D-025 linha a linha), D-026 (`sameEvidence`/`buildEvidenceSignature` em `core/evidence.ts` ainda comparam assinatura de evidência, não transcript), D-027 (`~/.seeya/` continua o nome, sem adoção de XDG), D-028 (glossário de idioma em AGENTS.md ainda é a fonte única, sem deriva encontrada), D-029 (a estratégia de aviso por `.key` sem `.json` continua em `core/early-warnings.ts`, citando D-029 explicitamente), D-032 (`HandoffFacts.git` é `readonly RepositoryGitFacts[]`, plural, em `core/types.ts`), D-033 (`system-prompt.ts` ainda instrui "Mirror the session's predominant language in the field values"), D-034 (`Notice`/`Notifier` em `core/ports.ts` continuam só `title`/`body`, sem ação), D-036 (a regra dos três casos -- dia local diferente/atrasado dentro do mesmo dia/dentro do limiar -- não tem código contraditório encontrado; a emenda da D-046 ainda não foi implementada, mas a própria D-046 já registra isso como trabalho deferido para a tarefa que introduz `checkpoint`/`pause`/end-day global, então não é achado novo).
---

author: PO
created: 2026-09-24 17:17
---
Achado 2 da revisão (D-035, tabela de chaves desatualizada) resolvido pelo mantenedor em 2026-09-24: sem tabela nenhuma. A decisão guarda o critério, diz que vale para todo número do projeto, e aponta onde a lista viva mora (config-schema.ts#EDITABLE_CONFIG_KEYS e a tabela de identificadores em disco do AGENTS.md). Princípio dele: decisão vale do momento em que é tomada até ser revogada; listar o estado do código no dia só cria um segundo lugar para envelhecer. A lista de constantes que ficaram saiu pelo mesmo motivo.
---
<!-- COMMENTS:END -->
