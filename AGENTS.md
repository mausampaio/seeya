# Contrato de trabalho — seeya

> **Chegou sem contexto?** Comece pelo [`INDEX.md`](INDEX.md): ele diz qual é o seu papel e onde
> está o estado atual. Se você recebeu uma tarefa `S#-T#` num despacho, este arquivo é o seu
> contrato — continue lendo.

Leia este arquivo inteiro antes de escrever qualquer linha. Ele vale mais que a sua intuição
sobre o que seria melhor.

## O que é o projeto

CLI chamado `seeya` que descobre sessões de Claude Code na máquina, captura o estado de cada
uma no fim do dia, gera um plano para o dia seguinte e retoma as sessões no dia seguinte.

## Ordem de autoridade

1. `docs/DECISOES.md` — decisões travadas. **Você não altera este arquivo.**
2. `docs/ESPECIFICACAO.md` — o comportamento a implementar. **Você não altera este arquivo.**
3. `docs/ARQUITETURA.md` — as fronteiras. Alteração só com aprovação.
4. `docs/PLANO-DE-ENTREGA.md` — a tarefa da vez. Você marca progresso aqui.
5. `docs/TESTES.md` — o que testar em cada faixa.

Conflito entre este arquivo e um doc acima: o doc vence, e você registra a inconsistência em
`docs/QUESTOES.md`.

## Como trabalhar

- **Uma tarefa por vez**, na ordem do plano de entrega. Não agrupe, não adiante, não pule.
- Antes de começar: releia a tarefa e o trecho da spec que ela implementa.
- Ao terminar: rode `npm run verificar`, marque a tarefa como `[~]` e **pare**. Quem move para
  `[x]` é o review.
- Branch por tarefa: `tarefa/S1-T3-descoberta`. Commits pequenos, em português.
- **Commite antes de terminar a tarefa.** Duas quedas de API já pegaram agentes com trabalho só
  no disco. Trabalho não commitado é trabalho que a próxima queda leva.

## Quando parar e perguntar

Pare, escreva em `docs/QUESTOES.md` e **não decida sozinho** se:

- a spec está ambígua ou silenciosa sobre um caso que você precisa tratar agora;
- implementar a tarefa exigiria violar uma decisão de `docs/DECISOES.md`;
- você descobriu que uma premissa técnica da spec está errada (ex.: uma flag do `claude` não
  se comporta como descrito);
- a tarefa parece precisar de uma dependência nova relevante;
- você quer mudar uma fronteira de módulo.

Inventar um comportamento não especificado é o erro mais caro que você pode cometer aqui.
Perguntar custa uma mensagem.

Se a solução tiver efeito **além da sua tarefa**, abra a questão **e** siga com a solução
mínima. Não precisa parar; precisa avisar.

---

# Regras que não se negociam

## Arquitetura

- `nucleo/` é puro: não importa `node:*`, não importa nada de `adaptadores/`, `aplicacao/` ou
  `cli/`, não faz I/O, não conhece o Claude Code.
- A matriz de dependências permitidas está em `docs/ARQUITETURA.md` e é **exaustiva**: 20 pares
  ordenados, exaustiva dentro de `@seeya-ai/engine` (V2-T1, D-043). Par que não estiver nela é
  erro da matriz — vire questão, não improvise.
- **`cli/` e `app/` são as duas raízes de composição** (D-020, emendada pela D-043) — nenhuma
  outra. Só elas nomeiam adapter concreto. `cli/` só alcança `@seeya-ai/engine` pelo subcaminho
  público do pacote, nunca por caminho relativo cru dentro de `packages/engine/src`.
- Todo acesso ao mundo passa por uma porta declarada em `nucleo/portas.ts`.
- Nada específico do Claude Code fora de `adaptadores/`.

## Tempo

- `new Date()` **sem argumento**, `Date.now()`, `setTimeout` e `setInterval` só existem em
  `adaptadores/relogio`. Em qualquer outro lugar, use a porta `Relogio` (D-019).
  `new Date(valor)` **com** argumento é permitido: é transformação determinística, não leitura
  do "agora".
- Horário de encerramento é horário local ("19:30"), nunca epoch persistido.

## Dados de fora

- Nenhum `JSON.parse` sem schema zod em seguida. Vale para o registro do Claude Code, o
  transcript, a config e a saída do `claude -p`.
- **Coleção externa valida item por item, nunca em bloco** (D-022). Item ruim é registrado com o
  motivo e descartado individualmente; a operação segue. `z.array()` é tudo-ou-nada e por isso
  não serve: uma entrada estranha derrubaria a lista inteira.
- O retorno declara **os dois lados**: aceitos e rejeitados com motivo. Sem isso o comando mente
  por omissão em vez de dizer "3 sessões, 1 entrada ignorada".
- Schema é **estrito nos campos que usa e tolerante com campos desconhecidos**. Campo que só
  serve para exibir é sempre opcional (D-021).
- **Ausência de dado não vira afirmação** (D-025). Faltando dado, o resultado é o estado menos
  específico que a evidência sustenta, nunca o mais específico que ela permitiria imaginar.

## Sistema de arquivos

- Escrever **apenas** dentro de `~/.seeya/` (raiz injetável). Nunca dentro de
  `~/.claude/`, nunca dentro dos repositórios das sessões capturadas. A única exceção é apagar
  fork que o próprio `seeya` criou e registrou (D-012).
- Toda escrita é atômica: temporário + rename.
- Nenhum caminho montado com `/` ou `\` literal. Sempre `node:path`.

## Processos

- `spawn` com array de argumentos e `shell: false`. Nunca `exec` com string interpolada — os
  `cwd` têm espaços e acentos.
- **Contexto de tamanho variável vai por stdin ou arquivo, nunca por argumento** (D-015).
  Argumento tem limite de tamanho e sofre mangling de shell nas três plataformas.
- Ao spawnar `claude`, monte o ambiente explicitamente e **remova** as variáveis de sessão
  herdadas (D-017). Herdar `CLAUDE_CODE_CHILD_SESSION` faz o processo filho perder o transcript.
- Terminar processo de sessão só quando a política permitir (D-002), só depois do handoff
  verificado em disco, e só graciosamente. Sem kill forçado na v1.

## Segurança e privacidade

- Não leia, não grave e não envie credenciais. `~/.claude/.credentials.json` não existe para
  este app.
- Fixtures de teste são anonimizadas. Nenhum caminho real, token ou código privado no repo.

## Este projeto é de código aberto

Tudo que entra aqui é lido por qualquer pessoa, para sempre, e não tem como ser retirado depois.
Vale para código, documentos, mensagens de commit e fixtures.

- Contexto que vem de **fora deste projeto** — nome de ferramenta de terceiro, sistema interno,
  identificador, caminho de máquina — é **anonimizado antes** de entrar em arquivo versionado.
  Descreva o comportamento técnico, que é o que importa para a decisão, e omita a origem.
- **Documentar bem e publicar são decisões separadas.** É fácil tratar como uma só quando se
  está escrevendo rápido, e o custo de errar é irreversível.
- Em exemplo, use placeholder: `<usuario>`, `~`, UUID obviamente sintético
  (`11111111-1111-4111-8111-111111111111`). Nunca o valor real, nem "só nesta linha".
- `scripts/verificar-termos-locais.mjs` roda no pre-commit e recusa o commit em dois casos: termo
  presente em `.termos-locais` (arquivo local, fora do git), ou conteúdo com **forma** de
  vazamento — caminho de home com usuário, e-mail, UUID que não pareça sintético.
- O guard só conhece o que já se sabe. **A regra vale mais que ele**: ele não vai pegar o nome
  novo que só você viu.

---

# Estilo de código

## Funções e arquivos

- **Função: no máximo ~20 linhas.** Não há mínimo — um predicado puro de uma linha é bom código,
  e este projeto tem vários. Se passar de 20, quase sempre são duas funções.
- **Arquivo: abaixo de 500 linhas**, separado por responsabilidade. Os arquivos atuais estão bem
  abaixo disso; se um começar a crescer, o sinal é que ganhou uma segunda responsabilidade.
- **Uma coisa por função, uma responsabilidade por módulo.**
- **Retorno cedo em vez de `if` aninhado. Máximo 2 níveis de indentação.** Três níveis é sinal de
  que falta extrair uma função.
- **Nada de duplicação.** Lógica repetida vira função ou módulo.

## Nomes

- Específicos e únicos. Evite `dados`, `info`, `util`, `helper`, `gerenciador`, `processar`,
  `handler`, `manager`.
- Heurística útil: um bom nome devolve **menos de 5 ocorrências** num grep do repositório. Se
  devolver 40, o nome não distingue nada.
- Nomes em português (D-008). Campos de JSON que vêm do Claude Code (`sessionId`, `cwd`,
  `procStart`) mantêm a grafia original.

## Tipos

- Explícitos. Sem `any`, sem `@ts-ignore`, sem função sem tipo.
- **O tipo torna o estado inválido irrepresentável; o comentário só avisa** (D-024). Se uma regra
  diz "não faça X com este valor", o tipo tem de recusar X — união discriminada em vez de campo
  opcional, dois tipos em vez de um com flag.
- `!` e `as` em código de produção são sinal de que o tipo está errado, não de que o autor sabe
  mais que o compilador.

## Mensagens de erro

**A mensagem inclui o valor que causou o erro e a forma esperada.** Isto não é preferência
estética — custou tempo real neste projeto: um teste falhou com `expected 2 to be +0` e ninguém
descobria quais eram os 2 erros até alguém instrumentar à mão.

- Asserção sobre contagem imprime **a saída bruta** da ferramenta na falha.
- Validação que rejeita item devolve o item bruto **e** o motivo com o caminho do campo.
- "Falhou" sozinho não é mensagem de erro. "Falhou porque `startedAt` veio como `"abc"`, esperava
  número inteiro positivo" é.

---

# Comentários

- **Preserve os comentários existentes.** Não os remova em refatoração: neste projeto eles
  carregam medição, não opinião — número de execuções, saída bruta observada, por que uma
  alternativa foi descartada. Apagar um comentário desses joga fora a evidência que sustenta a
  decisão.
- **Escreva o PORQUÊ, não o QUÊ.** `// incrementa o contador` acima de `i++` é ruído.
- **Docstring em função pública: intenção e um exemplo de uso.** Quando fizer diferença, diga
  também quando **não** usar.
- **Cite decisão, não conversa.** Se uma linha existe por causa de uma decisão, cite `D-0XX`; se
  por causa de um experimento, cite o spike. **Nunca cite a mensagem que despachou a tarefa** —
  o leitor não tem como abrir aquilo. Ou o raciocínio se sustenta sozinho, ou a orientação vira
  decisão em `docs/DECISOES.md` primeiro.
- Ao registrar uma limitação conhecida, diga **onde o guarda-corpo termina**. "Cobre o descuido,
  não o contorno deliberado" é mais honesto — e mais útil — que silêncio.

---

# Testes

- **Um comando roda tudo: `npm run verificar`.** Ele é o portão: tipos, lint, fronteiras de
  camada, build e cobertura.
- **Toda função nova tem teste. Toda correção de bug tem teste de regressão** — e o teste falha
  antes da correção, senão não prova nada.
- Nenhum teste toca a rede, o relógio real, o `~/.claude` real ou o `~/.seeya` real.
  A suíte de contrato é a única exceção, e ela não roda no CI.
- **Duplo de I/O é classe/objeto nomeado implementando a porta**, não stub inline. O nome diz o
  que ele finge ser.
- **F.I.R.S.T.**: rápido, independente, repetível, autoverificável, escrito junto com o código.
  "Independente" é levado a sério aqui: os testes rodam em paralelo, e paralelismo é o que expõe
  corrida nova em vez de deixá-la dormir.
- **Teste o caso permitido, não só o proibido.** Um guard que só prova que reprova pode estar
  reprovando o que deveria aceitar — foi assim que uma instabilidade real apareceu no CI.
- Cobertura mínima: **`src/nucleo/` 95%**, demais diretórios 80%. 100% de linhas não é 100% de
  comportamento: teste os valores de fronteira explicitamente.

---

# Dependências

- **Injeção por parâmetro ou construtor, nunca por import global.** Quem monta é `cli/`, a raiz
  de composição (D-020).
- **Biblioteca de terceiro que faz I/O fica atrás de uma porta** deste projeto. É o que já vale
  para processo, relógio, filesystem e notificação.
- **Isso não se aplica a biblioteca pura.** `zod` é usado diretamente em `adaptadores/*/esquemas.ts`
  de propósito: envolver um validador atrás de interface própria só acrescentaria indireção sem
  trocar nada de lugar. A regra existe para isolar o **mundo**, não para embrulhar tudo.
- Sem dependência nova sem perguntar.

---

# Estrutura

- A convenção deste projeto é a **arquitetura em camadas de `docs/ARQUITETURA.md`**, não a de um
  framework.
- **Monorepo desde a V2-T1 (D-043):** `npm workspaces`, raiz `private: true`. `core/`,
  `application/`, `adapters/` e `scheduler/` vivem em `packages/engine/src/<camada>/`;
  `cli/` vive em `packages/cli/src/` (sem subpasta própria — os arquivos ficam direto na raiz do
  pacote). **Desde a V2-T2, `packages/app/src/` existe** (D-042/D-043) — a interface, segunda raiz
  de composição, também sem subpasta de camada própria (como `cli/`): `composition/` (a raiz em
  si), `electron/` (fiação do Electron — janela, IPC, preload; único trecho fora do piso de
  cobertura), `pty/` (o `PtySpawner`/`node-pty` por trás da porta), `tabs/`, `sidebar/`, `state/`,
  `ipc/`, `text/` (módulos puros, cada um testado por unidade). `tests/<faixa>/`, `docs/`,
  `scripts/` e todo o ferramental continuam na raiz, comuns aos três pacotes.
- `@seeya-ai/cli` e `@seeya-ai/app` importam `@seeya-ai/engine` por subcaminho
  (`@seeya-ai/engine/<camada>/...`), nunca por caminho relativo cru dentro de
  `packages/engine/src` — é o `dependency-cruiser` que garante isso (oitava regra para `cli`,
  D-043; regras próprias para `app`, V2-T2 — ver `docs/ARQUITETURA.md` § "A segunda raiz de
  composição"). `app/` e `cli/` nunca se importam entre si.
- Módulos pequenos e focados. Arquivo que vira depósito de funções soltas perdeu a
  responsabilidade única.
- Teste espelha a origem, com o caminho do pacote: `packages/engine/src/core/x.ts` →
  `tests/unit/core/x.test.ts` (que importa de `@seeya-ai/engine/core/x.js`);
  `packages/cli/src/y.ts` → `tests/unit/cli/y.test.ts`.

---

# Formatação

- `prettier` é o formatador, já configurado. `npm run format` aplica, `npm run format:check`
  confere.
- **Não discuta estilo além disso.** Aspas, ponto e vírgula e largura de linha são decisão da
  ferramenta, não de review.

---

# Registro e saída

- **Saída para o usuário é texto simples**, pelo `cli/`. Nada de JSON na cara de quem digitou o
  comando.
- Registro de diagnóstico é **JSON estruturado**, para poder ser filtrado.
- **Atenção: ainda não existe logger neste projeto.** A regra "sem `console.log` solto" continua
  valendo, mas não improvise um logger no meio de uma tarefa — escolher formato, destino e nível
  é decisão, não detalhe. Se precisar registrar algo diagnóstico e não houver onde, **abra questão
  em `docs/QUESTOES.md`**. Exceção já aceita: script de ferramental fora de `src/` pode escrever
  no console, com um comentário dizendo por quê.

---

# Idioma

**Inglês no que é público, português no que é interno** (D-028).

| | Idioma |
|---|---|
| Identificadores e comentários de código | **inglês** |
| README, comandos e saída do CLI | **inglês** |
| Mensagens de commit | **inglês** |
| `docs/` — decisões, spec, arquitetura, plano, spikes, questões | **português** |

Campos de JSON que vêm do Claude Code (`sessionId`, `cwd`, `procStart`, `startedAt`) mantêm a
grafia original — são dados de fora, não nomes nossos.

## Glossário de domínio — tradução fixa

O risco desta divisão é deriva: `elegibilidade` no documento, `eligibility` no código, e alguém
inventando um terceiro nome daqui a três meses. **Use exatamente estes termos. Termo novo entra
aqui antes de entrar no código.**

| Documento (pt) | Código (en) |
|---|---|
| núcleo / adaptadores / aplicação / agendador | `core` / `adapters` / `application` / `scheduler` |
| motor / interface (pacotes, V2-T1/V2-T2, D-043) | `@seeya-ai/engine` (`packages/engine/`, contém `core`/`application`/`adapters`/`scheduler`) / `@seeya-ai/cli` (`packages/cli/`, contém `cli`) / `@seeya-ai/app` (`packages/app/`, a interface, D-042 — segunda raiz de composição, D-043) |
| aba | `Tab` (`packages/app/src/tabs/tab-model.ts`) — um terminal embutido: comando, diretório, pid (quando já lançado), status (`running`/`exited`) |
| lançamento | `spawn` (de uma aba, via `PtySpawner`/`node-pty` — `packages/app/src/pty/`), nunca `launch` |
| correspondência aba↔sessão | `matchSessionsToTabs`/`matchingTabId` (`packages/app/src/sidebar/session-match.ts`) — só por pid da sessão descoberta batendo com o pid do pty da aba; sem correspondência, sem marca (D-025) |
| painel "Hoje" (V2-T4) | `state/today-panel.ts` (`buildTodayPanelData`/`TodayPanelData`/`TodaySessionRow`) — o `seeya start-day` da interface: o briefing pendente achado por `findPendingBriefing`, uma caixa de seleção por sessão (nome, `cwd`, primeira linha do plano), e o botão **Resume selected** |
| retomada em aba (V2-T4) | abrir uma sessão retomada (`claude --resume`) numa aba embutida em vez do terminal herdado da CLI — a interface nunca espera a sessão terminar, e a aba fica rotulada com o nome do handoff, não com `claude` |
| resumer de aba (V2-T4) | `TabSessionResumer` (`packages/app/src/resume/tab-session-resumer.ts`) — implementa `SessionResumer` sobre `PtyManager`; a corrida entre a saída da aba e `FAST_FAILURE_GRACE_MS` mora em `raceExitAgainstGrace`, e `ExitListenerRegistry` (`packages/app/src/resume/exit-listener-registry.ts`) é o que deixa o `onExit` único do `PtyManager` também avisar essa corrida |
| retomar sem o plano (V2-T7) | decisão: `FallbackDecision`'s own `{ kind: 'resumeWithoutPlan' }` (`core/resume-fallback-decision.ts`), só para o motivo `promptTooLarge`, com `parseFallbackAnswer` agora parametrizada pelo motivo; porta: `SessionResumer.resumeWithoutPrompt(sessionId, cwd)` (`core/ports.ts`, implementada em `adapters/resumption/resumer.ts#ClaudeSessionResumer` e `packages/app/src/resume/tab-session-resumer.ts#TabSessionResumer`) — `claude --resume <id>` sem argumento de prompt; resultado: `ResumeOutcome`'s own `resumedWithoutPlan` (união discriminada de três formas — `resumed`/`resumedWithoutPlan`/`freshSession`, `core/types.ts`); falha rápida dessa tentativa vira `ResumeFallbackReason`'s own `resumeWithoutPlanFailed`, reportada como sessão pulada, sem segunda pergunta |
| prévia do end-day (V2-T5a) | `state/end-day-panel.ts` (`EndDayPanelState`/`reduceEndDayPanel`, estados `idle`/`previewPending`/`preview`/`running`/`result`) — o botão "End day…" roda `endDay(deps, { dryRun: true, skipGeneration: true, scope: { kind: 'fullDay' } })` (`skipGeneration`: revisão do PO, nunca chama o gerador — a prévia não custa nada) e mostra `formatEndDayReport`'s own literal text como confirmação, nunca uma segunda formatação em DOM; o teto de custo é `state/end-day-preview.ts#buildEndDayCostCeiling` |
| progresso da captura (V2-T5a) | `EndDayOptions.onCaptureProgress` (`@seeya-ai/engine/application/types.ts`, eventos `captureStarted`/`captureFinished`) emitido pelo laço de captura de `endDay` já existente; a interface projeta cada evento para "capturing N of M: nome" por `state/end-day-progress.ts#projectEndDayProgressEvent` |
| adiar/pular hoje (aplicação, V2-T5b) | `application/schedule-adjustments.ts` — `snoozeToday(storage, clock, config, minutes)`/`skipToday(storage, clock, config)`, movidos de `packages/cli/src/snooze-command.ts` (item 2: a orquestração ler/aplicar/salvar/redecidir e a tabela `SNOOZE_INCREMENTS`/`parseSnoozeIncrement` — os três incrementos de D-006); a CLI mantém só a renderização de texto, a interface consome o mesmo `ScheduleDecision` devolvido |
| faixa de horário (V2-T5b) | `state/schedule-strip.ts` (`buildScheduleStripData`/`ScheduleStripData`) — uma string por variante de `ScheduleDecision` (D-024, "nada achatado": `disabled`/`skipped`/`alreadyEnded`/`waiting`/`leadTimeWarning`/`endOfDay`) mais `canSnooze`/`canSkip`, computada a cada ciclo de `electron/main.ts`'s own refresh loop a partir do mesmo `decideSchedule` que o daemon já usa; os botões (**Snooze +15m/+30m/+1h**, **Skip today**) chamam `application/schedule-adjustments.ts` pela IPC `snoozeToday`/`skipToday` (`ipc/channels.ts`) e recebem de volta a faixa já recomputada |
| controle do daemon pela janela (V2-T5b) | `state/daemon-control-panel.ts` (`resolveDaemonControlAvailability`, a partir do mesmo `LiveLockCheck` de `@seeya-ai/engine/scheduler/daemon-state.js#checkLiveLock`; `reduceDaemonControl`/`DaemonControlState`, estados `idle`/`running`/`result`) — botão **Start daemon**/**Stop daemon** na região de estado; **parar** é `@seeya-ai/engine/scheduler/daemon-control.ts#runDaemonStop`, movido de `packages/cli/src/daemon-command.ts` (só chama métodos da porta `ProcessControl`, então subiu para `scheduler/` e os dois compõe-roots importam a mesma implementação); **subir** é a própria composição da interface (`packages/app/src/composition/index.ts#AppContext.startDaemon`) — não reaproveita `runDaemonLauncher` da CLI (D-043: `app/` e `cli/` nunca se importam), mas chama os mesmos `scheduler/lock.ts#checkDaemonLock`/`adapters/process/daemon-launch.ts#spawnDetachedDaemon` que ele usa, com um `DaemonLaunchTarget` próprio (ver entrada de `DaemonLaunchTarget` abaixo) |
| `ProcessControl.terminateAbruptly` (porta, V2-T5b) | `core/ports.ts` — o antigo `adapters/process/termination.ts#terminateAbruptly` (SIGKILL/TerminateProcess incondicional, só para o próprio daemon do `seeya`, nunca para uma sessão descoberta, D-002) virou método da porta para que `scheduler/daemon-control.ts#runDaemonStop` possa chamá-lo sem importar o adaptador concreto (`scheduler/` não pode importar `adapters/`) |
| `DaemonLaunchTarget` ganha `nodePath`/`env` (V2-T5b) | `adapters/process/daemon-launch.ts` — antes lia `process.execPath`/`process.env` direto; agora `nodePath` é explícito (a CLI passa `process.execPath`, a interface passa o `process.execPath` do Electron, com `ELECTRON_RUN_AS_NODE=1` no `env`) e `env`, quando informado, **substitui** `process.env` inteiro (não faz merge) — é o que deixa o filho do daemon lançado pela interface sair com o mesmo ambiente já limpo das variáveis de sessão (D-017) que `AppContext.tabEnv` já calcula |
| marcador de registro do protocolo (V2-T5b, reshapeado pela V2-T10 item 2) | `~/.seeya/protocol-handler.json`, campo `activeScheme` (era `registered: boolean`; `schemaVersion` 1→2, um documento v1 é lido como `activeScheme: 'seeya'` — `adapters/storage/protocol-handler-schema.ts#PROTOCOL_HANDLER_SCHEMA_MIGRATIONS`) — `core/ports.ts#Storage.readActiveProtocolScheme`/`saveActiveProtocolScheme`; gravado por `packages/app/src/electron/main.ts` a cada janela aberta, com o esquema que ELA registrou (ver `esquema por mundo` abaixo — "segue a última janela aberta"), quando `app.setAsDefaultProtocolClient(scheme)` retorna sucesso; lido pelos backends de toast do Windows e do Linux antes de incluir um `launch`/`--action` no toast — sem marcador, toast como antes da V2-T5b (D-025) |
| esquema por mundo (V2-T10 item 1) | `core/types.ts#ProtocolScheme` (`'seeya' \| 'seeya-dev'`) — `packages/app/src/composition/protocol-scheme.ts#resolveProtocolScheme(isPackaged)` (puro, testado: instalado → `seeya`, dev → `seeya-dev`); `electron/main.ts#registerProtocolHandler(scheme)` registra só o esquema do próprio processo (nunca os dois), evitando que a versão empacotada e a de desenvolvimento se sobrescrevam (o achado medido que originou a V2-T10, Q-080). No Linux, o checkout de desenvolvimento nunca registra nada (sem `.desktop`); só o `.deb` registra `seeya` (`electron-builder.yml`'s own `protocols:`) |
| notificador com verificação de protocolo (V2-T5b, reshapeado pela V2-T10 item 2) | `adapters/notification/index.ts#buildNotifier(activeProtocolScheme, platform?)` — a variante do `notifier` singleton que injeta a leitura do marcador acima (agora `ProtocolScheme \| null`, nunca mais um booleano) no `WindowsToastBackend`/`LinuxNotifySendBackend`; só `packages/cli/src/composition.ts#buildDaemonContext` usa ("quem manda o toast é o daemon") — `buildEndDayContext`/a interface continuam com o `notifier` singleton sem essa checagem |
| toast confere a chave do esquema (Windows, V2-T10 item 3) | `adapters/notification/windows-toast.ts#buildToastScript` — quando há um esquema ativo, o PRÓPRIO script de PowerShell que já é disparado para mostrar o toast testa `Test-Path 'HKCU:\Software\Classes\<esquema>'` e só carrega o XML com `launch`/`activationType="protocol"` se a chave ainda existir (sem processo a mais: a checagem mora dentro do mesmo script, nunca uma segunda chamada); marcador desatualizado (app desinstalado) → toast sem clique, nunca o seletor "como você quer abrir isto?" do Windows |
| instalador (V2-T8) | `electron-builder`, `packages/app/electron-builder.yml` — NSIS por usuário no Windows, `.deb`+`AppImage` no Linux, `.dmg` (só CI) no macOS; `packages/app/scripts/dist.mjs` roda `electron-builder` com `CSC_IDENTITY_AUTO_DISCOVERY=false` (nunca assina com o que estiver no chaveiro/repositório de certificados da máquina) — comando `npm run dist`, raiz e `packages/app` |
| desinstalação limpa o registro (Windows, V2-T10 item 4) | `packages/app/build/installer.nsh`'s own `customUnInstall` macro (`DeleteRegKey HKCU "Software\Classes\seeya"`) — medido: o NSIS do `electron-builder` não tem suporte nenhum a registro/remoção de protocolo (ao contrário dos alvos mac/linux, que leem o mesmo `protocols:` de `electron-builder.yml`), então sem este arquivo a chave sobrevivia à desinstalação; caminho padrão do `nsis.include` do `electron-builder`, sem configuração extra em `electron-builder.yml`. Só `seeya` — `seeya-dev` nunca é instalado por este NSIS |
| PATH do shell de login (V2-T8) | `packages/app/src/composition/login-shell-path.ts` (`buildLoginShellPathArgs`/`parseLoginShellPathOutput`, puro) e `packages/app/src/composition/read-login-shell-path.ts#readLoginShellPath` (a leitura, `$SHELL -lic`, com `spawnHidden`, prazo curto — `LOGIN_SHELL_PATH_TIMEOUT_MS`); `AppContext.loginShellPathSource` (`'login-shell' | 'inherited' | 'not-applicable'`) diz qual PATH venceu (D-025) — só fora do Windows, usado por `resolveHarnessCommand` e `tabEnv` |
| marcador de registro do protocolo no Linux (V2-T8) | `packages/app/src/composition/linux-protocol-marker.ts#shouldMarkLinuxProtocolRegistered` — infere (não confirma por API, ao contrário do Windows) que o `.desktop` já registrou `seeya://` a partir de `app.isPackaged && process.env.APPIMAGE === undefined` (uma instalação `.deb`, nunca um `AppImage`); grava o mesmo marcador de `~/.seeya/protocol-handler.json` que o Windows já usa (sempre com `activeScheme: 'seeya'` — um checkout de desenvolvimento nunca registra nada no Linux, V2-T10 item 1) |
| clique no toast no Linux (V2-T8, esquema dinâmico desde a V2-T10 item 2) | `adapters/notification/linux-notify-send.ts#LinuxNotifySendBackend` — `notify-send --wait --action=default=Open` (`buildNotifySendArgs(notice, true)`), só quando o marcador acima existe e a versão instalada suporta `--action` (`parseNotifySendVersion`/`versionSupportsActionFlag`, piso 0.7.10); processo destacado e invisível (`adapters/notification/backend.ts#spawnDetachedListening`/`DetachedLaunch`, D-038) — `send()` retorna assim que o toast aparece, e uma continuação em segundo plano lê o `stdout` do clique e abre `<esquema ativo>://open` via `xdg-open` (sem checagem de registro equivalente à do Windows — um esquema sem dono simplesmente falha sem efeito, o limite registrado pela V2-T10) |
| histórico de diretórios da sessão (V2-T9 item 1) | `application/cwd-history.ts` — `CwdHistoryEntry` (`cwd`/`firstDay`/`lastDay`/`exists`), `collapseCwdRuns` (puro, o recorte que junta dias consecutivos com o mesmo `cwd` normalizado, `core/cwd-normalization.ts`) e `readCwdHistory` (a leitura, `Storage.readHandoff` dia a dia, limitada por `maxBriefingScanDays` como o `findPendingBriefing`) — construído inteiro a partir das próprias capturas do seeya, nunca do `cwd` por linha do transcript (medido: não serve, 32 valores distintos numa sessão real) nem do slug da pasta de transcript (perde informação). Nenhuma chave nova em disco |
| porta de existência de diretório (V2-T9 item 1) | `core/ports.ts#DirectoryExistence` (`exists(cwd)`), implementada por `adapters/filesystem/directory-existence.ts#FsDirectoryExistence` (um `fs.promises.stat`) — separada de `Storage` de propósito: o contrato de `Storage` é só sobre `~/.seeya/`, e um `cwd` de sessão é um diretório que este projeto não é dono |
| seletor "Resume in" (V2-T9 item 2) | `state/today-panel.ts`'s own `TodaySessionRow.cwdHistory` — a nota ("ran in X until ...; in Y since ...", com "(no longer exists)" para quem sumiu) e o `<select>` só com os diretórios que ainda existem, o mais recente como padrão, renderizados por `electron/renderer.ts#renderCwdHistoryNote`/`renderResumeInSelect`; a escolha viaja pelo IPC em `ResumeSelectedRequest.chosenCwdBySessionId` (`ipc/channels.ts`) e `electron/main.ts`'s own `resumeSelected` handler troca o `cwd` do handoff só para aquela tentativa, sem regravar `~/.seeya/` |
| aviso da CLI sobre o `cwd` (V2-T9 item 3) | `cli/format-start-day.ts#formatCwdHistoryNote`/`formatCwdHistoryNotes` — o mesmo texto que a interface mostra (item 2), impresso por `start-day-command.ts` logo depois do plano consolidado; a CLI nunca pergunta, sempre retoma no `cwd` mais recente do handoff (D-045: ela é cliente, uma pergunta a mais para um caso raro não se paga) |
| caixa por vivacidade, não por registro (V2-T9 item 4) | `TodayResumeStatus` (`state/today-panel.ts`, união discriminada `runningNow`/`resumedEarlier`/`neverResumed`, D-024) — `runningNow` vem de `sidebar/sidebar-data.ts#buildLiveSessionIndex`, a partir da MESMA descoberta de sessões que o ciclo de atualização de 10s já faz (`alive`/`idle`, nunca uma segunda `SessionProvider.list()`), não do `resumed.json`; `resumed.json` continua decidindo quando o briefing deixa de estar pendente, só deixa de decidir a caixa. A CLI não muda |
| painel de configurações (V2-T14) | `state/settings-panel.ts` (`buildSettingsRows`/`SettingsRow`, `buildProjectPolicyLines`/`ProjectPolicyLine`) — uma linha por `EDITABLE_CONFIG_KEYS` (`@seeya-ai/engine/adapters/storage/config-schema.js`, as mesmas dezesseis chaves de `seeya config get`), com valor e origem (`'default'`/`'chosen'`, por comparação com `DEFAULT_CONFIG`, D-025) mais o `projectPolicy` só para leitura; salvar passa pelo MESMO `parseConfigFieldUpdate`/`applyConfigFieldUpdate` + `Storage.saveConfig` que `seeya config set` usa (IPC `getSettingsPanel`/`saveSetting`, `ipc/channels.ts`), e a faixa de horário é recomputada na hora com o `Config` recém-gravado; `electron/main.ts`'s own ciclo de atualização de 10s também passou a reler `config.json` a cada tick (não mais o `context.config` fixo do início), senão um valor salvo aqui voltaria ao antigo no ciclo seguinte |
| detecção de instalação do app (V2-T13, D-045 item 2) | `core/ports.ts#AppInstallation`/`AppInstallationStatus` (`installed`/`notInstalled`/`unknown`, D-024/D-025) — `adapters/installation/`, um adaptador por SO escolhido em `index.ts` (mesmo formato de `adapters/autostart/`): Windows lê a entrada de desinstalação do NSIS em `HKCU\...\Uninstall` (por usuário) **e** `HKLM\...\Uninstall`/`HKLM\...\WOW6432Node\...\Uninstall` (por máquina — achado do mantenedor durante a tarefa, Q-081: a instalação por máquina só aparece em HKLM, nunca em HKCU), caminho do executável por `InstallLocation`/`UninstallString`/`DisplayIcon`, nessa ordem; Linux pergunta ao `dpkg`; macOS procura o `.app` em `/Applications`. Nunca um arquivo do `seeya` (D-045: "opções assim disponíveis para alguém ir lá e apagar são um problema") |
| posse do daemon/autostart (V2-T13, D-045 item 1) | `application/daemon-ownership.ts#resolveDaemonOwner` (puro, sobre `AppInstallationStatus`) devolve `core/types.ts#DaemonOwner` (`app` com `launchPath` / `cli` / `unknown`, D-024) — app instalado → dono é o app; sem instalação → dono é a CLI (v1); consulta que falhou → `unknown`, e **nada é recusado** nesse caso (D-025) |
| a CLI vira cliente (V2-T13, D-045 item 3) | Quando `resolveDaemonOwner` devolve `app`, `seeya daemon` (subir) e `seeya autostart enable` recusam com uma linha que explica e aponta para a janela (`cli/daemon-command.ts#runDaemonLauncher`/`cli/autostart-command.ts#runAutostartEnableCommand`); `--stop`, `seeya status`, `autostart status`/`disable` continuam funcionando para qualquer dono. **A recusa é só da invocação humana** — o worker que a própria janela lança passa pelo mesmo `cli/daemon-command.ts` sob `SEEYA_DAEMON_CHILD` (`adapters/process/daemon-launch.ts#DAEMON_CHILD_ENV_VAR`) e nunca é checado contra `DaemonOwner` |
| autostart com env (V2-T13, D-045 item 4) | `core/ports.ts#Autostart.enable` ganhou um segundo argumento opcional, `AutostartLaunchOptions` (`execPath`/`env`) — o app registra o autostart apontando para o `execPath` do Electron com `ELECTRON_RUN_AS_NODE: '1'` no `env` (os mesmos dois fatos que `adapters/process/daemon-launch.ts#DaemonLaunchTarget` já carrega para o botão *Start daemon*, V2-T5b), em vez do `process.execPath` implícito que a CLI sempre usou. Omitido, o comportamento é exatamente o de antes (S5-T1) |
| botão de autostart do app (V2-T13, D-045 item 4) | `state/autostart-control-panel.ts` (`resolveAutostartControlAvailability`/`reduceAutostartControl`, mesmo formato idle→running→result de `state/daemon-control-panel.ts`) — só disponível quando `DaemonOwner.kind === 'app'` (`notApplicable` caso contrário, D-024); liga/desliga o MESMO `DaemonLaunchTarget` que `AppContext.startDaemon` já monta, pela IPC `autostartControl` |
| pergunta única da transição (V2-T13, D-045 item 1) | `core/types.ts#DaemonOwnershipTransitionAnswer` (`accepted`/`declined`), persistida uma vez em `Storage.readDaemonOwnershipTransitionAnswer`/`saveDaemonOwnershipTransitionAnswer`; `application/daemon-ownership.ts#shouldOfferDaemonOwnershipTransition` decide se a pergunta aparece (dono é o app, resposta ainda não existe, e há sinal de daemon/autostart da CLI); aceitando, `packages/app/src/composition/index.ts#applyDaemonOwnershipTransition` para o daemon da CLI (`stopDaemon`), aponta o autostart para o app (`enableAppAutostart`) e sobe o próprio (`startDaemon`) — recusando, só grava a resposta, sem tocar em nada |
| espaço de trabalho (V2-T27, D-027/D-028) | `workspace` — o único repositório git que o `seeya` cria e commita, sem remoto nesta tarefa (`docs/V2-RUMO.md` § "Um repositório para todos os projetos"); onde ele mora neste dispositivo é `Storage.readWorkspaceRoot`/`saveWorkspaceRoot` (`core/ports.ts`), resolvido e persistido uma vez por `application/workspace.ts#resolveWorkspaceRoot` (default: `<seeyaHome>/workspace`, dentro do próprio `~/.seeya/`) |
| projeto (V2-T27, D-027/D-028) | `project` — `core/types.ts#ProjectManifest` (`id`/`name`/`defaultHarness`/`repositories`/`trackers`, os nomes do rumo, D-024's `defaultHarness: string \| null` nunca inventado numa criação) é o `seeya.json` de um projeto; `core/project-skeleton.ts#buildProjectSkeleton` monta o esqueleto vazio e honesto (`AGENTS.md`/`CLAUDE.md`/`INDEX.md` + as seis pastas); `application/workspace.ts#createProject`/`listProjects`/`showProject` orquestram sobre `WorkspaceRepository`/`Storage` para `seeya project create`/`list`/`show` (`cli/project-command.ts`) |
| repositório associado (V2-T27/V2-T28, D-027/D-028) | `AssociatedRepository` (`core/types.ts`) — um repositório de código da pessoa que um projeto aponta para; só leitura, o `seeya` nunca escreve nele. Vazio em todo projeto criado pela V2-T27; a V2-T28 adiciona itens por `add-repo` e muda a forma para uma união discriminada em `hasRemote` (D-024): `{ hasRemote: true, name, remote, identity }` quando o clone local tinha um `origin`, `{ hasRemote: false, name }` quando não tinha (D-025 — "sem remoto" nunca vira uma identidade inventada a partir do caminho) |
| identidade do repositório (V2-T28, D-027/D-028) | `RepositoryIdentity` (`core/types.ts`, `{ host, owner, repository }`) — a forma canônica de um remoto git, para que `git@host:dono/repo.git` e `https://host/dono/repo.git` comparem iguais (`docs/V2-RUMO.md` § "A identidade é canônica"). `core/repository-identity.ts#normalizeRepositoryIdentity` é a função pura que deriva uma de uma URL de remoto (`null` quando a URL não tem forma reconhecível — um caminho local, por exemplo — nunca uma identidade inventada); `repositoryIdentitiesEqual` compara duas |
| mapa de repositórios do dispositivo (V2-T28, D-027/D-028) | `repository-map.json`, raiz de `~/.seeya/` — `RepositoryMapEntry` (`core/types.ts`), uma união discriminada em `hasIdentity`: `{ hasIdentity: true, identity, path }` para um repositório com remoto (chave global, o mesmo remoto pode servir mais de um projeto neste dispositivo); `{ hasIdentity: false, projectId, name, path }` para um repositório sem remoto (só resolvível dentro do projeto que o registrou, já que não há identidade para chavear por fora — `docs/V2-RUMO.md`'s own "todas alimentando o mesmo mapa por dispositivo"). `core/repository-map.ts#upsertRepositoryMapEntry`/`findRepositoryMapEntry` são as funções puras; `Storage.readRepositoryMap`/`saveRepositoryMap` (`core/ports.ts`) é a porta, implementada em `adapters/storage/index.ts` sobre `repository-map-schema.ts` |
| `seeya project add-repo` (V2-T28) | `application/repository-association.ts#addRepository` — lê o remoto do clone local pela porta `GitReader.readRemoteUrl` (nova, `adapters/git/remote.ts#readRemoteUrl`, `git remote get-url origin`), grava a identidade (ou `hasRemote: false`) no `seeya.json` do projeto via `WorkspaceRepository.writeProjectManifest` (nova) + `commitAll`, e o caminho local no mapa deste dispositivo. Repositório já associado (mesma identidade, ou mesmo nome quando nenhum dos dois tem identidade) não duplica — reporta que já estava |
| `seeya project open` (V2-T28) | `application/project-open.ts#openProject` — abre o harness (só `claude` nesta tarefa) com o diretório do projeto como `cwd` e um `--add-dir` por repositório associado cujo caminho ainda existe neste dispositivo; repositório sem entrada no mapa, ou com caminho que sumiu, vira aviso e é pulado, nunca aborta a abertura (D-025) |
| lançador de harness (porta, V2-T28) | `HarnessLauncher` (`core/ports.ts`) — `open(cwd, addDirs)`, implementada por `adapters/harness/index.ts#ClaudeHarnessLauncher`, reusando `adapters/resumption/spawn-interactive.ts#runInteractive`/`env.ts#buildResumptionEnv` (D-017) — o mesmo `stdio: 'inherit'` que a retomada interativa já usa (docs/spikes/H-retomada-interativa.md), porque `open` também é uma sessão interativa de verdade, nunca headless. `adapters/harness/args.ts#buildOpenArgs` termina a lista de `--add-dir` com `--` explícito, sempre que houver algum diretório — o gotcha que `docs/spikes/N-adocao-de-sessao.md` mediu |
| identificador do projeto (V2-T27, D-027/D-028) | `projectId` — minúsculas e hífens, validado por `core/project-id.ts#isValidProjectId` antes de virar nome de diretório dentro do espaço de trabalho |
| `WorkspaceRepository` (porta, V2-T27) | `core/ports.ts` — escrita no espaço de trabalho: `isInitialized`/`initialize` (`git init`), `projectExists`/`writeProjectSkeleton`, `commitAll` (V2-T33: `git add <projectId> .gitignore` + `git commit`, um projeto por commit, identidade própria do `seeya`, nunca `git config user.*` da máquina; no-op quando nada mudou, nunca commit vazio), `listProjects`/`readProjectManifest` (D-022: coleção item a item, leitura única lança). Implementada por `adapters/workspace/index.ts#FsWorkspaceRepository`, reusando `adapters/git/run-git.ts#runGit` (agora com um terceiro parâmetro `env` opcional, só para a identidade do commit) e `adapters/storage/atomic-write.ts#writeFileAtomic` — nenhuma dependência nova |
| `WorkspaceRepository.commitAll` toca um projeto só (V2-T33, D-047 item 4's bug fix) | `commitAll(root, projectId, message)` — ganhou `projectId` e passou a escrever `git add <projectId> .gitignore` no lugar de `git add -A`; `message` já chega pronta de `core/project-commit.ts#buildProjectCommitMessage` (o adapter não monta trailer nenhum). Corrige o defeito em que mudança pendente em dois projetos virava um commit só, tornando reverter um desfazer o outro — teste de regressão em `tests/integration/workspace/fs-workspace-repository.test.ts` |
| lock do projeto (porta, V2-T33, D-047 item 1) | `ProjectLock` (`core/ports.ts`) — `read`/`write`/`clear` no arquivo dentro do próprio diretório do projeto (nunca `~/.seeya/`), implementada por `adapters/workspace/project-lock.ts#FsProjectLock`. A decisão pura de tomar/recusar é `core/project-lock.ts#decideProjectLockAcquisition` (mesma forma de `core/daemon-lock.ts#decideLockAcquisition`, D-047 item 2: "a mesma checagem de vivacidade que o `daemon.lock` já usa" — pid + `procStart`, via `ProcessControl.isAlive`, reusada e não reescrita); orquestrada por `application/project-lock.ts#checkProjectLock`/`acquireProjectLock`/`releaseProjectLock`, o mesmo split porta-pura/aplicação que `scheduler/lock.ts` já dá a `core/daemon-lock.ts` |
| identidade da sessão que segura o lock/commita (V2-T33, D-047) | `sessionId` — `process.env.CLAUDE_CODE_SESSION_ID` (a mesma variável da tabela de D-017), lido só na raiz de composição (`packages/cli/src/composition.ts`) e passado adiante como `string \| undefined`: ausente quando `seeya` roda fora de uma sessão do Claude Code (D-025, nunca inventado). Vira o trailer `Seeya-Session-Id` mesmo ausente — nesse caso o valor literal é `unknown`, nunca uma sessão inventada |
| trailers de commit do espaço de trabalho (V2-T33, D-047 item 4) | `Seeya-Project-Id` / `Seeya-Session-Id` — as duas linhas de trailer que todo commit do `seeya` no espaço de trabalho carrega, montadas por `core/project-commit.ts#buildProjectCommitMessage` (puro). É o que torna "reverter os commits de uma sessão num projeto" (V2-T32) possível de identificar depois |
| sessão descoberta | `DiscoveredSession` |
| sessão com PID / sem PID | `SessionWithPid` / `SessionWithoutPid` |
| estado da sessão | `SessionState` |
| viva / ociosa / encerrada / desconhecida | `alive` / `idle` / `ended` / `unknown` |
| elegibilidade | `eligibility` |
| evidência / assinatura de evidência | `evidence` / `EvidenceSignature` |
| captura | `capture` |
| handoff / briefing | `handoff` / `briefing` (já em inglês) |
| encerrar o dia / iniciar o dia / capturar sessão | `endDay` / `startDay` / `captureSession` |
| encerrar processo | `terminate` (nunca `close` nem `kill`) |
| fatos / fontes | `facts` / `sources` |
| relógio | `Clock` |
| controle de processo | `ProcessControl` |
| provedor de sessões | `SessionProvider` |
| aceitos / rejeitados | `accepted` / `rejected` |

Termos de portas e tipos que **ainda não existem no código**, fixados aqui antes de existirem
justamente para que quem os implementar não invente nome:

| Documento (pt) | Código (en) | Chega em |
|---|---|---|
| leitor de transcrição | `TranscriptReader` | S1-T4 |
| leitor de git | `GitReader` | S2-T1 |
| fatos de git | `GitFacts` | S2-T1 |
| ler fatos (método) | `readFacts` | S1-T4 |
| fatos da sessão | `SessionFacts` | S1-T4 |
| gerador de handoff | `HandoffGenerator` | S2-T2 |
| gerar (método) | `generate` | S2-T2 |
| entendimento gerado | `GeneratedUnderstanding` | S2-T2 |
| notificador / aviso | `Notifier` / `Notice` | S4-T1 |
| notificar (método) | `notify` | S4-T1 |
| está disponível / suporta ações (métodos) | `isAvailable` / `supportsActions` | S4-T1 |
| autostart (porta) | `Autostart` | S5-T1 |
| ligado / desligado / ligado com caminho quebrado / não consegui verificar | `enabled` / `disabled` / `brokenPath` / `unknown` | S5-T1 |
| registrado / já registrado / atualizado (resultado de enable) | `registered` / `alreadyRegistered` / `updated` | S5-T1 |
| removido / não estava registrado (resultado de disable) | `removed` / `notRegistered` | S5-T1 |
| armazenamento | `Storage` | S1-T5 |
| briefing do dia | `saveBriefing` / `listHandoffs` | S2-T4 |
| salvar handoff / ler briefing / ler config (métodos) | `saveHandoff` / `readBriefing` / `readConfig` | S1-T5 |
| dia | `Day` | S1-T5 |
| estado do dia | `DayState` | S4-T2 |
| salvar estado (método) | `saveState` | S4-T2 |
| fatos de git por repositório / ler evidência entre repositórios | `RepositoryGitFacts` / `readEvidenceAcrossRepos` | S4-T0 |

**Identificadores que vão para disco.** Chaves de `config.json`, chaves do handoff e o layout de
pastas em `~/.seeya/`. Estes são os mais caros de errar: uma vez que o app grava um arquivo, o
nome da chave vira formato, e renomear depois quebra o que já está em disco na máquina de quem
usa. Fixados em S1-T0g, antes de qualquer um deles existir em código.

| Documento (pt) | Em disco (en) | Onde |
|---|---|---|
| versão do esquema | `schemaVersion` | config e handoff |
| horário de encerramento | `endOfDayTime` | config |
| antecedências em minutos | `leadTimesInMinutes` | config |
| horas de relevância | `relevanceHours` | config |
| minutos para ocioso | `idleMinutes` | config |
| modelo da captura | `captureModel` | config |
| orçamento por sessão | `budgetPerSessionUsd` | config |
| concorrência da captura | `captureConcurrency` | config |
| ignorar | `ignore` | config |
| política por projeto | `projectPolicy` | config |
| pode encerrar | `canTerminate` | config |
| dias para limpar forks | `forkCleanupDays` | config (D-012, default 7) |
| teto de raízes de git visitadas | `maxGitRootsToVisit` | config (D-035, default 8) |
| limite de retentativa de captura | `maxCaptureAttemptsPerSessionPerDay` | config (D-035, default 3) |
| teto de dias de busca do briefing pendente | `maxBriefingScanDays` | config (D-035, default 30) |
| limiar de disparo vencido | `overdueFireThresholdMinutes` | config (D-035/D-036, default 5) |
| histerese entre avisos prévios | `leadTimeHysteresisMinutes` | config (D-035, default 3, S4-T7) |
| família da fonte do terminal | `terminalFontFamily` | config (D-035, V2-T3, default é uma pilha que termina na Nerd Font embutida) |
| tamanho da fonte do terminal (px) | `terminalFontSize` | config (D-035, V2-T3, default 14) |
| carimbo do último aviso prévio | `lastLeadTimeWarningNoticeAt` | `estado.json` (S4-T7) |
| prazo do último aviso prévio disparado | `firedLeadTimesEffectiveEndOfDay` | `estado.json` (S4-T7) |
| estado do dia (arquivo) | `estado.json` | raiz de `~/.seeya/` (S4-T3) |
| dia / pulado / adiamento acumulado / avisos disparados / encerramento disparado | `day` / `skipped` / `snoozeMinutesTotal` / `firedLeadTimesInMinutes` / `endOfDayFired` | `estado.json` (S4-T2) |
| tentativas de captura de hoje | `captureAttemptsToday` | `estado.json` (S4-T3) |
| saúde do daemon / último erro de ciclo / falhas consecutivas | `daemonHealth` / `lastCycleError` / `consecutiveCycleFailures` | `estado.json` (S4-T3b) |
| lock do daemon / pid / iniciado em / início do processo | `daemon.lock` / `pid` / `startedAt` / `procStart` | raiz de `~/.seeya/` (S4-T3, S4-T3b) |
| executável que lançou o daemon | `launchedBy` (opcional; ausente = "não sei quem lançou", nunca "foi outro", D-025) | `daemon.lock` (V2-T25, D-045 item 1's bug fix — `schemaVersion` 1→2, lock v1 migrado sem o campo) |
| marcador de registro do protocolo / esquema ativo | `protocol-handler.json` / `activeScheme` (era `registered`, V2-T5b; renomeado e o valor virou o esquema, não mais um booleano, pela V2-T10 item 2 — `schemaVersion` 1→2, documento v1 migrado para `activeScheme: 'seeya'`) | raiz de `~/.seeya/` (V2-T5b) |
| resposta da pergunta única de transição de posse | `daemon-ownership-transition.json` / `answer` (`'accepted'`/`'declined'`) | raiz de `~/.seeya/` (V2-T13, D-045 item 1) |
| saída do processo que o autostart lança | `autostart.log` (`AUTOSTART_OUTPUT_LOG_FILE_NAME`, `adapters/autostart/env.ts`) — stdout/stderr do daemon lançado pelo próprio mecanismo de autostart de cada SO (não um logger do `seeya`; cada adaptador usa o recurso nativo do próprio SO: `StandardOutPath`/`StandardErrorPath` no macOS, `StandardOutput=`/`StandardError=append:` no Linux, redirecionamento via `cmd.exe` no Windows) | raiz de `~/.seeya/` (V2-T23 item 5) |
| local do espaço de trabalho (por dispositivo) | `workspace.json` / `root` | raiz de `~/.seeya/` (V2-T27) |
| manifesto do projeto | `seeya.json` / `schemaVersion`, `id`, `name`, `defaultHarness`, `repositories`, `trackers` | raiz de cada projeto, dentro do espaço de trabalho, nunca em `~/.seeya/` (V2-T27) |
| item de `repositories` do manifesto | `name`, `remote` (`string \| null`), `identity` (`{ host, owner, repository } \| null`) | `seeya.json`, dentro de `repositories` (V2-T28) |
| mapa de repositórios do dispositivo | `repository-map.json` / `schemaVersion`, `entries` — cada item `identity` (opcional) ou `projectId`+`name`, e `path` | raiz de `~/.seeya/` (V2-T28) |
| lock do projeto (arquivo) | `.seeya-lock` / `sessionId` (opcional, D-025), `pid`, `procStart` (opcional, mesma tolerância de `daemon.lock`), `acquiredAt` | dentro de cada `<projectId>/` do espaço de trabalho — **nunca** em `~/.seeya/` e **nunca** commitado (entra no `.gitignore` do espaço de trabalho, que o próprio `seeya` cria/atualiza) (V2-T33, D-047) |
| raiz do repositório | `root` | handoff (git, D-032) |
| arquivos fora de repositório / repositórios não visitados | `filesOutsideRepository` / `reposNotVisited` | handoff (git, D-032) |
| avisos já dados | `early-warnings.json` | arquivo em `~/.seeya/` (S1-T7) |
| sessões já avisadas | `warnedSessionIds` / `warnedKeyFiles` | `early-warnings.json` (S1-T7) |
| captura profunda | `deepCapture` | config (`projectPolicy`) |
| capturado em | `capturedAt` | handoff |
| estado da sessão | `sessionState` | handoff |
| capturado durante turno ativo | `capturedDuringActiveTurn` | handoff |
| origem | `source` | handoff |
| modo da captura | `captureMode` | handoff |
| última atividade | `lastActivity` | handoff |
| últimos prompts | `lastPrompts` | handoff |
| arquivos tocados | `touchedFiles` | handoff |
| sujo | `dirty` | handoff (git) |
| arquivos modificados | `modifiedFiles` | handoff (git) |
| commits do dia | `commitsToday` | handoff (git) |
| commits do dia, por worktree | `commitsTodayCount` | handoff (git) — **número**, não lista |
| pendências | `pendingItems` | handoff |
| plano de amanhã | `tomorrowPlan` | handoff |
| erro na geração | `generationError` | handoff |
| dias / sessões / resumo | `days/` / `sessions/` / `summary.md` | layout |
| sessões já retomadas | `resumed.json` / `sessionIds` | `days/<day>/` (S3-T3) |

Valores de enum seguem a mesma regra: `alive` / `idle` / `ended` / `unknown` (já em
`src/core/types.ts`), `model` / `deterministic` / `noTranscript`, `lean` / `deep`, e
`git` / `transcript` / `registry`.

Nomes de comando e flags do CLI: `sessions`, `end-day`, `start-day`, `snooze`, `skip-today`,
`status`, `config`, `daemon`, `autostart` (`enable` / `disable` / `status`, S5-T1), `init`,
`project` (`create` / `list` / `show`, V2-T27; `add-repo` / `open`, V2-T28), e `--session`, `--all`,
`--stop`, `--dry-run`, `--with` (V2-T28, `project open`). Os três primeiros vieram do README, que
já os tinha fixado e tem precedência.

Variável de ambiente interna: `SEEYA_DAEMON_CHILD` (S4-T3) distingue o lançador do worker do
daemon. Atravessa um `spawn`, nunca vai para disco, e ninguém digita.

Variáveis de ambiente só de instrumentação de verificação (`packages/app/src/electron/main.ts`,
V2-T2, V2-T4, V2-T5a, V2-T5b, V2-T14, V2-T17): `SEEYA_APP_OFFSCREEN`, `SEEYA_APP_SCREENSHOT_PATH`, `SEEYA_APP_QUIT_AFTER_MS`,
`SEEYA_APP_AUTO_OPEN_SHELL_TAB`, `SEEYA_APP_HOME_OVERRIDE`, `SEEYA_APP_AUTO_RESUME_ALL` (V2-T4:
marca toda caixa de seleção do painel "Hoje" e clica **Resume selected**, respondendo **Skip** se
o diálogo de fallback aparecer), `SEEYA_APP_AUTO_END_DAY` (V2-T5a: clica o botão real "End day…",
espera a prévia carregar — ela roda `claude -p` por sessão de verdade — e clica **Run end-day
now**; também estende a janela de `captureVerificationScreenshot` de 2.500ms para 8.000ms, porque
esta é a única instrumentação que espera por DOIS `endDay` reais antes da captura valer a pena),
`SEEYA_APP_AUTO_SNOOZE_15` (V2-T5b: clica o botão real **Snooze +15m** da faixa de horário, para
provar que o clique persiste `snoozeMinutesTotal` em `estado.json` e que a faixa atualiza sem
esperar o próximo ciclo ambiente), `SEEYA_APP_AUTO_EDIT_SETTINGS` (V2-T14: abre o diálogo real de
**Settings…**, tenta um valor inválido em `relevanceHours` — prova a recusa do item 2, a mensagem
de erro da própria linha fica visível e nada é gravado — e então um valor válido em `endOfDayTime`
— prova os itens 1 e 3 juntos: a origem daquela linha vira "set in config.json" e a faixa de
horário na barra lateral atualiza na hora, sem reiniciar nada), `SEEYA_APP_STARTUP_TIMING_PATH`
(V2-T17 item 4: grava, no arquivo indicado, o instante em que o primeiro `sessionsUpdate` foi
enviado ao renderer — a metade, do lado do app, da medida "tempo até a lista de sessões na tela"
de `docs/DESEMPENHO.md`; `packages/app/scripts/measure-startup.mjs` é a outra metade, que lança o
processo e faz a subtração) —
mesma categoria de `SEEYA_DAEMON_CHILD`
acima (nunca vão para disco, ninguém digita), mas nenhuma delas é lida por `npm run app` nem
documentada no `README.md`: existem só para um agente sem tela/teclado próprios provar a janela
real (`webContents.capturePage()`) e o fluxo de uma aba contra um `homeDir` descartável, o mesmo
"instrumentação só do spike" que `docs/spikes/M-terminal-embutido.md` já usou
(`SPIKE_AUTO_TABS_FILE` e companhia). O uso de cada uma está documentado no próprio
`electron/main.ts`, junto de onde é lida.

**Nomes de decisão não se traduzem.** `D-021` é `D-021` em qualquer idioma, e é assim que o
código aponta para o porquê.

**Exceção medida: os nomes dos scripts npm ficam em português.** `verificar`, `cobertura`,
`dependencias`. Não é esquecimento — foi medido: renomeá-los tocaria 77 ocorrências em 18
arquivos, incluindo texto de decisão em `docs/DECISOES.md` e de spike, que são registro histórico
e não se reescrevem por conveniência. O ganho seria marginal: quem chega lê o nome uma vez no
README, com a explicação em inglês ao lado. **Não relitigue isto** — se um dia o custo mudar, vira
decisão nova.

## Texto voltado ao usuário

O CLI nasce em inglês, e configuração de idioma é trabalho futuro (`docs/FORA-DE-ESCOPO.md`).
Para que ela seja extração e não arqueologia: **texto voltado ao usuário fica concentrado, nunca
espalhado em `console.log` pelo meio da lógica.** É a única parte da i18n que custa caro se for
deixada para depois.

# Comandos

```
npm run verificar        # o portão: tipos + lint + camadas + build + cobertura
npm run verificar:linux  # o mesmo portão dentro de um container Linux
npm test                 # unidade + integração + guards
npm run test:e2e         # end-to-end
npm run test:contrato    # contra o ~/.claude real; não roda no CI padrão
npm run format           # prettier
npm run app              # builda o motor e sobe a interface em desenvolvimento (V2-T2)
```

Todos rodam na raiz do monorepo (V2-T1) e cobrem os três pacotes de uma vez. Para instalar o
`seeya` localmente por link (`npm link`), o comando roda dentro de `packages/cli`, não na raiz —
ver `README.md`.

# Desempenho

`docs/DESEMPENHO.md` (V2-T17) tem as quatro medidas atuais do app (tempo até a lista de sessões,
memória em repouso somando toda a árvore de processos, CPU parado, tamanho em disco), o método de
cada uma e a régua: **tarefa de interface que acrescente trabalho em repouso, na subida ou no
tamanho diz o custo na própria especificação**; piora sem essa explicação vira questão em
`docs/QUESTOES.md`.

# O erro clássico neste projeto

Este app depende de estruturas internas e não documentadas do Claude Code. A tentação é
"consertar" um schema que falhou afrouxando a validação. **Não faça isso.** Se um schema falha
contra a realidade, a realidade mudou: registre em `docs/QUESTOES.md` com a saída bruta que
você observou.
