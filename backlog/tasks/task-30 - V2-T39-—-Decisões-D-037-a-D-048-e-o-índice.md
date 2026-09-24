---
id: TASK-30
title: V2-T39 — Decisões D-037 a D-048 e o índice
status: Review
assignee: []
created_date: '2026-09-23 10:37'
updated_date: '2026-09-24 10:45'
labels:
  - decisoes
  - d-048
dependencies:
  - TASK-29
references:
  - docs/DECISOES.md
type: chore
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T39 — Migrar e revisitar as decisões D-037 a D-048, e escrever o índice**
Especificada pelo PO em 2026-09-23, a partir de uma decisão do mantenedor no mesmo dia: migrar as 48
decisões para `backlog/decisions/`, **adaptando cada uma ao formato Contexto / Decisão /
Consequências** — e aproveitar a passagem para **revisitar** o que foi decidido. Palavras dele: *"é
um exercício custoso mas acho que vale muito a pena"*.

**Esta tarefa cobre D-037 a D-048, e o índice em docs/DECISOES.md.** As outras faixas são tarefas irmãs; não avance para fora da sua.

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
Migrated D-037 through D-048 to backlog/decisions/ (decision-37 .. decision-48), one file per
decision, created via `backlog decision create "D-0NN — <title>" -s accepted --plain` and
reorganized into Contexto/Decisão/Consequências. All 12 stayed `accepted` -- none of this range is
superseded in full.

Titles shortened to fit the 72-char guard (all originals ran 65-109 chars): D-037 "Um mundo, um
seeya: enxerga as sessões de onde foi instalado" (68); D-038 "Todo processo do seeya é invisível,
salvo a sessão pedida" (65); D-039 "O seeya é secretário: agrega, organiza, sintetiza — nunca
decide" (72, exact limit); D-040 "O produto se chama seeya; no npm, escopo @seeya-ai" (58); D-041
kept its original wording (70, already fit); D-042 "A interface embute o terminal; não orquestra o
do sistema" (65); D-043 "Um repositório, três pacotes; duas raízes de composição" (63); D-044 kept
its original wording (62, already fit); D-045 "Na v2 o app é dono do daemon/autostart; a CLI vira
cliente" (66); D-046 "Encerramento muito vencido vira pendência, não roda sozinho" (67); D-047
"Uma sessão escreve o projeto por vez, garantido por código" (66); D-048 "As tarefas saem do plano
único e vão para o Backlog.md" (62). Every shortened title's full original wording is preserved
verbatim as the first line of its Contexto, same precedent V2-T37/V2-T38 set.

What needed extra structure beyond Contexto/Decisão/Consequências:
- D-039 got an extra "O nome já se resolveu sozinho" section for the closing naming footnote
  (see-you-tomorrow-ai vs seeya) -- a distinct, self-contained concern from the secretary metaphor
  itself.
- D-043 got an extra "Por que engine, e não core" section for the maintainer's own rationale on
  the package rename -- kept as its own section rather than folded into Consequências, since it
  explains a naming choice, not an effect of the decision.
- D-045 got an extra "Emendada" section pointing to D-047: item 4's adoption mechanism (left as an
  open spike question in D-045) is closed by D-047 item 6 (copy-based adoption, original kept
  intact as a restore point); the same section also notes, accurately, that D-047's own text
  states item 1 (daemon ownership) is explicitly UNCHANGED -- this task's instructions grouped
  "adoção em cópia e a posse do daemon" as the two things D-047 addresses regarding D-045, and
  both are represented, without inventing a correction to ownership that the source text does not
  make.
- D-046 already had its "Emendada" pointer coming FROM D-036 (added by the V2-T38 agent in
  advance, per that task's own instruction to keep both sides pointing at each other) -- D-046's
  own Contexto states "Emenda a D-036" and Decisão item 1 repeats D-036's own three-case rule, so
  the two files already cross-reference correctly; no further edit was needed on either side.
- D-037, D-038, D-040, D-041, D-042, D-044, D-047, D-048 fit Contexto/Decisão/Consequências with no
  extra section.

Kept as-is on purpose (reorganizing is not rewriting): every measurement, quote and raw finding --
D-037's WSL `~/.claude/projects` finding and the three-bullet "por que não fazer a ponte"
reasoning; D-038's S4-T6 measurement (nine spawns, two already hidden, four producing a console
window per live session every 30s); D-039's two "dores" verbatim quotes and the "meu objetivo
sempre vai ser qualidade de vida" quote; D-040's npm-organization-collision finding ("`seeya-ai`
foi criada... porque o nome colide com o pacote existente"); D-043's package table and the
engine-vs-core naming rationale; D-045's four numbered items and every direct quote; D-046's
10:43/10:00 anecdote and the three-case rule; D-047's three-question narrative and the six-item
rule, including the git-add-A bug-fix aside; D-048's exact character counts (204-char file name,
Filename too long) and the three fixed decision-status definitions.

The index: `docs/DECISOES.md` (1705 lines) was replaced with a one-screen index -- one paragraph
on where decisions live now (backlog/decisions/, D-048) and how to browse them (`backlog decision
list` / `backlog browser`), the three status definitions, and a 48-row table (identifier, title,
file path), with a short status note in the title cell for D-020 (emendada pela D-043), D-023
(superseded pela D-029), D-036 (emendada pela D-046) and D-045 (emendada pela D-047). No decision
content in the index itself, per the task's own instruction. The file's path is unchanged, so
project citations of `docs/DECISOES.md` keep resolving.

Ran `npm run -s format:check` (clean -- both docs/ and backlog/ are in .prettierignore by design,
so this mainly confirms nothing else drifted) and `npx vitest run
tests/integration/guards/backlog-names.test.ts` (4/4 passed, including the new D-037..D-048 files
and the rebuilt index -- the guard only checks backlog/, not docs/). `git status --short` before
each commit confirmed only the intended paths changed. Did not touch AGENTS.md. Did not run the
full `npm run verificar`: no file under packages/ changed. Four commits on branch
`tarefa/V2-T39-decisoes-037-048`, branched from origin/main -- three levas of the twelve decisions
(D-037-040, D-041-044, D-045-048) plus the index commit, as asked.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: agente
created: 2026-09-23 22:36
---
Achados da migração D-037 a D-048 (V2-T39) -- nada foi alterado nas decisões por causa deles; cada um espera decisão do mantenedor.

1. D-037 -- o código/documentação já não segue: a decisão promete "uma linha no README (Sprint 5) dizendo que ele enxerga as sessões do mundo onde foi instalado, e que quem usa os dois instala nos dois". `README.md` não tem essa linha -- não há menção a "instalado"/"mundo" nesse sentido nem à ausência de ponte entre Windows e WSL; as únicas menções a Linux/Windows no README são sobre CI, instalador e PATH (V2-T8), não sobre o escopo por-mundo da D-037.

2. D-044 -- lacuna/deriva depois da D-048: `paths-ignore` em `.github/workflows/ci.yml` e `codeql.yml` é `['docs/**', 'AGENTS.md']` (linhas ~27-29 e ~35-37), sem `backlog/**`. A D-048 (2026-09-22) moveu tarefas e decisões de `docs/PLANO-DE-ENTREGA.md`/`docs/DECISOES.md` para `backlog/tasks/` e `backlog/decisions/` -- e nada do portão lê esses arquivos (confirmado: nenhuma referência a `backlog/` em configuração de dependency-cruiser, eslint ou vitest fora do próprio guard de nomes, que é um teste de `fs` trivial). O raciocínio medido que justificou a D-044 ("nada do portão lê esses caminhos") se aplica igualmente a `backlog/**` hoje, mas o `paths-ignore` nunca foi atualizado -- um commit só de decisões/tarefas, como os desta própria tarefa, ainda dispara os três sistemas por completo.

3. D-048 -- a própria migração desta tarefa torna uma frase sua desatualizada: a última linha do corpo de D-048 diz "`docs/DECISOES.md` continua sendo o registro das decisões (o Backlog.md tem pasta própria para isso, mas o código inteiro cita `D-0XX` a partir daqui)". Com o índice que esta tarefa publica (instrução explícita da V2-T39), `docs/DECISOES.md` deixa de ser o registro e passa a ser só um índice que aponta para `backlog/decisions/`. O texto de D-048 foi mantido verbatim (reorganizar não é reescrever, e a correção não se resolve aqui) -- fica como achado para o mantenedor decidir se emenda D-048 com uma nota.

Decisões conferidas contra o código e sem achado: D-038 (guard de `spawn` de `node:child_process` em `eslint.config.js`, com `daemon-launch.ts` como exceção declarada, exatamente como a decisão previu), D-039 (nenhum agrupamento por projeto no briefing ainda -- consistente com "aprovado como direção e ainda não agendado", sem drift), D-040 (escopo `@seeya-ai` em todo `package.json` dos três pacotes), D-042 (`@xterm/xterm` e `@xterm/addon-fit` em `packages/app/package.json`, sem Tauri), D-043 (três pacotes `@seeya-ai/engine`/`@seeya-ai/cli`/`@seeya-ai/app`, ponteiro para D-020 já bidirecional), D-045 (glossário de AGENTS.md documenta os quatro itens como implementados: `resolveDaemonOwner`, `AppInstallation`, a recusa da CLI, o autostart com `env`), D-046 (regra ainda não implementada em código, mas a própria decisão registra isso como trabalho absorvido pela tarefa de `checkpoint`/`pause`, sem tarefa própria -- não é achado novo), D-047 (o lock existe em `packages/engine/src/adapters/workspace/project-lock.ts`/`core/project-lock.ts`; os ganchos de git/harness e a auditoria do item 5 ainda não existem em código, mas já têm tarefas próprias no backlog -- `task-22`/V2-T34, `task-31`/V2-T40, `task-31.1`/V2-T41 -- então não é lacuna sem dono).
---

author: PO
created: 2026-09-24 10:45
---
Achado 1 da revisão (D-030 x core/project-skeleton.ts) resolvido pelo mantenedor em 2026-09-24: o esqueleto está errado, gera só AGENTS.md — sem CLAUDE.md e sem condicionar ao defaultHarness. Motivo medido: a versão atual do Claude Code já lê AGENTS.md direto. Virou a task-34 (V2-T44). A D-030 continua como está.
---
<!-- COMMENTS:END -->
