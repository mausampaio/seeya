---
id: TASK-15
title: V2-T23 — Autostart congela o ambiente inteiro
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels: []
milestone: m-1
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: bug
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T23 — Correção: o autostart congela o ambiente inteiro do app, inclusive coisas que só
valem naquele login.** Especificada pelo PO em 2026-09-20 a partir de uma medição do
mantenedor no Mac dele, no mesmo dia — o primeiro `cat` que alguém deu no arquivo de
autostart gerado.

**O defeito, medido.** Ligando o autostart pela janela no macOS, o arquivo criado
(`~/Library/LaunchAgents/com.seeya.daemon.plist`) está certo no essencial — aponta para o
executável dentro do `.app`, passa o `index.js` da CLI, tem `ELECTRON_RUN_AS_NODE=1` e
`RunAtLoad`. **Mas o bloco de ambiente é uma fotografia do processo do app**, e leva junto:

- `SSH_AUTH_SOCK`, apontando para um socket em `/private/tmp/...` **daquele login** — no
  próximo login o caminho não existe mais. O daemon roda `git` durante a captura, e um
  `SSH_AUTH_SOCK` morto é exatamente o que faz `git` sobre SSH pendurar ou falhar sem
  explicação;
- `TMPDIR`, também por login (`/var/folders/...`);
- `XPC_SERVICE_NAME`, `XPC_FLAGS`, `__CFBundleIdentifier`, `__CF_USER_TEXT_ENCODING`,
  `MallocNanoZone`, `COMMAND_MODE` — estado interno do lançamento daquele processo, que não
  significa nada num job novo;
- `USER`, `LOGNAME`, `HOME`, `SHELL`, que o próprio sistema já define;
- `PATH` congelado, incluindo a versão de Node de um gerenciador de versões — se ela mudar
  de lugar, o `PATH` do autostart continua apontando para o caminho velho.

**Causa.** `packages/app/src/composition/index.ts` passa `daemonLaunchTarget.env` — o ambiente
**inteiro** já limpo das variáveis de sessão (D-017) — como `AutostartLaunchOptions.env`, e
cada adaptador escreve o que recebe: `plist` no macOS, `set K=V&&` no Windows
(`windows-scripts.ts`), e o equivalente no Linux. O que serve para um `spawn` que acontece
**agora** não serve para um registro que vai ser lido **daqui a semanas**, num login diferente.
É a mesma lição da D-017 ("monte o ambiente explicitamente"), aplicada ao caso que ela não
previa: ambiente que vai para disco.

**O que entra:**
1. **Uma lista explícita do que o autostart carrega**, com o porquê de cada variável ao lado,
   e nada além dela: hoje isso é `ELECTRON_RUN_AS_NODE` (sem ele, o login abriria a janela em
   vez do daemon) e o `PATH` (o daemon precisa achar `claude` e `git`; o `PATH` de um job de
   login é mínimo nos três sistemas). Toda variável de socket, de diretório temporário, de
   XPC e de identidade de usuário sai.
2. **A regra vale para os três adaptadores**, não só o macOS — a mesma fotografia chega ao
   Windows e ao Linux pelo mesmo caminho.
3. **O `PATH` congelado fica registrado como limite conhecido**, com uma linha no documento
   dizendo o que acontece se ele mudar (e como refazer: desligar e ligar o autostart). Não
   inventar releitura de `PATH` em tempo de login nesta tarefa — isso é trabalho próprio, e a
   V2-T8 já mediu como esse assunto é traiçoeiro fora do Windows.
4. **Teste** que prove a lista: uma variável fora dela nunca aparece no arquivo gerado, nos
   três adaptadores.

5. **O autostart deixa de falhar em silêncio.** Medido no mesmo dia: quando o login não
   consegue subir o daemon (foi o que aconteceu no Mac, pela recusa que a V2-T22 corrigiu),
   **não sobra rastro nenhum** — o arquivo gerado não guarda saída em lugar algum, e a única
   forma de descobrir foi rodar o comando à mão. O registro de autostart passa a guardar a
   saída do que ele lança, dentro de `~/.seeya/` (a única raiz onde o projeto escreve), com
   o mesmo cuidado nos três sistemas. **Não inventar logger** (`AGENTS.md` § "Registro e
   saída"): é um arquivo de saída do processo lançado, não um sistema de log.

**O que não entra:** reler o `PATH` no login; mudar o mecanismo de autostart de qualquer
sistema; qualquer coisa do daemon fora do registro de autostart.

**Cuidados:** nenhuma dependência nova; **nenhum agente escreve no autostart real** — os três
adaptadores já são testados por dublê, e é assim que esta tarefa se prova; nada do `~/.seeya`
real, do registro ou do `~/Library/LaunchAgents` real é tocado.

**Aceite do mantenedor:** desligar e ligar o autostart, e o arquivo gerado conter só as
variáveis da lista.

**Relatório (agente, 2026-09-20).** Branch `tarefa/V2-T23-ambiente-do-autostart` a partir da
`main` (commit `bfa644b`). Um commit: `b8631b9`.

**Item 1 (a lista explícita).** `AUTOSTART_ENV_VAR_ALLOWLIST` e `buildAutostartEnv`
(`packages/engine/src/adapters/autostart/env.ts`, novo) — `ELECTRON_RUN_AS_NODE`/`PATH`, com
o porquê de cada um no próprio docstring (a mesma explicação que já estava na spec). Vive em
`adapters/`, não em `core/`, seguindo o precedente de `adapters/resumption/env.ts#buildResumptionEnv`/
`adapters/generation/env.ts#buildGenerationEnv` — funções puras de ambiente que já moram ao
lado de quem as usa, não em `core/`, porque `NodeJS.ProcessEnv` é um tipo de processo, não um
conceito de domínio.

**Item 2 (vale para os três adaptadores).** `buildAutostartEnv` é chamada duas vezes no
caminho de um clique até o arquivo escrito: uma vez em
`packages/app/src/composition/index.ts#enableAppAutostart` (a causa medida, agora corrigida —
não passa mais `daemonLaunchTarget.env` inteiro) e de novo dentro do `enable()` de cada um dos
três adaptadores (`macos.ts`/`linux.ts`/`windows.ts`), como defesa em profundidade: um
chamador futuro que esquecer de filtrar (a CLI, por exemplo, se um dia passar `env`) não
consegue escrever mais que a lista de qualquer forma. Testado nos dois pontos: `env.test.ts`
(a função pura, isolada) e um teste por adaptador (`macos.test.ts`/`linux.test.ts`/
`windows.test.ts`) que passa uma fotografia realista de login (`SSH_AUTH_SOCK`, `TMPDIR`,
`XPC_*`, `USER`/`HOME`/`SHELL`) e confere que só `ELECTRON_RUN_AS_NODE`/`PATH` chegam ao
arquivo/unit/script gerado — o item 4 da spec.

**Item 3 (o `PATH` congelado como limite conhecido).** Registrado no próprio docstring de
`buildAutostartEnv` (o remédio: desligar e ligar o autostart de novo, que relê o ambiente do
chamador na hora) e, com mais contexto, na entrada do glossário de `AGENTS.md` §
"Identificadores que vão para disco" (linha nova para `autostart.log`, que também documenta
o mecanismo por SO). Nenhuma releitura de `PATH` em tempo de login foi inventada.

**Item 5 (saída sem falhar em silêncio).** `AUTOSTART_OUTPUT_LOG_FILE_NAME = 'autostart.log'`
(mesmo módulo `env.ts`) — um arquivo, raiz de `~/.seeya/`, `seeyaHome` injetado (novo
parâmetro obrigatório de `buildAutostart`, D-027, threaded pelos dois composition roots).
Mecanismo nativo de cada SO, nunca um logger novo (`AGENTS.md` § "Registro e saída"):
- **macOS**: `StandardOutPath`/`StandardErrorPath` no plist, os dois apontando para o mesmo
  arquivo (launchd não trunca entre execuções).
- **Linux**: `StandardOutput=append:`/`StandardError=append:` no `[Service]` do unit —
  `append:` existe desde o systemd 240; ver Q-082 para o que isso implica numa distro mais
  velha.
- **Windows**: o `cmd.exe /c "..."` que já envolvia o lançamento quando havia `env` passa a
  envolver **sempre**, para acrescentar `>> "<caminho>" 2>&1` ao fim do comando —
  `New-ScheduledTaskAction` não tem parâmetro de redirecionamento próprio, mesma razão que já
  valia para o `env`.

Nenhum dos três mecanismos de saída foi reexecutado contra o sistema real (proibido nesta
tarefa); Q-082 registra o que ficou sem medir e o nome escolhido para o arquivo, que a spec
não fixava.

**Portão (Windows, primeiro plano):** `format:check` verde; `tsc -p tsconfig.json --noEmit`
verde; `lint` verde; `build` verde; `dependencias` verde (366 módulos, 998 dependências, sem
violação); `cobertura` verde na primeira tentativa completa (201 arquivos de teste, 2.083
testes passando, 4 pulados; 96,46%/92,59%/95,09%/96,83% geral;
`packages/engine/src/adapters/autostart` 91,82%/90,90%/84,44%/92,35%, acima do piso de 80%
dos três arquivos por SO). `tests/integration/app/composition.test.ts` flacou uma vez sob
`--coverage` em paralelo com o resto da suíte (Q-081, instabilidade já conhecida — dois casos
estouraram 5000ms; passam sozinhos, e passaram também na segunda rodada completa do
`npm run verificar`) — não reproduzido no `npm run verificar` que fechou a tarefa.
`verificar:linux` não rodado (mesmo limite de memória do host já registrado em tarefas
anteriores; CI cobre).

**Questão aberta:** Q-082 (o nome do arquivo de saída, escolhido sem espec explícita, e o que
ficou sem medir contra um sistema real em cada SO).

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 201 arquivos, 2.083 testes
passando, 4 pulados; cobertura 96,46%/92,59%/95,09%/96,83%). Revisão sem ajustes.
**Limite conhecido que o PO registra junto:** o `autostart.log` **cresce sem rotação**. Na
prática são poucas linhas por login; num daemon que entre em ciclo de falha, engorda. Fica
escrito para não virar surpresa — rotação é trabalho próprio, e só se pagará se alguém
medir o arquivo grande de verdade. Fica em `[~]` até o aceite do mantenedor.

**Aceite do mantenedor em 2026-09-21 (Windows), conferido pelo PO no registro real.** Depois
de desligar e ligar o autostart pela janela, a tarefa `SeeyaDaemonAutostart` ficou com a
ação `cmd.exe /c "set ELECTRON_RUN_AS_NODE=1&& conhost.exe --headless <seeya.exe> <cli>
daemon >> <~/.seeya>utostart.log 2>&1"`. **A fotografia do ambiente sumiu** — nenhuma
variável da sessão foi para o registro — e a saída do processo agora tem destino.

**Achado da conferência: o `PATH` não foi, e por um motivo que o teste não pegava.** A lista
é `['ELECTRON_RUN_AS_NODE', 'PATH']` comparada com diferença de maiúsculas, e no Windows a
variável se chama `Path`. Resultado: no Windows ela é sempre descartada. **Na prática isso
acerta por acidente** — uma tarefa agendada no logon recebe o ambiente vivo do usuário,
inclusive o `Path` atual, então não congelar é melhor do que congelar, e o daemon continua
achando `claude` e `git`. Mas o código afirma uma coisa e faz outra, e isso não pode ficar
por acidente: na próxima tarefa que tocar o autostart, tornar a regra explícita (no Windows,
não carregar o `Path`, com o porquê ao lado; nos outros sistemas, carregar `PATH`) e testar
com o nome real de cada sistema.
<!-- SECTION:DESCRIPTION:END -->
