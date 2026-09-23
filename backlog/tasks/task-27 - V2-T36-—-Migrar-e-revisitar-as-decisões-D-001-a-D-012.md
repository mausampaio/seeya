---
id: TASK-27
title: V2-T36 — Migrar e revisitar as decisões D-001 a D-012
status: Review
assignee: []
created_date: '2026-09-23 10:37'
updated_date: '2026-09-23 10:56'
labels:
  - decisoes
  - d-048
dependencies: []
references:
  - docs/DECISOES.md
type: chore
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T36 — Migrar e revisitar as decisões D-001 a D-012**
Especificada pelo PO em 2026-09-23, a partir de uma decisão do mantenedor no mesmo dia: migrar as 48
decisões para `backlog/decisions/`, **adaptando cada uma ao formato Contexto / Decisão /
Consequências** — e aproveitar a passagem para **revisitar** o que foi decidido. Palavras dele: *"é
um exercício custoso mas acho que vale muito a pena"*.

**Esta tarefa cobre D-001 a D-012.** As outras faixas são tarefas irmãs; não avance para fora da sua.

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
Migrated D-001 through D-012 to backlog/decisions/ (decision-1 .. decision-12), one file per
decision, created via `backlog decision create "D-0NN — <título>" -s accepted --plain` and then
reorganized into Contexto/Decisão/Consequências. All accepted -- none of the twelve is superseded
in full, so no status other than `accepted` was used.

What changed shape:
- D-001, D-011, D-012 already had Contexto in the original text; that stayed Contexto.
- D-002, D-004, D-005, D-006, D-007, D-009, D-010 had no separate Contexto in the original text;
  their Contexto section is empty rather than invented.
- D-003's "Decisão de falha" paragraph stayed inside Decisão (it continues the same decision, not
  a separate concern).
- D-008's revocation note ("a parte de idioma foi revogada por D-028...") became its Contexto,
  since it explains what of the original decision still applies before the Decisão/Consequências
  text (left untouched, including the still-Portuguese identifier examples, since it is historical
  record).
- D-011 needed two extra sections beyond the three: the 2026-08-29 correction with the
  tools/json-schema cost table stayed inside Consequências (it corrects a consequence in place);
  the 2026-08-31 "REAVALIAÇÃO sob a D-031" block became its own extra section
  ("## Reavaliação (2026-08-31, sob a D-031)") because it revises the reasoning for the whole
  decision, not just one consequence.

Kept as-is on purpose (reorganizing is not rewriting): every measurement, dollar figure, table,
raw finding and maintainer quote; D-005's full detached-daemon elaboration (Spike G, the
Ctrl+Break aside, the "custo assumido" note); D-011's cost table and REAVALIAÇÃO block verbatim;
D-001's CORREÇÃO blockquote about the messaging socket, including its own forward references to
D-017 and D-031.

Six findings went to a task comment (not applied to any decision file) -- see comment #1: D-001's
Decisão text describes the fork-based mechanism as universal, but since D-011 (lean/deep) it only
holds for the opt-in deep mode; D-004 never absorbed the resumedWithoutPlan/V2-T7 third outcome;
D-005 was amended by D-045 (daemon ownership can pass to the app) without a pointer; D-007's
"only inside ~/.seeya/" boundary was widened by D-027's workspace root without a pointer; D-009
cites the pre-D-028 Portuguese interface names (ProvedorDeSessoes/GeradorDeHandoff), gone from
code; D-010's package name was superseded in part by D-040/D-043 without a pointer.

Ran `npm run -s format:check` (clean) and `backlog decision list --plain` (all 12 listed,
accepted). Did not touch packages/, so did not run the full `npm run verificar`. Did not touch
docs/DECISOES.md or AGENTS.md.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: agente
created: 2026-09-23 10:55
---
Achados da migração D-001 a D-012 (V2-T36) — nada foi alterado nas decisões por causa deles; cada um espera decisão do mantenedor.

1. D-001 vs D-011: a Decisão de D-001 descreve o mecanismo de geração do handoff como sendo sempre `claude -p --resume <sessionId> --fork-session`. Desde a D-011 (lean/deep), isso só é verdade para o modo profundo (`deepCapture: true`); o modo padrão (lean, desde a D-011) abre uma sessão nova e descartável, sem `--resume` nem `--fork-session`. Evidência: packages/engine/src/adapters/generation/args.ts (`buildLeanArgs` usa `--no-session-persistence`; `buildDeepArgs` é quem usa `--resume`/`--fork-session`, com o comentário "Deep (opt-in, D-011): resumes the live session's full transcript into a fork, per D-001/D-012"). A consequência "`--fork-session` é obrigatório" de D-001 também só vale para o modo profundo.

2. D-004 — lacuna: D-004 só descreve dois desfechos de retomada (retomar a sessão original / abrir sessão nova com aviso de fallback). Hoje existe um terceiro caminho, `resumedWithoutPlan` (motivo `promptTooLarge`), que nunca virou emenda formal a D-004 — só está documentado no glossário da AGENTS.md sob "retomar sem o plano (V2-T7)", sem número de decisão D-0XX. Evidência: packages/engine/src/core/types.ts, `ResumeOutcome` (linhas ~677-691, união `resumed`/`resumedWithoutPlan`/`freshSession`).

3. D-005 — emendada por D-046/D-045 e nunca anotada: D-045 (item 1) tira da CLI a posse do daemon quando o app está instalado ("a CLI vira cliente"; `seeya daemon`/`autostart enable` recusam e apontam para o app). D-005 ("Daemon próprio para o agendamento") descreve o daemon como propriedade simples do `seeya daemon`, sem essa ressalva. Evidência: docs/DECISOES.md D-045 item 1; packages/cli/src/daemon-command.ts#runDaemonLauncher (recusa quando `DaemonOwner.kind === 'app'`).

4. D-007 — ampliada por D-027 e nunca anotada: D-007 diz que config/estado/handoffs/histórico "ficam em `~/.seeya/`". A D-027 criou uma segunda raiz de escrita, o espaço de trabalho (`workspace`), cujo root por padrão fica dentro de `~/.seeya/` mas cujo próprio código documenta que não pode ser assumido ali. Evidência: packages/engine/src/core/ports.ts, comentário de `WorkspaceRepository` ("its own root path happens to default INSIDE `~/.seeya/` ... but is not assumed to be there by anything in this port"). A regra "Escrever apenas dentro de `~/.seeya/`" em AGENTS.md § "Sistema de arquivos" também não menciona essa segunda raiz.

5. D-009 — nomes desatualizados: o texto cita as interfaces `ProvedorDeSessoes` e `GeradorDeHandoff` (nomes em português, de antes da D-028). Hoje essas portas se chamam `SessionProvider` e `HandoffGenerator` em todo o código. Evidência: packages/engine/src/core/ports.ts linha 120 (`SessionProvider`) e linha 680 (`HandoffGenerator`); grep por `ProvedorDeSessoes`/`GeradorDeHandoff` só encontra docs/DECISOES.md e docs/QUESTOES.md — nenhuma ocorrência em código.

6. D-010 — superada em parte pela D-040/D-043 e nunca anotada: D-010 diz "o pacote é `see-you-tomorrow`". A D-040 renomeou o produto/pacote para o escopo `@seeya-ai`, e a D-043 dividiu em três pacotes (`@seeya-ai/engine`, `@seeya-ai/cli`, `@seeya-ai/app`). O binário continua `seeya` (essa parte de D-010 segue valendo), mas o nome do pacote está obsoleto. Evidência: packages/cli/package.json ("name": "@seeya-ai/cli"); docs/DECISOES.md D-040 e D-043.

Decisões conferidas contra o código e sem achado: D-002 (opt-in de encerramento, sem kill forçado em sessão — `terminateAbruptly` existe só para o próprio daemon), D-003 (fallback para `source: "deterministic"` ainda existe em generation-policy.ts), D-006 (SNOOZE_INCREMENTS ainda +15m/+30m/+1h, sem teto, em application/schedule-adjustments.ts), D-008 (Node >=22 em todos os package.json), D-012 (forks.json e forkCleanupDays default 7 ainda em vigor em adapters/discovery/fork-registry.ts e config-schema.ts).
---
<!-- COMMENTS:END -->
