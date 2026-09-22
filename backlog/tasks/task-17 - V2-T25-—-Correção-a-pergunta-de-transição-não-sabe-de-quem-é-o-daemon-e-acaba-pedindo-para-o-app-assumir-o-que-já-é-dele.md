---
id: TASK-17
title: >-
  V2-T25 — Correção: a pergunta de transição não sabe de quem é o daemon, e
  acaba pedindo para o app assumir o que já é dele
status: Review
assignee: []
created_date: '2026-09-22 11:11'
labels: []
milestone: m-1
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: bug
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T25 — Correção: a pergunta de transição não sabe de quem é o daemon, e acaba pedindo
para o app assumir o que já é dele.** Especificada pelo PO em 2026-09-20 a partir de um
achado do mantenedor no Mac, com captura — o terceiro do dia com a mesma raiz.

**O defeito, medido.** No Mac, com o app instalado e o autostart **já ligado pela própria
janela**, o mantenedor saiu da conta e entrou de novo. Ao abrir o app, apareceu o diálogo
*"seeya found a daemon or autostart already set up on this machine"* — pedindo para assumir o
daemon e o autostart que **são do próprio app**.

**Causa: a evidência é achatada antes de chegar à decisão.** `shouldOfferDaemonOwnershipTransition`
recebe dois booleanos (`cliDaemonAlive`, `cliAutostartEnabled`), e quem os monta
(`packages/app/src/composition/index.ts`) os deriva de "existe um lock vivo" e "existe
autostart registrado" — nenhum dos dois carrega **de quem**. O nome da variável afirma "cli",
o dado não sustenta isso (D-025). A V2-T13 documentou a premissa ("um lock encontrado antes
de o app rodar o próprio daemon só pode ser da CLI"), e ela é falsa justamente no caso que a
própria V2-T13 criou: o autostart do app sobe o daemon **antes** de a janela abrir.

**Mesma raiz da V2-T22**, vista de outro ângulo: lá, o app recusava a si mesmo; aqui, o app
pede para assumir a si mesmo. As duas vêm de não haver como dizer "este daemon é meu".

**O que entra:**
1. **O autostart deixa de ser um booleano.** `Autostart.status()` já devolve
   `registeredPath` — basta não jogá-lo fora: o autostart só conta como "de outro" quando o
   caminho registrado **não** é o binário do próprio app (`isCallerTheOwningApp`, que a
   V2-T22 acabou de criar, serve exatamente para esta comparação).
2. **O lock do daemon passa a dizer quem o criou.** Um campo novo em `daemon.lock` com o
   executável que subiu o daemon (nome no glossário do `AGENTS.md` **antes** do código,
   D-027; `schemaVersion` sobe e um lock sem o campo é lido como "não sei", nunca como "é de
   outro"). Sem isso não há como distinguir o daemon do app do daemon de uma CLI — e o
   formato em disco é o único lugar onde essa informação pode viver, porque quem pergunta é
   um processo diferente do que subiu.
3. **A pergunta só aparece com evidência positiva de dono diferente.** Na dúvida, não
   pergunta (D-025) — e não perguntar é seguro: se não há nada de outro para assumir, não há
   o que a pergunta resolva.
4. **Testes**: autostart apontando para o próprio app não oferece; apontando para outro
   binário oferece; lock sem o campo novo não oferece; lock de outro executável oferece.

**O que não entra:** mudar a D-045 (quem é dono continua sendo decidido pelo registro de
instalação); reabrir a pergunta para quem já respondeu.

**Cuidados:** nenhuma dependência nova; chave nova em disco entra no glossário antes do
código; nada do `~/.seeya` real, do autostart real ou do registro é tocado — tudo com dublê.

**Aceite do mantenedor:** com o app instalado e o autostart dele ligado, sair da conta,
entrar de novo e abrir o app **sem** ver a pergunta.

**Medição vizinha, do mesmo teste (2026-09-20, macOS):** o daemon **sobrevive ao logout**.
Depois de sair da conta e entrar de novo, `~/.seeya/daemon.lock` continuava com o mesmo `pid`
e o mesmo `startedAt`, e `ps -p <pid>` mostrou o processo vivo, iniciado antes do logout,
rodando `/Applications/seeya.app/Contents/MacOS/seeya`. É consequência direta de o daemon ser
lançado destacado da sessão (D-005/`spawnDetachedDaemon`) — a mesma decisão que o faz
sobreviver ao fechamento do terminal. **Duas consequências, nenhuma delas resolvida aqui:**
(a) o autostart continua **sem prova de ponta a ponta**, porque no login ele encontra a trava
viva e recua (comportamento correto, mas silencioso — o teste que fecha isso é parar o daemon
ANTES de sair da conta); (b) um daemon que roda com ninguém logado pode disparar o
encerramento do dia sem haver sessão nenhuma para capturar — **questão em aberto, para quando
o `end-day` global for desenhado**, não para esta tarefa.

**Relatório do agente (branch `tarefa/V2-T25-posse-com-evidencia`, worktree isolada).**

1. **Autostart deixou de ser booleano.** `application/daemon-ownership.ts#shouldOfferDaemonOwnershipTransition`
   agora recebe `cliAutostartRegisteredPath: string | undefined` (o `registeredPath` de
   `AutostartStatus`, só para `enabled`/`brokenPath`) e compara contra `owner.launchPath` com
   `isCallerTheOwningApp` — a mesma função da V2-T22, sem segunda comparação. `undefined`
   (nada registrado, ou consulta que falhou) não é evidência de nada.
2. **`daemon.lock` ganhou `launchedBy`** (`core/daemon-lock.ts#DaemonLockInfo`), o
   `process.execPath` do processo que subiu o daemon — capturado em `cli/index.ts`'s próprio
   ramo `worker` e passado por `runDaemonWorker` → `runDaemon` → `acquireDaemonLock` →
   `Storage.writeDaemonLock`. `schemaVersion` de `daemon.lock` subiu de 1 para 2
   (`adapters/storage/daemon-lock-schema.ts`), com migração registrada
   (`DAEMON_LOCK_SCHEMA_MIGRATIONS`, mesmo padrão da V2-T10 para `protocol-handler.json`) —
   um lock v1 é lido normalmente, só sem o campo novo. O campo é **opcional** (`launchedBy?:
   string`) e sempre lido/escrito por espalhamento condicional, nunca como chave presente com
   valor `undefined`: um lock sem o campo lê como "não sei quem lançou" (D-025), nunca "foi
   outro", e nenhum teste pré-existente precisou ser tocado (o round-trip por chave ausente
   bate exatamente com o formato de antes desta tarefa).
3. **A pergunta só aparece com evidência positiva.** `shouldOfferDaemonOwnershipTransition`
   recusa (retorna `false`) sempre que `owner.kind !== 'app'`, já foi respondida, ou nenhuma
   das duas comparações acima aponta para um binário genuinamente diferente — inclui o caso
   "lock vivo sem `launchedBy`" (não oferece, D-025) e "autostart/lock apontando para o
   próprio binário do app" (não oferece, é o bug que esta tarefa fecha).
4. **Os quatro testes da spec** estão em
   `tests/unit/application/daemon-ownership.test.ts` (describe `shouldOfferDaemonOwnershipTransition`,
   comentados "item 4, test N"): autostart no próprio binário → não oferece; autostart em
   outro binário → oferece; lock vivo sem `launchedBy` → não oferece; lock vivo com
   `launchedBy` de outro binário → oferece. Mais testes cobrindo o cenário composto (lock e
   autostart ambos do próprio app → não oferece) e a leitura antiga (`declined`/`accepted`,
   dono `cli`/`unknown`). Cobertura adicional: round-trip de `launchedBy` em
   `tests/integration/storage/daemon-lock.test.ts` (leitura v2, migração v1→v2 sem o campo,
   escrita real), e o encadeamento `acquireDaemonLock`/`runDaemon`/`runDaemonWorker` em
   `tests/unit/scheduler/lock.test.ts`, `tests/unit/scheduler/loop.test.ts` e
   `tests/unit/cli/daemon-command.test.ts`.

**Portão (`npm run verificar`, rodado em partes por causa da memória da máquina):**
`format:check`, `tsc -p tsconfig.json --noEmit`, `lint`, `build` e `dependencias` — todos
verdes. `npm run cobertura`: 2067 passando, 4 pulados, **2 falhas** — ambas em
`tests/integration/app/composition.test.ts` (`reads config.json for relevanceHours...` e
`checkDaemonOwnershipTransitionOffer resolves to a boolean without throwing`), as duas
estourando exatamente em 5000ms sob instrumentação de cobertura. É a instabilidade já
registrada pelo PO em 2026-09-20 (Q-081, nota na V2-T21): o mesmo arquivo consulta o registro
real do Windows, e a rodada do mantenedor logo depois, na `main`, já não reproduziu.
Confirmado nesta tarefa: o arquivo inteiro (15/15 testes) passa limpo sem instrumentação de
cobertura (13,8s), e a mesma dupla de testes estourou de forma idêntica em duas rodadas
completas de `npm run cobertura` seguidas — não é regressão desta tarefa, é a máquina sob
carga. Não tentei "consertar" alargando o prazo do teste nem excluindo o arquivo do portão.

**Questões abertas:** nenhuma nova — a única incerteza (que executável comparar para o lock)
já estava resolvida pela própria spec e pelo precedente de `procStart`/`nodePath` da V2-T22.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 200 arquivos, 2.069 testes
passando, 4 pulados; cobertura 96,42%/92,63%/94,97%/96,78%, **sem** o estouro de prazo que o
agente viu em `composition.test.ts` — segunda vez que ele não reproduz no portão do PO, o que
reforça o diagnóstico de carga de máquina registrado na Q-081). Revisão sem ajustes na
tarefa; **erro do PO corrigido no mesmo commit de mesclagem**: marcadores de conflito da
mesclagem da V2-T22 tinham sido publicados dentro deste documento, porque a conferência de
conflito foi encadeada junto do portão e a saída dela passou despercebida. Os dois lados
foram preservados. Fica em `[~]` até o aceite do mantenedor.
<!-- SECTION:DESCRIPTION:END -->
