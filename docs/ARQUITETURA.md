# Arquitetura

## Princípio

O núcleo é puro e o mundo é sujo. Toda regra de decisão vive em `core/`, sem I/O, sem
relógio, sem rede, sem processo. Tudo que toca o mundo é um adapter atrás de uma interface
declarada em `core/ports.ts`.

Isso não é preferência estética: é o que torna a pirâmide de testes viável e o que impede o
agente dev de espalhar `child_process.exec` pelo projeto.

## Camadas

```
cli/           ← comandos, parsing de argumento, saída para o terminal
  ↓
application/   ← casos de uso: endDay, startDay, captureSession
  ↓
core/          ← regras puras + interfaces (portas). NÃO importa nada de I/O.
  ↑
adapters/      ← implementam as portas do núcleo
  discovery/       lê ~/.claude/sessions e ~/.claude/projects
  transcript/      parseia o JSONL do transcript
  generation/      chama o claude headless
  notification/    toast por SO
  storage/         ~/.seeya/
  process/         liveness de PID, terminação graciosa
  git/             branch e status do cwd
  clock/           a única fonte de "agora"
scheduler/     ← o daemon; orquestra application/ no tempo
```

## Layout do repositório (monorepo, V2-T1/D-043)

As cinco camadas acima são um diagrama de **dependência**, não de **diretório**: desde a V2-T1
o repositório é um monorepo `npm workspaces` com dois pacotes, e as camadas se distribuem assim:

| pacote | caminho no disco | contém |
|---|---|---|
| `@seeya-ai/engine` | `packages/engine/src/` | `core/`, `application/`, `adapters/`, `scheduler/` |
| `@seeya-ai/cli` | `packages/cli/src/` | `cli/` (sem subpasta própria — os arquivos ficam direto na raiz do pacote) |
| `@seeya-ai/app` | `packages/app/src/` | a interface (D-042, V2-T2) — sem subpasta própria de nível de camada, como `cli/`; ver "A segunda raiz de composição" abaixo |

`@seeya-ai/engine` exporta cada camada por subcaminho (`@seeya-ai/engine/core/...`,
`@seeya-ai/engine/adapters/...`, espelhando os diretórios) — é assim que `packages/cli/src`
importa o que antes importava por `../core/...`. `tests/`, `docs/`, `scripts/`, `.github/` e todo
o ferramental (`eslint`, `prettier`, `dependency-cruiser`, `vitest`, `husky`) continuam na raiz,
comuns aos dois pacotes; os testes resolvem `@seeya-ai/engine` direto para o **fonte**
(`packages/engine/src`), nunca para `packages/engine/dist`, então a suíte nunca depende de build.

**Regra de dependência.** Setas apontam para dentro. Antes da V2-T1, `cli/` era a **única raiz de
composição** (D-020); a D-043 emenda isso: **`cli/` e `app/` são as duas raízes de composição**,
e nenhuma outra — só elas nomeiam adapter concreto e injetam nos demais. A matriz de 20 pares
abaixo continua exaustiva **dentro de `@seeya-ai/engine`** (todos os cinco nomes de camada
seguem valendo, agora lidos como "camada X do motor"), e o `dependency-cruiser` ganhou uma oitava
regra: `packages/cli/src` só pode alcançar `@seeya-ai/engine` pelo mapa de exports do pacote
(`@seeya-ai/engine/<camada>/...`), nunca por caminho relativo cru dentro de
`packages/engine/src` — ver `.dependency-cruiser.cjs`. Verificado por `dependency-cruiser` no
CI, não por boa vontade:

**A matriz é exaustiva de propósito.** São 5 camadas, logo 20 pares ordenados, e todos os 20
estão abaixo. Três rodadas de review de S0-T2 acharam, cada uma, "mais um par que ninguém
listou" — porque a tabela era parcial e "não está na lista" era ambíguo entre *permitido* e
*esquecido*. Aqui não há omissão possível: par que não estiver nesta matriz é erro da matriz, e
vira questão em `docs/QUESTOES.md`.

| De ↓ / Para → | `core` | `adapters` | `application` | `scheduler` | `cli` |
|---|---|---|---|---|---|
| **`core`** | — | ✗ | ✗ | ✗ | ✗ |
| **`adapters`** | ✓ portas | — | ✗ | ✗ | ✗ |
| **`application`** | ✓ | ✗ D-020 | — | ✗ | ✗ |
| **`scheduler`** | ✓ | ✗ D-020 | ✓ | — | ✗ |
| **`cli`** | ✓ | ✓ raiz | ✓ | ✓ | — |

✓ permitido · ✗ proibido · 8 permitidos, 12 proibidos

`core` também não importa `node:*`. Não há ciclos, em nenhuma direção.

Leitura em uma frase: **tudo aponta para `core`; só `cli` conhece implementação; `scheduler`
manda em `application` e nunca o contrário.**

Cada ✗ tem regra no `dependency-cruiser` **e** teste provando a reprovação. Cada ✓ tem teste
provando que não é bloqueado por engano — sem isso, alguém aperta um regex e quebra a raiz de
composição sem ninguém notar.

## A segunda raiz de composição: `@seeya-ai/app` (D-042, D-043, V2-T2)

`packages/app/src` (a interface) é a **segunda** raiz de composição, paralela a `cli/` — não uma
sexta camada da matriz acima, que continua exaustiva só sobre as 5 camadas do motor + `cli`
(`tests/integration/guards/_layer-matrix.ts`/`layer-matrix.test.ts`, inalterados por esta tarefa).
`app/` compõe o motor **no mesmo processo** (o processo principal do Electron), nunca por
subprocesso da CLI — é justamente por isso que existem duas raízes em vez de uma: `cli/` e `app/`
nunca se importam.

Quatro regras próprias no `.dependency-cruiser.cjs`, cada uma com teste dedicado em
`tests/integration/guards/app-boundaries.test.ts` (mesmo "escreva a violação real, rode a
ferramenta de verdade, apague depois" dos testes de `dependency-cruiser.test.ts`):

| Regra | De → Para | Permitido? |
|---|---|---|
| `app-only-imports-engine-public-subpaths` | `packages/app/src` → caminho relativo cru em `packages/engine/src` | ✗ |
| (controle, mesma técnica de `cli`) | `packages/app/src` → `@seeya-ai/engine/<camada>/...` (subcaminho público) | ✓ |
| `engine-does-not-import-app` | `packages/engine/src` (qualquer camada) → `packages/app/src` | ✗ |
| `app-does-not-import-cli` | `packages/app/src` → `packages/cli/src` | ✗ |
| `cli-does-not-import-app` | `packages/cli/src` → `packages/app/src` | ✗ |

**A única duplicação permitida entre as duas raízes é a fiação** — qual adapter concreto entra em
qual porta (`packages/app/src/composition/index.ts`, o espelho de
`packages/cli/src/composition.ts`). Qualquer lógica que as duas raízes queiram reaproveitar sai de
`cli/` e entra no motor (`application/` ou `scheduler/`, pela matriz — nunca por conveniência); a
V2-T2 moveu seis módulos por essa regra: `daemon-state.ts` (→ `scheduler/`, porque importa
`buildDaemonUnhealthyNotice` de `scheduler/notices.ts`, e `application/` não pode importar
`scheduler/`), `autostart-state.ts`, `session-view.ts`, `session-id-display.ts`,
`eligibility-view.ts` e `format-status.ts` (→ `application/`, todos sem dependência de
`scheduler/`). Ver `docs/QUESTOES.md` Q-071 item 5 para o raciocínio de cada um.

**Dois guards de `eslint.config.js` fecham as duas dependências nativas da interface**, com a
mesma técnica de inversão de ônus que já protege `spawn` (D-038) e o relógio (D-019): `electron`
só é importável em `packages/app/src/electron/**` (a fiação que não roda sem tela — também o único
trecho de `packages/app/src` fora do piso de cobertura de 80%, `vitest.config.ts`); `node-pty` só
em `packages/app/src/pty/**`, atrás da porta `PtySpawner` (`pty/pty-port.ts`) que o resto do
pacote depende — uma aba **é** um processo que o seeya lança, e a regra de "invisível por padrão"
(D-038) vale para ela: o ConPTY não abre janela própria (medido no spike M), e a guarda garante que
ninguém contorna o padrão.

## Portas (interfaces do núcleo)

```ts
interface SessionProvider {
  list(): Promise<DiscoveryResult>;   // { sessions, rejected } — ver Q-012
}

interface TranscriptReader {
  readFacts(session: DiscoveredSession): Promise<SessionFacts>;
}

interface HandoffGenerator {
  generate(session: DiscoveredSession, facts: SessionFacts): Promise<GeneratedUnderstanding>;
  // a sessão inteira, não só os fatos: o modo profundo precisa do `sessionId` (Q-019)
}

interface Notifier {
  notify(notice: Notice): Promise<void>;
}

interface Storage {
  saveHandoff(day: Day, handoff: Handoff): Promise<void>;
  readBriefing(day: Day): Promise<Briefing | null>;
  readConfig(): Promise<Config>;
  readHandoff(day: Day, sessionId: string): Promise<Handoff | null>;  // verifica em disco antes de terminar (D-002, Q-021)
  saveState(state: DayState): Promise<void>;
}

interface ProcessControl {
  isAlive(pid: number, procStart?: string): Promise<boolean>;
  terminateGracefully(pid: number, deadlineMs: number): Promise<boolean>;
  terminateAbruptly(pid: number): Promise<void>; // só para o próprio daemon do seeya (V2-T5b)
}

interface Clock {
  now(): Date;
}

interface DirectoryExistence { // V2-T9, adapters/filesystem/
  exists(path: string): Promise<boolean>;
}

interface AppInstallation { // V2-T13, adapters/installation/ (D-045 item 2)
  find(): Promise<AppInstallationStatus>; // installed (com o caminho) / notInstalled / unknown
}

interface WorkspaceRepository { // V2-T27/V2-T28, adapters/workspace/
  isInitialized(root: string): Promise<boolean>;
  initialize(root: string): Promise<void>; // git init
  projectExists(root: string, projectId: string): Promise<boolean>;
  writeProjectSkeleton(root: string, projectId: string, skeleton: ProjectSkeleton): Promise<void>;
  writeProjectManifest(root: string, projectId: string, manifest: ProjectManifest): Promise<void>; // V2-T28: só seeya.json
  commitAll(root: string, message: string): Promise<void>; // git add -A + commit; no-op sem diff
  listProjects(root: string): Promise<{ manifests: ProjectManifest[]; rejected: RejectedDiscoveryRecord[] }>;
  readProjectManifest(root: string, projectId: string): Promise<ProjectManifest | null>;
}

interface HarnessLauncher { // V2-T28, adapters/harness/
  open(cwd: string, addDirs: readonly string[]): Promise<HarnessOpenResult>; // stdio inherit, nunca headless
}
```

Nos testes, cada porta tem um duplo em memória. Nenhum teste unitário toca disco.

### `installation/` (V2-T13, D-045 item 2)

Descobre se o app está instalado, pelo registro do próprio sistema operacional — nunca por um
arquivo do `seeya`. Um adaptador por SO, escolhido por `process.platform`, mesmo formato de
`adapters/autostart/`:

- **Windows:** lê a entrada de desinstalação que o NSIS cria — em **três** raízes de registro, não
  só uma: `HKCU\...\Uninstall` (instalação por usuário, o padrão deste projeto), `HKLM\...\
  Uninstall` e `HKLM\...\WOW6432Node\...\Uninstall` (instalação por máquina, opção do próprio
  instalador — o registro fica só em HKLM, nunca em HKCU, achado do mantenedor durante a tarefa),
  procurando pelo `DisplayName` do produto em qualquer uma das três. O caminho do executável sai de
  `InstallLocation` quando presente, senão do diretório de `UninstallString`, senão de
  `DisplayIcon` — **medido**: no NSIS por usuário, `InstallLocation` veio vazio e o caminho real só
  existia em `UninstallString`; no NSIS por máquina, `InstallLocation` E `UninstallString` vieram
  ambos vazios, e só `DisplayIcon` carregava o caminho (docs/QUESTOES.md Q-081, os dois achados).
  Falhando os três, o resultado é `unknown`, nunca um caminho inventado (D-025).
- **Linux:** pergunta ao `dpkg` pelo pacote (`dpkg-query`). Um `AppImage` nunca aparece nesse
  banco, então "não instalado" sai da própria consulta, sem tratamento especial (D-045: "AppImage
  nunca é dono"). Não medido contra um `.deb` real (mesma ressalva de `adapters/autostart/
  linux.ts`, S5-T1/Q-067).
- **macOS:** procura o `.app` em `/Applications`. Não medido (mesma ressalva de `adapters/
  autostart/macos.ts`).

`AppInstallationStatus.unknown` (a consulta ao SO falhou) nunca vira `notInstalled` — D-025.
`application/daemon-ownership.ts#resolveDaemonOwner` é a única função que lê este resultado e o
transforma em `DaemonOwner` (`app` / `cli` / `unknown`); nenhum outro módulo decide posse do
daemon por conta própria.

## Decisões técnicas por adapter

### `discovery/`
Lê `~/.claude/sessions/*.json`, valida com zod, filtra por liveness (`ProcessControl`) e
resolve o caminho do transcript. O slug do diretório em `~/.claude/projects/` é derivado do
`cwd`; a derivação é frágil, então a estratégia primária é **procurar o arquivo
`<sessionId>.jsonl` em todos os slugs**, e a derivação do slug é só otimização.

Duas responsabilidades que vieram do Spike A e são fáceis de esquecer:

- **Excluir os forks do próprio `seeya`** listados em `forks.json`, sob pena de laço de
  realimentação (D-012).
- **Transcript ausente não desqualifica a sessão** (D-013). A sessão entra com
  `hasTranscript: false` e dispara a notificação de detecção precoce, uma vez por `sessionId`.

Na v2 este adapter passa a ter duas origens — registro e wrapper PTY — e precisa deduplicar por
`sessionId` (D-014). A interface já é desenhada para isso: `list()` devolve a união, não a
concatenação.

### `transcript/`
Streaming linha a linha (arquivos passam de 1 MB). Ignora tipos desconhecidos em vez de falhar
— o Claude Code adiciona tipos novos com o tempo. Extrai só o que a spec pede.

### `git/`
Mais importante do que parecia. Além de branch e status do `cwd`, enumera **worktrees**
(`git worktree list --porcelain`) com branch, sujeira e commits do dia de cada um, e lista os
commits do dia. Para sessões sem transcript, esta é a única fonte substantiva (D-013). Não
quebra quando o `cwd` não é repositório: devolve "sem git" e segue.

**`readRemoteUrl` (V2-T28).** `git remote get-url origin` num diretório qualquer — a leitura que
`seeya project add-repo` usa para descobrir a identidade de um clone local. `null` cobre todo caso
de "sem remoto resolvível" (não é repositório, é repositório mas sem `origin`, ou o comando falha)
igualmente: nunca lança, e a distinção entre esses três casos não importa para quem chama (D-025).

### `generation/`
Duas implementações da mesma porta, escolhidas por config (D-011):

- **Enxuta (padrão).** Monta o contexto a partir das evidências já coletadas e chama
  `claude -p` numa sessão nova. ~US$ 0,15/sessão.
- **Profunda (opt-in).** `claude -p --resume <id> --fork-session`. ~US$ 0,50/sessão, melhor
  entendimento. Registra o `sessionId` do fork em `forks.json` (D-012).

Regras comuns, todas com origem em spike e todas testadas:

- `spawn` com array e `shell: false` — os `cwd` têm espaços e acentos.
- **Contexto por stdin ou arquivo temporário, nunca por argumento** (D-015).
- `--tools ""`, `--system-prompt` curto e `--json-schema` do handoff: derruba o piso de ~12 k
  tokens e evita saída em prosa livre.
- Timeout duro e `--max-budget-usd`.
- Erro tipado. Quem decide o fallback é `application/`, não o adapter.

### `notification/`
Adapter por plataforma, escolhido em runtime. Conforme o Spike B:

- **Windows:** WinRT via PowerShell, **sem dependência alguma**. Carregar explicitamente
  `Windows.UI.Notifications.ToastNotificationManager` **e**
  `Windows.Data.Xml.Dom.XmlDocument` — omitir o segundo falha com erro que aponta para o tipo
  errado.
- **macOS:** `terminal-notifier` se presente, senão `osascript -e 'display notification'`.
- **Linux:** `notify-send`; fallback stderr.

Cada backend implementa `isAvailable()`. A seleção é uma cadeia de fallback testável em
unidade com backends falsos.

**Contrato mínimo sem ações.** Ações clicáveis são capacidade opcional (`supportsActions()`), nunca
pressuposto. No Windows, se forem implementadas, o caminho é `activationType="protocol"` com
esquema `seeya://` registrado em `HKCU\Software\Classes` — evita servidor COM e processo
residente. Não validado; ver S4-T1.

### `storage/`
Raiz injetada (nunca `os.homedir()` direto no código de negócio). Escrita atômica. Todo arquivo
lido passa por zod. `schemaVersion` em todo documento persistido, com migração explícita.

`readRepositoryMap`/`saveRepositoryMap` (V2-T28) seguem a mesma convenção de `readWorkspaceRoot`/
`saveWorkspaceRoot`: um documento pequeno, escrito só pelo próprio `seeya`
(`repository-map.json`), sem a tolerância item-a-item do D-022 — essa regra é para coleção
externa, e nenhuma entrada deste arquivo chega de fora.

### `clock/`
Um único módulo produz `now()`. Nenhum outro arquivo do projeto pode chamar `new Date()`,
`Date.now()` ou `setTimeout` com prazo longo — imposto por regra de lint.

### `workspace/` (V2-T27)

Escreve no espaço de trabalho — o repositório git que o `seeya` cria e administra
(`docs/V2-RUMO.md` § "Um repositório para todos os projetos"), distinto do repositório da própria
sessão (`git/`, só leitura) e distinto de `~/.seeya/` (`storage/`). Um adaptador só
(`FsWorkspaceRepository`), sem escolha por plataforma:

- **Reusa `adapters/git/run-git.ts#runGit`** para `init`/`add`/`diff`/`commit` — nenhuma
  dependência nova de git. `runGit` ganhou um terceiro parâmetro opcional (`env`), só para o
  `commitAll` poder fixar a identidade do commit (`GIT_AUTHOR_NAME`/`_EMAIL` etc., sempre
  `seeya`/`seeya@localhost`, nunca o `git config user.*` da máquina) sem tocar nos chamadores
  existentes, que continuam com dois argumentos.
- **`commitAll` nunca cria commit vazio.** `git add -A`, depois `git diff --cached --quiet`: saída
  0 é "nada mudou" (retorna sem commitar); qualquer outra coisa segue para o commit de verdade.
- **`listProjects` segue D-022**: cada subdiretório do espaço de trabalho com um `seeya.json` é
  lido e validado individualmente; um que não parseia vira `RejectedDiscoveryRecord`, os outros
  continuam. Um subdiretório sem `seeya.json` nenhum não é projeto — nem aceito, nem rejeitado
  (D-025).
- **`readProjectManifest` (leitura única, `seeya project show`) não segue D-022**: um `seeya.json`
  malformado lança, em vez de virar rejeição silenciosa — mesma distinção que `storage/`'s own
  `readHandoff`/`listHandoffs` já fazem para o mesmo par leitura-única/coleção.
- **Reusa `adapters/storage/atomic-write.ts#writeFileAtomic`** para cada arquivo do esqueleto —
  mesma escrita atômica que `~/.seeya/` já tem, aplicada aqui ao espaço de trabalho.
- **`writeProjectManifest` (V2-T28)** reescreve só o `seeya.json` de um projeto que já existe —
  extrai o mesmo trecho de serialização que `writeProjectSkeleton` já usava para esse arquivo, sem
  tocar nos outros arquivos do esqueleto nem recriar diretórios.

### `harness/` (V2-T28)

Abre o harness escolhido (só `claude` nesta tarefa) fora de qualquer sessão existente —
`seeya project open`, distinto de `adapters/resumption/` (que sempre `--resume` um `sessionId`
específico). Um adaptador só (`ClaudeHarnessLauncher`), sem escolha por plataforma:

- **Reusa `adapters/resumption/spawn-interactive.ts#runInteractive` e `env.ts
  #buildResumptionEnv`** — o mesmo `stdio: 'inherit'` (docs/spikes/H-retomada-interativa.md) e a
  mesma sanitização de ambiente (D-017), sem duplicar nenhum dos dois. Import de adapter para
  adapter, permitido pela matriz (só `application/`, `cli/` e `scheduler/` são restritos ao
  acessar `adapters/`).
- **`adapters/harness/args.ts#buildOpenArgs`** monta `--add-dir <dir...> --` sempre que há algum
  diretório associado — o gotcha que `docs/spikes/N-adocao-de-sessao.md` mediu (`--add-dir` é
  variádico e engole o próximo argumento posicional sem um `--` explícito terminando a lista).
  `open` nunca passa um prompt depois, mas termina a lista mesmo assim: um argumento futuro nessa
  posição não pode reintroduzir o mesmo bug.

## Fusos e horários

O horário de encerramento é um horário local ("19:30"), não um instante. A conversão para
instante acontece por dia, no fuso do sistema, o que trata mudança de horário de verão de
graça. Nada de guardar epoch para "o horário de encerramento".

## Config

`~/.seeya/config.json`

```jsonc
{
  "schemaVersion": 1,
  "endOfDayTime": "19:30",     // ILUSTRAÇÃO de formato; o default é `null` (Q-013)
  "leadTimesInMinutes": [30, 15],
  "relevanceHours": 12,
  "idleMinutes": 45,
  "captureModel": "sonnet",
  "budgetPerSessionUsd": 0.25,
  "captureConcurrency": 3,
  "ignore": ["c:\\code\\rascunhos"],
  "projectPolicy": {
    "c:\\code\\projeto": { "canTerminate": true }
  }
}
```
