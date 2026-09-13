# Spike M — O terminal embutido: Electron, `@xterm/xterm` e `node-pty` numa aba

**Data:** 2026-09-13 · **Plataforma medida:** Windows 11, build 10.0.26200 · **Tarefa:** V2-T0 ·
**Decisão em jogo:** D-042 · **Versões:** Node 22.19.0, Electron 44.3.0, `@xterm/xterm` 6.0.0,
`@xterm/addon-fit` 0.11.0, `node-pty` 1.1.0, `claude` 2.1.270, `codex-cli` 0.154.0
(`gpt-5.6-sol`, esforço `low`).

## A hipótese

A D-042 apostou em Electron + `xterm.js` + `node-pty` sem medir: "Tauri" caiu por raciocínio
(três runtimes), o terminal do sistema caiu por raciocínio (gerir N terminais por SO). Este spike
é a primeira medição de verdade da aposta que sobrou — sobe no Windows, aceita os dois harnesses
que o projeto já usa, e não viola D-038? O Linux, que é o dia a dia do mantenedor, fica fora desta
rodada (ver "O que não foi medido").

## Controles de contaminação

- **Protótipo fora do repositório**, em `C:\code\seeya-spike-M`, descartável — nada dali entra em
  `git` do seeya. Só este registro é commitado.
- **`process.env` contaminado pela própria sessão de agente.** A primeira tentativa de lançar o
  `claude` herdou `CLAUDE_CODE_CHILD_SESSION` e mais cinco variáveis de sessão (mesmo achado do
  spike H/D-017, agora contra um harness embutido) — a saída mostrou "Transcript saving is off",
  o que teria mascarado o item 5 (identidade) inteiro se não fosse pego. Todas as medições daqui
  em diante removem qualquer variável `CLAUDE*`/`AI_AGENT` do ambiente antes de cada `pty.spawn`.
- **Diretórios de trabalho descartáveis** em `%TEMP%`, um por rodada, nunca um projeto real.
- **Sem olho humano na tela durante a medição** (a sessão que mediu é este agente, sem display
  interativo): toda verificação visual (cores, caixas, redraw) foi feita por
  `webContents.capturePage()` — um PNG salvo e **lido pelo próprio agente**, não inferido do fluxo
  bruto de bytes. Onde isso não bastou, está declarado abaixo.

## Procedimento

Protótipo mínimo (`main.js`, `preload.js`, `index.html`, `renderer.js`): uma janela Electron, abas
de `xterm.js`, um `node-pty` por aba, IPC para `create`/`write`/`resize`/`kill`. Para não depender
de clique manual, uma instrumentação **só do spike** (variáveis de ambiente `SPIKE_AUTO_TABS_FILE`,
`SPIKE_RAW_LOG_DIR`, `SPIKE_SCREENSHOT_PATH`, `SPIKE_QUIT_AFTER_MS`) abre abas com um roteiro de
`{after: ms, data | resize}` pré-programado — o mesmo texto e as mesmas teclas que uma pessoa
digitaria, sem GUI automation. Contagem de janelas visíveis por `EnumWindows`/`IsWindowVisible`
via P/Invoke (mesma técnica da Q-067), diferença antes/depois. Memória somada pela árvore de
processos (`Win32_Process`, `WorkingSetSize`) a partir do PID principal do Electron.

## Resultado medido, item por item

| # | Item | Medido |
|---|---|---|
| 1 | Montagem | ✅ sobe sem compilar nada nesta máquina |
| 2 | `claude` na aba | ✅ TUI, entrada, resize, cores, Ctrl+C, `onExit` — tudo confirmado |
| 3 | `codex` na aba | ✅ idem, com uma diferença de submissão de texto (ver abaixo) |
| 4 | D-038 (sem janela extra) | ✅ só a janela do Electron aparece; ConPTY não abre console |
| 5 | Identidade (`~/.claude/sessions/`) | ✅ `cwd` bate com o diretório da aba, igual a sessão comum |
| 6 | Custo de memória (1 vs 3 abas) | ✅ medido; custo marginal por aba é pequeno |

### 1. Montagem

`npm init -y`, depois três instalações, todas em segundos, nesta máquina:

- `electron@44.3.0`: `npm install` resolveu em 3s; o binário (`electron-v44.3.0-win32-x64.zip`,
  ~158 MB) baixou junto, também em poucos segundos (conexão rápida desta máquina — não é uma
  medição de banda genérica).
- `@xterm/xterm@6.0.0` e `@xterm/addon-fit@0.11.0`: 2s, sem nativo.
- `node-pty@1.1.0`: 2s, **sem compilar**. O pacote já vem com `prebuilds/` para
  `win32-x64`, `win32-arm64`, `darwin-x64` e `darwin-arm64` (binário N-API, `napi_build_version`
  estável entre runtimes) — o mesmo `.node` carregou sem erro tanto num `node` puro (ABI 127)
  quanto dentro do processo principal do Electron (ABI 149), confirmando que a promessa do N-API
  de não depender da ABI específica do host se sustenta na prática, não só em teoria.
- Ferramentas de build **não foram tocadas**: `cl.exe`/`msbuild` não estão no `PATH` desta
  máquina, e não precisaram estar — o `install` do `node-pty` tenta `scripts/prebuild.js` antes
  de cair em `node-gyp rebuild`, e o prebuild bateu. Python 3.14.6 está instalado, mas não entrou
  em uso.
- **Achado que muda o que o mantenedor precisa saber:** o pacote publicado de `node-pty` **não
  inclui prebuild para `linux-x64`/`linux-arm64`** (conferido no conteúdo do pacote baixado, não
  rodado em Linux). No Linux — que é justamente o SO que falta medir — o `npm install` deste
  mesmo protótipo provavelmente vai cair no `node-gyp rebuild`, e isso exige toolchain de
  compilação (`gcc`/`g++`/`make`, Python) na máquina do mantenedor. **Isto é inferência a partir
  do conteúdo do pacote, não medição em Linux** — ver "O que não foi medido".
- Tempo total, do `npm init` ao primeiro `npm start` funcionando: poucos minutos, quase todo gasto
  em iteração de roteiro de teste, não em resolver a montagem em si.

### 2. `claude` na aba

Lançado via `pty.spawn` **dentro do processo principal do Electron** (não do renderer), com
`useConpty: true`, `TERM=xterm-256color`, `cwd` num diretório `%TEMP%` descartável.

- **TUI abre:** sim — confirmado por captura de tela real da janela (logo, moldura, prompt).
- **Aceita entrada:** sim. Um detalhe não previsto: a primeira execução numa pasta nova mostra
  uma pergunta de confiança ("Quick safety check… No, exit / Yes, I trust this folder") antes de
  aceitar qualquer prompt — só depois de navegar essa tela (seta + Enter) o `say ok` chegou. Sem
  tratar essa tela, o primeiro prompt enviado é engolido por ela e o processo sai
  (`exitCode=1`) — foi exatamente o que aconteceu na primeira tentativa deste spike.
- **Redimensiona sem quebrar:** sim — `pty.resize(120, 40)` no meio da sessão não gerou erro nem
  interrompeu a UI; a tela seguinte já veio na largura nova.
- **Cores e caixas corretas:** sim, **confirmado visualmente** (captura de tela lida pelo agente):
  o logo em bloco laranja, a caixa de prompt, a resposta e a barra de status renderizaram
  corretamente.
- **Ctrl+C chega ao processo:** sim — o primeiro Ctrl+C (`\x03` escrito no pty) não matou a sessão;
  o `claude` reagiu como reage a um Ctrl+C de teclado de verdade, mostrando
  "Press Ctrl-C again to exit" em vez de morrer — prova de que o byte chegou à aplicação em
  primeiro plano, não só ao tratamento padrão do SO.
- **Saída detectada (`onExit`):** sim — ao enviar `/exit`, o `onExit` dos `node-pty` disparou com
  `exitCode=0`, e a resposta ao prompt "say ok" apareceu antes disso ("● ok", "Cooked for 1s").
- **Prompt real de custo mínimo:** "say ok" enviado e respondido, sessão encerrada pelo caminho
  normal (`/exit`), como pedia o roteiro.

### 3. `codex` na aba

Mesmo roteiro, com `codex.cmd` (o shim do npm no Windows) passado direto para `pty.spawn`, sem
`shell: true` — funcionou sem embrulhar em `cmd.exe /c`, o que não é garantido em
`child_process.spawn` comum para `.cmd`; **medido, não explicado a fundo**.

- **TUI abre:** sim — confirmado por captura de tela (moldura "OpenAI Codex", modelo, diretório).
- **Aceita entrada:** sim, **com uma diferença medida em relação ao `claude`**: escrever o texto e
  o Enter (`"say ok\r"`) numa única chamada de `write` foi **engolido** — o texto apareceu digitado
  na caixa, mas o `\r` virou quebra de linha dentro da caixa em vez de enviar (aparenta ser uma
  proteção contra colar texto multilinha). Escrever o Enter **numa chamada separada**, um instante
  depois, funcionou normalmente. **Achado relevante para qualquer ponte de entrada que o seeya
  venha a construir:** mandar o Enter como escrita própria funciona para os dois harnesses;
  concatenar texto e Enter numa escrita só funciona só para o `claude`.
- **Redimensiona sem quebrar:** sim, mesma verificação do item 2.
- **Cores e caixas corretas:** sim, confirmado visualmente (captura de tela): moldura, cores
  discretas do tema do Codex, indicador de "renaming…" da sessão.
- **Ctrl+C chega ao processo:** sim — e aqui a UX difere da do `claude`: um único Ctrl+C a partir
  do prompt ocioso já disparou "Shutting down…" e o encerramento completo, sem etapa de
  confirmação.
- **Saída detectada (`onExit`):** sim, `exitCode=0`; o `codex` ainda imprime um resumo de uso de
  tokens e uma dica `codex resume <id>` na saída — o encerramento por Ctrl+C aqui **é** o caminho
  normal, não um caminho de emergência.
- **Prompt real de custo mínimo:** "say ok" enviado (na segunda tentativa, com o Enter em escrita
  separada) e respondido ("● ok").

### 4. D-038 (nenhuma janela de console extra)

Enumeração de janelas visíveis (`EnumWindows`/`IsWindowVisible`, técnica da Q-067) antes de abrir
o app, com uma aba do `claude` rodando, e depois de encerrar:

- **Antes:** 8 janelas visíveis nesta máquina (apps do dia a dia, nada do spike).
- **Durante** (aba do `claude` aberta e ativa): **9 janelas** — a única nova é `spike-m`, o
  `BrowserWindow` do próprio protótipo. Nenhuma janela de console, nenhum flash.
- **Depois de encerrar:** de volta a 8 janelas; nenhum processo `electron.exe` sobrando.
- **Olhando a árvore de processos** (`Win32_Process`, cadeia de pais a partir do PID do Electron):
  existe, sim, um `conhost.exe` filho direto do processo principal — é o hospedeiro do
  pseudoconsole do ConPTY. Ele **existe como processo, mas nunca abre janela** — bate exatamente
  com a premissa da D-038 ("ConPTY cria pseudoconsole; o que aparece na tela é só a janela do
  Electron"), e a diferença entre "processo" e "janela" ficou visível na prática, não só na teoria.

### 5. Identidade (`~/.claude/sessions/`)

Com o `claude` rodando (aba ativa, ambiente limpo das variáveis de sessão), o arquivo
`~/.claude/sessions/<pid>.json` apareceu com o `cwd` **exatamente igual** ao diretório passado ao
`pty.spawn` da aba — o mesmo mecanismo que a descoberta do seeya já usa para uma sessão aberta num
terminal comum, sem nenhuma adaptação. Estrutura (achatada, com o identificador de máquina
suprimido):

```json
{
  "pid": 19060,
  "sessionId": "<uuid>",
  "cwd": "C:\\Users\\<usuario>\\AppData\\Local\\Temp\\<pasta-do-teste>",
  "kind": "interactive",
  "entrypoint": "cli",
  "status": "idle"
}
```

Reproduz o achado do spike G: essa entrada é **efêmera** — some quando a sessão sai pelo caminho
gracioso (`/exit`), e nas rodadas que terminaram sem passar por um turno de conversa completo
(mortas pelo `SPIKE_QUIT_AFTER_MS` do próprio harness de teste) o transcript em
`~/.claude/projects/<pasta>/` **nem chegou a ser criado** — só apareceu nas rodadas em que o
`claude` completou uma resposta e saiu por `/exit`. Isso é uma medição sobre esta máquina/versão,
não algo verificado a fundo contra a documentação do produto.

### 6. Custo de memória (1 aba vs 3 abas)

Soma de `WorkingSetSize` de toda a árvore de processos a partir do PID principal do Electron
(`Win32_Process`), ~6-8s depois do lançamento, antes de qualquer encerramento:

| Cenário | Processos | Memória total |
|---|---|---|
| 1 aba, shell vazio (`cmd.exe`) | 6 (4× `electron.exe`, 1× `conhost.exe` do ConPTY, 1× `cmd.exe`) | **342,2 MB** |
| 3 abas, shell vazio (`cmd.exe` × 3) | 10 (os mesmos 4 do Electron + 3× `conhost.exe` + 3× `cmd.exe`) | **393,8 MB** |
| 1 aba com `claude` de verdade (ocioso, prompt aceito) | 6 (os mesmos 4 do Electron + 1× `conhost.exe` + 1× `claude.exe`) | **604,2 MB** |

**Leitura:** o custo fixo do Electron (processo principal + GPU + utilitário de rede + renderer)
gira em torno de 340-350 MB **antes de qualquer aba fazer algo**, e é praticamente constante entre
os três cenários. O custo **marginal** de cada aba adicional com um shell vazio é pequeno — na
faixa de 25-30 MB (um `conhost.exe` do ConPTY mais o processo do shell). Quem domina o total é o
processo do harness em si: o `claude.exe` ocioso, sozinho, pesou 254,1 MB — mais do que as duas
abas extras de shell vazio juntas. Isso não é custo do terminal embutido; é o custo do harness,
que existiria do mesmo jeito rodando fora do Electron.

## O que não foi medido

- **Linux e macOS por inteiro.** Ficam para o mantenedor — é o SO do dia a dia dele, e é lá que a
  D-042 mais precisa se sustentar. O protótipo (`main.js`/`preload.js`/`index.html`/`renderer.js`)
  não tem nada específico do Windows além do `cmd.exe` como shell padrão (escolhido só por
  `process.platform`), então **deveria** funcionar com `npm install && npm start` — mas isso é
  suposição, não medição, e é exatamente a categoria de suposição que os spikes anteriores deste
  projeto (F, H) já avisaram para não fazer sem medir.
- **Prebuild do `node-pty` em Linux.** O pacote baixado nesta máquina não trazia
  `prebuilds/linux-*`; o mantenedor deve estar pronto para o `npm install` cair em
  `node-gyp rebuild` e precisar de toolchain de compilação (`build-essential`/`gcc`/`make` +
  Python) — **inferido do conteúdo do pacote, não confirmado rodando em Linux**.
- **Confirmação visual humana ao vivo.** As capturas de tela foram lidas por este agente (que tem
  visão), não por um humano olhando a tela em tempo real — cursor piscando, suavidade do redraw e
  qualquer glitch transitório entre frames não aparecem numa captura estática. Se o mantenedor
  quiser essa camada de confiança, precisa abrir o protótipo e observar ao vivo por alguns
  minutos, digitando nas abas.
- **Sessões longas.** Cada medição de memória é um retrato de poucos segundos após o lançamento;
  crescimento de memória ao longo de uma sessão de horas (scrollback grande, muitos redraws) não
  foi observado.
- **Mais de três abas, ou abas rodando harnesses de verdade simultaneamente.** O teste de memória
  com três abas usou `cmd.exe` vazio nas três; três instâncias de `claude`/`codex` ao mesmo tempo
  custariam a soma dos processos de harness (veja o item 6) mais o pequeno custo marginal por aba
  — não foi medido diretamente, só projetado a partir das duas medições que existem.
- **`Ctrl+Break`/encerramento gracioso (spike G) contra uma sessão embutida.** O Ctrl+C testado
  aqui é o byte `0x03` escrito como dado do pty — chega à aplicação como teclado normal. Não foi
  testado se o mecanismo de sinal de console que o spike G mediu (`GenerateConsoleCtrlEvent` via
  `AttachConsole`) também alcança o processo hospedado atrás do ConPTY de uma aba; pode ser
  irrelevante (o Ctrl+C via pty já resolve o caso de uso da aba), mas não foi verificado.
- **Colar texto grande, seleção de mouse, scrollback muito longo.** Nenhum desses cenários de uso
  de terminal foi exercitado.
- **Por que o `.cmd` do `codex` rodou sem `shell: true`.** Medido que funcionou; não investigado
  por quê (ConPTY/`CreateProcess` pode estar resolvendo o shim de forma diferente do
  `child_process.spawn` comum do Node) — registrado para não ser redescoberto como incerteza nova.

## Recomendação

**A D-042 se sustenta no Windows, com duas ressalvas de implementação, não de stack.** A montagem
não custou nada de especial nesta máquina (sem compilar nativo), os dois harnesses abrem, aceitam
entrada, redimensionam, respondem a Ctrl+C e sinalizam saída corretamente dentro do PTY embutido,
a D-038 vale de graça (ConPTY nunca abre janela) e a descoberta por `cwd` que o seeya já usa
funciona sem nenhuma adaptação contra uma sessão aberta pela aba.

As ressalvas:

1. **Cada harness tem sua própria tela de primeira confiança**, e o texto/atalho para navegá-la é
   diferente entre `claude` e `codex`. Quem semear o primeiro prompt de uma aba precisa saber
   disso, ou o primeiro prompt real será engolido pela tela de confiança (foi o que aconteceu na
   primeira tentativa deste spike).
2. **Enviar Enter numa escrita separada do texto**, sempre — funciona para os dois harnesses;
   concatenar tudo numa escrita só falha silenciosamente no `codex` (o texto fica na caixa, sem
   submeter).

Nenhuma das duas é motivo para reconsiderar Electron/`xterm.js`/`node-pty` — são detalhes de como
a ponte de entrada do seeya deve escrever no pty, não limitações da pilha. **O risco real que este
spike não fecha é o Linux**: o `node-pty` não trouxe prebuild para lá, e a medição de montagem
("sem compilar nada") pode não se repetir na máquina do mantenedor. Antes de qualquer código de
produto em cima da D-042, vale rodar este mesmo protótipo (ou um `npm install` isolado do
`node-pty`) numa máquina Linux e confirmar se o prebuild existe por outro caminho (ex.: pacote
publicado separadamente para `linux-x64`) ou se cai mesmo em compilação — e, se cair, se o
mantenedor já tem a toolchain ou precisa instalá-la.

## O que o mantenedor precisa fazer no Linux

O protótipo (`main.js`, `preload.js`, `index.html`, `renderer.js`, `package.json`, `README.md`)
não tem nada específico do Windows além da escolha de shell padrão (`process.platform`), mas ele
vive só nesta máquina Windows, fora do repositório, e não é commitado — os arquivos precisam ser
recriados/copiados à mão para a máquina Linux. Uma vez lá:

1. `npm install && npm start` em uma pasta nova, e observar se o `node-pty` compila (e se a
   compilação pede alguma ferramenta que falte) ou se resolve por outro prebuild.
2. Abrir uma aba com `claude` e outra com `codex` (o botão "+" pergunta o comando e o diretório) e
   repetir o roteiro do item 2/3 à mão: TUI abre, aceita entrada, redimensiona a janela do SO,
   cores e caixas corretas, `Ctrl+C` chega, saída detectada.
3. Confirmar D-038 no mecanismo de janelas do seu ambiente gráfico (o equivalente Linux de
   "nenhuma janela de console além da do Electron" depende do gerenciador de janelas/terminal
   virtual em uso — este spike não sabe qual é).
4. Conferir `~/.claude/sessions/<pid>.json` com uma aba aberta, do jeito do item 5.
5. Repetir a medição de memória (`ps`/`smem` ou equivalente) com uma e com três abas.
6. Ao final, remover os processos de teste e os transcripts que ficarem em
  `~/.claude/projects/<pasta>/` e `~/.codex/sessions/`, do mesmo jeito que esta rodada fez no
  Windows.
