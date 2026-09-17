# Estado atual

_Atualizado em 2026-09-17, depois do aceite ao vivo de V2-T4 e V2-T5a no Windows — esta sessão do
PO foi capturada pelo `end-day` da interface e reaberta pelo "Resume selected" numa aba do seeya.
Se o `git log`, a CI ou o `~/.seeya` contarem algo diferente do que está aqui, **este arquivo está
atrasado**: confie na evidência e atualize o arquivo. Isso já aconteceu: a primeira versão dele,
escrita à mão no mesmo dia, tinha quatro afirmações falsas, e quem achou foi uma sessão limpa
(spike K)._

## Em uma frase

O Sprint 5 mínimo, o monorepo (V2-T1), o esqueleto da interface (V2-T2), o terminal usável no dia
a dia (V2-T3), a interface retomando o dia em abas (V2-T4) e o `end-day` pela interface (V2-T5a)
estão mesclados na `main` — **V2-T4 e V2-T5a foram aceitas pelo mantenedor em 17/09**, medido de
dentro de uma sessão real retomada pela própria interface. **A V2-T6 (correção: letras órfãs ao
redimensionar/rolar uma aba de Claude Code no Windows) está pronta numa worktree isolada**, portão
local verde no Windows — falta `verificar:linux` terminar (interrompido por memória do sistema, não
por defeito), a revisão do PO, a mesclagem, e o aceite manual do mantenedor (repetir o
redimensionamento com rolagem e dizer se os órfãos sumiram). **A V2-T7 (retomar sem o plano —
terceira opção quando o plano não cabe no argumento) está pronta numa worktree isolada**, portão
local verde no Windows e no contêiner Linux (`verificar:linux`) — falta a revisão do PO, a
mesclagem, e o aceite manual do mantenedor (retomar a sessão dele pelo painel "Hoje" com o plano
acima do teto, escolhendo "Resume without the plan").

## Onde o código está

- `main` publicado. **A CI do Windows falhou em dois pushes só de documentação** (`4146faa` em
  10/09 e `e9286a5` em 11/09), sempre nos testes de integração de `git/` e `storage/` estourando
  5 s, mais um `EBUSY` na limpeza de pasta temporária. Ubuntu e macOS passam. O portão local está
  verde, e **a reexecução do mesmo job passou sem mudança nenhuma** (variabilidade do runner).
  Como aconteceu duas vezes, virou a **S4-T11**, mesclada e aceita em 12/09 (três pushes
  seguintes verdes). Se um vermelho no Windows voltar, o próximo passo não é serializar mais
  arquivos: é olhar o agendamento dos projetos `guards`/`integration` no runner (Q-064).
- Nada mesclado sem publicar. Todas as branches de agentes já estão mescladas em `main`; as
  worktrees antigas em `.claude/worktrees/` podem ser removidas sem perda.
- O portão local (`npm run verificar`) está estável desde a S4-T10: cinco rodadas verdes seguidas.

## Sprint 4 — aceito em 2026-09-10

- S4-T00 a S4-T10 mescladas e publicadas. A S4-T0i (idioma do conteúdo gerado, D-033) foi feita
  em 11/09: o prompt de captura agora pede o idioma predominante da sessão nos campos gerados.
  Validação real fica para o próximo `end-day` com sessões de idioma misto.
- O aceite do sprint pede "um dia inteiro de uso real sem intervenção". O mantenedor usou o daemon
  de verdade em 06 e 07/09: a captura agendada disparou sozinha, os avisos prévios saíram e
  nenhuma janela de console apareceu. Em 08/09 houve só a retomada com `start-day`, sem daemon.
  **Com isso, o mantenedor declarou o sprint aceito em 2026-09-10.**
- Os itens 6 e 7 do e2e não são automatizáveis: o binário compilado não tem ponto de injeção de
  relógio. Isso está declarado, não fingido.

## Pendente — e não registrado em nenhum outro lugar

Isto se perderia se a sessão que o viveu terminasse:

1. **Proposta aguardando o mantenedor: guardar `duration_ms` e `total_cost_usd` no handoff.** O
   esquema da resposta do `claude` já valida os dois campos e depois os descarta. Sem eles, "a
   captura ficou mais rápida?" e "quanto gastei nesta semana?" só se respondem por sensação. Como
   é chave nova em disco, a decisão é dele (D-027).
2. **Validar a histerese da S4-T7 em uso real, com o cenário provocado:** subir o daemon poucos
   minutos antes do horário, com as duas regras de aviso já vencidas. Os dias reais até agora
   seguiram o caminho saudável, que não exercita o caso.
3. **S4-T13 mesclada e publicada em 12/09:** `seeya status` é o painel único e mostra o daemon
   pelo mesmo bloco que `daemon --status` (teste de concordância). Q-066 fechada pelo PO em 13/09. Verificação à mão para o mantenedor: `seeya status` com o daemon no ar e parado.
   Marcada `[x]` no plano só em 12/09 à noite — quem notou a falta foi o spike L.
4. **S4-T12 mesclada e publicada em 12/09** (política por projeto casa por `cwd` normalizado;
   `captureModel`/`budgetPerSessionUsd` valem no ciclo seguinte, sem restart). Q-065 fechada pelo
   PO. Verificação à mão que fica para o mantenedor: `seeya config
   policy` com o caminho numa forma diferente da do registro, e `seeya sessions` mostrando a
   política aplicada.
5. **Sprint 5 inteiro:** S5-T1 a S5-T7, mais a S5-T8, que é candidata e não está agendada
   (briefing agrupado por projeto).
6. **Spike K2:** repetir o spike K daqui a alguns dias **sem atualizar este arquivo**, para medir
   se a sessão percebe que o estado envelheceu — com os controles do spike L (clone raso, sem
   remoto, protocolo fora). O **spike L** (Codex, GPT-5.6) passou em 12/09 e achou três documentos
   velhos sem saber que era teste: `spikes/L-outro-harness.md`.

## Decisões recentes — por onde começar no `DECISOES.md`

- **D-037:** um mundo, um seeya. Sem ponte entre Windows e WSL (decisão provisória).
- **D-038:** todo processo lançado pelo seeya é invisível por padrão, com uma única exceção: o
  `start-day` interativo.
- **D-039:** o seeya é um secretário. Agrega, organiza e entrega; nunca decide que trabalho
  acontece.
- **[`V2-RUMO.md`](V2-RUMO.md):** o projeto passa a ser a unidade de continuidade. É **rumo, não
  decisão**.

## v2 — começou pelo spike

**Spike M (V2-T0) rodou em 13/09 no Windows e a D-042 se sustenta:** Electron 44 + `@xterm/xterm` 6
+ `node-pty` 1.1 sem compilação nativa (prebuild win32-x64); `claude` e `codex` rodam numa aba
com TUI, redimensionamento, `Ctrl+C` e saída detectada; nenhuma janela além da do Electron
(D-038); a sessão da aba aparece no registro do Claude Code com o `cwd` da aba, então a descoberta
do seeya a vê sem mudança; memória: 342 MB com uma aba vazia, 394 MB com três, 604 MB com um
`claude` ocioso dentro. Dois detalhes de ponte de entrada (prompt de confiança do harness na
primeira execução; no `codex`, o Enter precisa ser escrito separado do texto). **O risco aberto é
o Linux:** o `node-pty` não traz prebuild para linux-x64/arm64, então lá vai compilar — é a
medição que fica para o mantenedor, na máquina dele, com o protótipo de `C:\code\seeya-spike-M`
(fora do repositório; copiar a pasta sem `node_modules`). Registro: `spikes/M-terminal-embutido.md`.

## A interface, esqueleto (V2-T2, 14/09)

**Mesclado na `main` em 14/09** (worktree isolada, duas rodadas de revisão do PO, fast-forward de
sete commits). `@seeya-ai/app` existe: janela Electron
(`contextIsolation`/`sandbox` ligados, sem `nodeIntegration`), lateral com a lista real de sessões
descobertas (mesma linha de `seeya sessions`), painel de estado com o texto literal de `seeya
status`, "+" abrindo uma barra de comando (comando + diretório — nunca `window.prompt`) que lança
uma aba com `claude`/`codex`/o shell do sistema num terminal embutido (`@xterm/xterm` +
`node-pty`). Fechar a aba encerra o processo; o `onExit` marca a aba como encerrada com o código,
nunca a remove. Redimensionar a janela redimensiona todas as abas. Ambiente de cada aba limpo por
`buildResumptionEnv` (D-017) antes do `spawn`.

Quatro commits nos passos (b)-(e) (o passo (a), a medição do Linux, virou texto na Q-071 dentro do
commit do passo (e), sem commit próprio), cada um com o portão relevante verde antes de commitar:
(b) o pacote vazio (janela + "+" com shell, guards e cobertura já valendo); (c)
`describeDaemonState`/`describeAutostartState`/`session-view.ts`/`session-id-display.ts`/
`eligibility-view.ts`/`format-status.ts` movidos de `cli/` para o motor, mais
`adapters/process/resolve-command.ts` novo (resolve o binário do harness por SO, com teste contra
sistema de arquivos falso) — os 1.567 testes da base continuam passando; (d) lateral, abas com
harness, painel de estado; (e) esta documentação.

**Medido:** `npm run verificar` e `npm run verificar:linux` verdes; os quatro guards novos de
`app/` provados (cada um reprova o que deve, com controle do que deve aprovar); a janela abrindo
de verdade nesta máquina via captura real de `webContents.capturePage()` — sidebar, painel de
estado, barra de comando e uma aba com `cmd.exe` de verdade rodando dentro do terminal embutido,
tudo visível na captura.

**Revisão do PO (14/09), mesma branch, três commits mais.** Dois defeitos reais corrigidos:
(1) `PtyManager.write`/`resize`/`closeTab` lançavam para uma aba já sem pty vivo (encerrada) —
sem nada capturando isso em `electron/main.ts`, virava "A JavaScript error occurred in the main
process" do Electron; `resizeTab` era o pior caso, porque redimensionar a janela chama todas as
abas abertas de uma vez. Corrigido no modelo: os três agora devolvem `boolean`, nunca lançam.
(2) O laço de atualização fazia duas descobertas de sessão por ciclo e reconsultava o autostart a
cada ciclo — medido pelo PO contra o `~/.claude`/`~/.seeya` reais dele, com o daemon vivo:
`describeAutostartState` custou **6.017ms na primeira chamada**. Corrigido: uma descoberta
compartilhada por ciclo, intervalo de 5s para 10s, autostart em cache reconsultado só a cada 60s
(pelo `Clock` injetado, nunca por contador de ciclos).

**Q-071 item 8, corrigido:** o travamento que este agente observou (interface presa
indefinidamente, com o `daemon.lock` real do mantenedor presente) **não foi reproduzido pelo PO**,
que mediu `ProcessControl.isAlive` respondendo normalmente (237ms) sob condições equivalentes. A
hipótese "sandbox de agente" fica registrada como hipótese não confirmada, não como causa (D-025)
— o custo real (até 6s por ciclo, concentrado no autostart) é o que a correção (2) acima resolve,
independente da causa do travamento específico.

**Medido depois da revisão:** `npm run verificar` completo verde — 1.638 testes passando, 3
pulados; `npm run verificar:linux` verde — 1.636 passando, 5 pulados.

**Não medido nesta tarefa:** memória com 1 e 3 abas na interface de produto (só a do protótipo do
spike M, 342/394/604 MB, está registrada); contagem de janelas antes/depois por
`EnumWindows`/`IsWindowVisible` (a janela desta medição rodou em modo *offscreen*, único jeito de
`capturePage()` funcionar nesta sandbox sem área de trabalho interativa — um HWND visível pode não
existir para contar); o Linux real do mantenedor. Ficam para a aceitação manual dele, numa área de
trabalho de verdade.

**O que o mantenedor precisa fazer:** `npm ci` na `main` depois da mesclagem; abrir a interface
(`npm run app`) no Linux dele — **essa é a medição que fecha a D-042 de verdade**, com uma aba de
`claude` funcionando; comparar a lateral com `seeya sessions` e o painel de estado com `seeya
status` ao vivo; medir memória com 1 e 3 abas.

## V2-T3 — terminal usável no dia a dia (mesclada na `main` em 14/09)

**Mesclada na `main` em 14/09** (fast-forward: três commits, um por item, mais dois de correção
da revisão do PO e dois de documentação; portão e `verificar:linux` verdes na worktree). Os três
itens do despacho: fonte configurável com Nerd Font embutida
(`terminalFontFamily`/`terminalFontSize`, D-035), aba encerrada removível pelo ×, e a
checagem/correção do bit de execução do `spawn-helper` do node-pty (mais `X_OK` em
`adapters/process/resolve-command.ts`, que antes só conferia existência). **Revisão do PO:** dois
defeitos visíveis para o mantenedor, corrigidos — a barra de comando que não sumia ao
Cancelar/submeter (especificidade de CSS), e o processo principal que não ficava sabendo de uma
aba removida (risco real de PID reaproveitado casando com uma correspondência aba↔sessão errada).

**Medido pelo agente:** `npm run verificar` completo verde a cada um dos cinco commits; `npm run
verificar:linux` verde no estado final — 162 arquivos de teste, 1.658 testes passando, 4 pulados,
dentro do contêiner `node:22-bookworm` (Docker respondeu em segundos). Captura de tela real prova
os glifos Nerd renderizados (não como caixas) numa aba, e a barra de comando sumindo de verdade
depois do Cancel. **Achado que muda o entendimento do item 3:** `spawn-helper` só existe no macOS
(é um alvo `OS=="mac"` no `binding.gyp` do próprio node-pty) — o Linux nunca o compila nem precisa
dele, o que bate com a aba de shell já funcionando lá desde a V2-T2. Os prebuilds de macOS que o
`npm ci` do contêiner Linux extrai mesmo sem usá-los saíram com modo `644` (sem bit de execução) —
evidência a favor da hipótese do mantenedor sobre o Mac, não confirmação (só o `ls -l` dele lá
confirma).

Detalhes completos, decisões e o que ficou inferido (não medido) em `docs/QUESTOES.md` Q-072;
relatório do agente na entrada V2-T3 de `docs/PLANO-DE-ENTREGA.md`.

**O que o mantenedor precisa fazer:** revisar e mesclar; depois, no Mac, `ls -l
node_modules/node-pty/prebuilds/darwin-*/spawn-helper` antes de `npm run app` (que agora corrige
sozinho se faltar o bit) e conferir se uma aba de shell abre; na máquina Linux do dia a dia,
conferir se o prompt do `oh-my-posh` agora renderiza os glifos Nerd corretamente.

## V2-T4 — a interface retoma o dia (mesclada na `main` em 16/09)

Aprovada e despachada pelo mantenedor em 16/09; **mesclada na `main` no mesmo dia** (commit de
merge, porque a `main` tinha andado com o filtro da CI, D-044), com uma correção do PO na revisão:
a aba de retomada nascia com pty 80×24 e o renderer ajustava o xterm ao painel sem redimensionar o
pty — o harness ficaria desenhando em 80×24 até alguém mexer na janela; agora o renderer manda o
`resize` ao montar a aba. Quatro commits de código, um por item do despacho,
mais um de instrumentação de verificação — cada um com o portão local (formatação, tipos, lint,
build, `dependencias`, cobertura) verde antes de commitar:

1. **Painel "Hoje"** (`packages/app/src/state/today-panel.ts`): o mesmo `findPendingBriefing` que
   `seeya start-day` usa, mostrado como caixa de seleção por sessão (nome, `cwd`, primeira linha
   do plano) — uma sessão já retomada hoje vira nota, não caixa (D-024/D-025). Sem briefing
   pendente, o mesmo vocabulário da CLI.
2. **`TabSessionResumer`** (`packages/app/src/resume/tab-session-resumer.ts`): `SessionResumer`
   sobre uma aba em vez do terminal herdado — mesmos argumentos/teto/ambiente/descrições do
   `ClaudeSessionResumer` da CLI, reaproveitados diretamente do motor. Nunca espera a sessão
   terminar; a corrida entre a saída da aba e `FAST_FAILURE_GRACE_MS` (pelo `Clock` injetado) é
   `raceExitAgainstGrace`, e `ExitListenerRegistry` é o que deixa o único `onExit` do `PtyManager`
   também avisar essa corrida.
3. **Pergunta antes do fallback**: diálogo nativo (`<dialog>`) com **Open a fresh session**/
   **Skip**, motivo exato reaproveitado de `core/resume-notice.ts#describeFallbackReason` (mesmo
   texto da CLI). Fechar sem escolher conta como Skip.
4. **Progresso e resultado**: `resumeProgress` mostra "Resuming N of M: nome"; ao final, o resumo
   com o mesmo conteúdo de `cli/format-start-day.ts` (resumidas/puladas/resposta inválida/não
   tentadas/parou cedo), desenhado como seções em DOM — só o modelo de dados
   (`state/resume-summary.ts`) é compartilhado, a formatação em texto fica na CLI (Q-073).

**Medido pelo agente, num `homeDir` descartável, com um `claude` falso escrito à mão para esta
verificação (não o fixture do harness de e2e) e a interface real compilada, offscreen
(`SEEYA_APP_HOME_OVERRIDE`/`SEEYA_APP_OFFSCREEN`/`SEEYA_APP_AUTO_RESUME_ALL`, este último novo
nesta tarefa):** um handoff com plano curto — "Resume selected" abre uma aba rotulada
`project-alpha`, rodando `claude --resume <id> "<prompt>"` de verdade (visível na captura de
tela), e `resumed.json` do dia registra o id. Um handoff com plano de 20.262 caracteres (acima do
teto de 16.384) nunca chega a abrir aba — o diálogo aparece com o texto exato ("yesterday's plan
is too long to pass safely to an interactive session (20262 characters, limit 16384)"); respondido
com Skip, a seção "Skipped at your request" aparece com o motivo, e nenhum `resumed.json` é
escrito. As três capturas de tela foram lidas pelo próprio agente.

**Portão:** `npm run verificar` completo verde (formatação, `tsc -p tsconfig.json --noEmit`, lint,
`npm run build`, `dependencias`, cobertura — 1.693 testes passando, 4 pulados) e `npm run
verificar:linux` também verde dentro do contêiner `node:22-bookworm`. Testes de unidade dedicados
para o resumer (falha rápida com código ≠0, sucesso, falha rápida com código 0 conta como sucesso,
fallback nunca espera a saída) com pty e relógio falsos, sem Electron.

**O que fica pendente do mantenedor:** revisar e mesclar; depois, um `seeya end-day` real seguido
de um `seeya start-day` real **pela interface**, no dia seguinte, no Windows e no Linux dele —
a mesma medição que V2-T2/V2-T3 pediram para o resto da interface, agora para a retomada.
Detalhes, decisões de ferramental e o que ficou inferido (não medido) em `docs/QUESTOES.md` Q-073.

## V2-T5a — `end-day` pela interface (mesclada na `main` em 16/09)

**Mesclada na `main` em 16/09** (fast-forward: cinco commits, um por item, mais os da revisão do
PO — a prévia sem geração — e um ajuste de texto do PO). Fecha o ciclo diário inteiro dentro da janela: a interface agora encerra o dia
(esta tarefa) e retoma na manhã seguinte (V2-T4, já mesclada). Um botão **End day…** na região de
estado roda a mesma prévia (`endDay(deps, { dryRun: true, skipGeneration: true, scope: fullDay })`
— `skipGeneration` é o acréscimo da revisão, ver abaixo) e mostra o resultado — o texto literal de
`formatEndDayReport`, movido de `cli/` para `application/` nesta tarefa (mesma reutilização por
construção que `format-status.ts` já tinha) — como a própria confirmação, com o teto de custo
honesto ("até N × `budgetPerSessionUsd`", nunca uma estimativa, e agora dizendo explicitamente que
a própria prévia não custou nada). Só **Run end-day now** executa de verdade, uma vez por vez,
mostrando "capturing N of M: nome" pelo novo gancho opcional `EndDayOptions.onCaptureProgress`
(`seeya end-day`/o daemon nunca passam); ao terminar, o mesmo `Notifier`/`buildEndDayNotice` da CLI
notifica, e o painel "Hoje" atualiza.

**Medido pelo agente, num `homeDir` descartável com um `claude` falso compilado para esta
verificação e a interface real compilada, offscreen (`SEEYA_APP_HOME_OVERRIDE`/
`SEEYA_APP_OFFSCREEN`/`SEEYA_APP_AUTO_END_DAY`, este último novo nesta tarefa):** com duas sessões
elegíveis, "End day…" seguido de "Run end-day now" grava dois handoffs e `summary.md` em
`~/.seeya/days/<dia>/`, e o diálogo termina mostrando o relatório real mais a linha de custo —
provado por captura de tela lida pelo agente. O `seeya end-day` compilado, contra uma cópia fresca
e idêntica da mesma fixture, produz um relatório que bate estrutura por estrutura com o que o
diálogo mostrou.

**Portão:** `npm run verificar` completo verde a cada um dos cinco commits (formatação, tipos,
lint, build, `dependencias`, cobertura — 1.716 testes passando no Windows) e `npm run
verificar:linux` verde no estado final (`node:22-bookworm`, 1.711 passando, 5 pulados).

**Revisão do PO (16/09), mesma branch, três commits mais: a prévia custava dinheiro.** A premissa
do despacho estava incompleta — `--dry-run` sempre chamou o gerador **leve** de verdade (só o
**profundo** já era poupado, por segurança de disco, D-012), então a prévia pagava o custo leve de
cada sessão e "Run end-day now" pagava de novo. Corrigido com `EndDayOptions.skipGeneration` (só
válido junto de `dryRun: true`), que faz a prévia nunca chamar nenhum gerador, para qualquer modo
de captura — só a interface passa essa opção nova; `seeya end-day --dry-run` e o daemon continuam
exatamente como estavam. **Medido depois da correção** com um `claude` falso que conta invocações:
a mesma verificação de ponta a ponta caiu de 4 chamadas reais ao modelo para **2** (uma por sessão,
só na execução real). Detalhes em `docs/QUESTOES.md` Q-074, item 6.

**O que fica pendente do mantenedor:** revisar e mesclar; depois, um `end-day` real pela interface
no fim de um dia real, e um `start-day` real pela interface na manhã seguinte, no Windows e no
Linux dele — fecha V2-T4 e V2-T5a juntas. Detalhes, decisões de ferramental e a corrida (não
resolvida por esta tarefa, como o despacho já previa) com o `end-day` agendado do daemon em
`docs/QUESTOES.md` Q-074.

## Dois ajustes de uso pedidos e aceitos pelo mantenedor (17/09, sem tarefa numerada)

Feitos pelo PO direto no renderer, no mesmo dia do pedido e aceitos ao vivo: **a aba mostrada
recebe o foco do teclado** (pelo "+"/Open, pelo clique no botão da aba ou por uma retomada — um
clique a menos), e **o terminal ganhou um tema fixo azul-acinzentado escuro** (`#1b1f27`,
`state/terminal-theme.ts`, aplicado ao terminal e ao painel) no lugar do preto absoluto, até
existir a tela de configuração de fonte e cores.

## V2-T6 — correção: letras órfãs ao redimensionar/rolar no Windows (aceita em 17/09: o ConPTY
## empacotado pelo node-pty resolveu; a opção do xterm.js foi revertida)

Especificada e despachada pelo mantenedor em 17/09, a partir de um defeito visto ao vivo (captura
de tela): redimensionar a janela e rolar o scrollback deixa caracteres órfãos na borda esquerda de
uma aba com o Claude Code — só nela; uma aba de shell (PowerShell) redimensionada e rolada da mesma
forma fica limpa, e o mesmo teste no Windows Terminal (fora do produto) também fica limpo, então o
defeito é do emulador embutido (`xterm.js`), não do ConPTY nem da TUI do harness por si só.

**Entregue pelo agente em 17/09, dois commits (um por item), worktree isolada
(`agent-a9d0419594005737a`):** (1) `windowsPty` na opção do `Terminal`, derivado por um módulo puro
(`state/terminal-options.ts`, renomeado de `terminal-font.ts`) a partir de `process.platform`/
`os.release()` lidos uma única vez na raiz de composição — `undefined` fora do Windows e quando
`os.release()` não parseia (D-025); (2) `terminal.refresh(0, rows - 1)` depois de cada
redimensionamento. Portão local em pedaços verde no Windows a cada commit (1.727 testes passando, 4
pulados; cobertura agregada 97%). Investigadas, sem mudar código, as duas hipóteses seguintes que a
V2-T6 já previa (ordem `resize`/`fit`, `convertEol`) — nenhuma delas justificou uma terceira
mudança sem evidência adicional; detalhes na Q-075.

**`npm run verificar:linux` não terminou** — foi interrompido pelo próprio harness do agente por
pressão de memória do sistema (não uma falha do código; o job chegou a passar formatação, lint,
build, `dependencias` e começar a cobertura dentro do contêiner antes de ser encerrado). Fica
pendente rodar até o fim quando houver memória disponível.

**O agente não tem tela interativa — não afirma que o defeito sumiu.** O aceite real é do
mantenedor: revisar e mesclar; rodar `verificar:linux` até o fim; repetir o redimensionamento com
rolagem numa aba de Claude Code no Windows e dizer se os órfãos sumiram (a comparação com o Windows
Terminal, limpo, já está registrada). Se não sumirem, a tarefa reabre com a investigação das
hipóteses seguintes (Q-075), não com o renderizador WebGL (descartado no despacho). Detalhes em
`docs/PLANO-DE-ENTREGA.md` (entrada V2-T6) e `docs/QUESTOES.md` Q-075.

## V2-T7 — retomar sem o plano: a terceira opção quando o plano não cabe no argumento (17/09,
## worktree isolada, aguardando revisão)

Especificada pelo PO em 17/09 a partir do uso real do mantenedor no mesmo dia — a tentativa de
retomar a sessão do PO pelo painel "Hoje" com um plano de 34.071 caracteres (teto 16.384) só
ofereceu "sessão limpa" ou "pular", jogando fora o transcript, que é a memória de verdade
(spikes K/L; o handoff é só um resumo). **Aprovada e despachada pelo mantenedor no mesmo dia**,
antes da V2-T5b.

**Entregue pelo agente em 17/09, worktree isolada, um commit de código (itens 1-4 juntos) mais
este de documentação:**

1. `FallbackDecision` ganhou `{ kind: 'resumeWithoutPlan' }`; `parseFallbackAnswer` passou a
   receber o motivo (`resumeFailed`/`promptTooLarge`) e só oferece a nova resposta para
   `promptTooLarge` — para `resumeFailed`, "r"/"resume" vira resposta inválida (D-024: o tipo
   recusa a combinação errada, com mensagem dizendo por quê). O padrão muda só para
   `promptTooLarge`: branco/Enter/fechar o diálogo agora resume sem o plano; `resumeFailed`
   continua "pular" (S5-T9 intacto).
2. `SessionResumer` ganhou `resumeWithoutPrompt(sessionId, cwd)` — `claude --resume <id>` sem
   argumento de prompt, mesma detecção de falha rápida de `attemptResume`, implementada nos dois
   resumers (`ClaudeSessionResumer` na CLI, `TabSessionResumer` na interface). Uma falha rápida
   dessa tentativa vira sessão pulada com o motivo `resumeWithoutPlanFailed` ("resume without the
   plan failed, exit N") — sem segunda pergunta, como a spec pediu.
3. `ResumeOutcome` virou união discriminada de três formas (`resumed` / `resumedWithoutPlan`,
   com `promptLength`/`limitChars` / `freshSession`, com o motivo) em vez do antigo
   `fellBack: false | ResumeFallbackReason`. `format-start-day.ts` (CLI), `state/resume-summary.ts`
   e o resumo em DOM da interface mostram a terceira forma; nenhum texto das duas formas antigas
   mudou.
4. Os dois lugares que perguntam mudaram juntos: `renderFallbackQuestion`/`formatFallbackNoTty`
   (CLI) mostram as três respostas certas por motivo; o diálogo da janela ganhou o botão **Resume
   without the plan** primeiro e com foco quando o motivo é `promptTooLarge` (escondido para
   `resumeFailed`), e fechar o diálogo sem escolher aplica o mesmo padrão por motivo.

**Medido pelo agente, no Windows:** `npm run verificar` completo verde — tipos, lint, `npm run
build`, `dependencias`, `format:check`, e cobertura com `--maxWorkers 2` (172 arquivos de teste,
1.767 testes passando, 4 pulados; agregado 97,08% statements / 93,1% branches / 96,61% funções /
97,3% linhas — `core/` 100%, todo o resto acima do piso de 80%), cada pedaço rodado e lido em
separado. `npm run test:e2e` verde (9 testes, 4 arquivos), incluindo um teste novo desta tarefa:
um `seeya start-day --all` de ponta a ponta (binário compilado, `claude` falso real) com um
handoff sintético de plano acima do teto — sem TTY (o harness de e2e nunca tem um), o `claude`
falso registra `argv` igual a `['--resume', '<id>']`, sem o plano como terceiro argumento, e
`resumed.json` grava o id.

**`npm run verificar:linux` também rodou até o fim nesta tarefa** (disparado em segundo plano,
saída lida em arquivo pelo agente pelo relógio, nunca esperando notificação) — verde dentro do
contêiner `node:22-bookworm`: 172 arquivos de teste, 1.766 testes passando, 5 pulados (a diferença
de um pulado a mais que o Windows é a mesma variação plataforma-condicional já registrada em
tarefas anteriores, não uma regressão desta), agregado 97,03% statements / 93,15% branches /
96,42% funções / 97,22% linhas. Sem `npm ERR!`/erro de portão em nenhum trecho do log.

**Não medido pelo agente (sem tela/teclado):** o diálogo real da interface (captura de tela do
botão novo, do foco e do texto) — só os testes de unidade do DOM indireto
(`electron/renderer.ts` fica fora do piso de cobertura, D-042) provam a lógica de foco/visibilidade
por leitura de código, não por captura.

**O que fica pendente do mantenedor:** revisar e mesclar; depois, retomar a sessão dele pelo
painel "Hoje" com um plano acima do teto de verdade, escolhendo **Resume without the plan**, e
ver a sessão voltar com o contexto inteiro — o caso real que motivou a tarefa. Questão registrada:
Q-077.

## Próximo passo

S4-T11, S4-T12 e S4-T13 mescladas em 12/09; a fila do Sprint 4 está vazia. **Decidido em
13/09 (D-040, D-041):** o produto passa a se chamar `seeya` (repositório, pasta, binário; npm
`@seeya/cli`), e a ordem é **Sprint 5 mínimo** (S5-T0 renomear, S5-T1 autostart, S5-T5 CI,
S5-T6 segurança) **e depois a v2**, com a interface básica adiantada para o começo dela
(`V2-RUMO.md`, recorte reordenado). Publicação só na fronteira da v2. **S5-T0 e S5-T1 feitas em
13/09** (`seeya autostart enable|disable|status`; no Windows, tarefa agendada com
`conhost.exe --headless`, registrada pelo módulo PowerShell `ScheduledTasks` porque `schtasks
/Create` exige elevação nesta máquina — Q-067). **S5-T5 e S5-T6 mescladas em 13/09** (ações do CI em `@v7`, job de `npm audit` só no CI,
workflow do CodeQL com `security-extended`; varredura de segredos já estava ligada no repositório).
Aceitas na primeira CI depois da mesclagem: o aviso de runtime obsoleto sumiu do log e o CodeQL
rodou com sucesso. **Primeiro achado real do CodeQL:** 1 (alto: js/insecure-temporary-file em scripts/spike-j-measure.mjs:404 — script de spike, não código do produto). **Sprint 5 mínimo concluído no código;**
o **Sprint 5 mínimo está aceito**. **Achado da primeira retomada pós-reinício:** o `start-day`
trocou a sessão do PO por uma sessão limpa porque o plano tinha 4.135 caracteres e o teto do
argumento é 4.096 — virou a **S5-T9, mesclada em 13/09**: o teto do argumento subiu de 4.096 para 16.384 (medido: o
Windows aceita até ~32.600 unidades; o plano por arquivo **não** chega a uma sessão retomada — 4
tentativas, 0 entregas, Q-069), e o fallback agora **avisa antes e pergunta**, com o padrão "não
abrir". Portão Windows verde na `main` (1566 testes); o portão Linux local não rodou porque o
Docker Desktop não respondeu depois do reinício — a CI do Ubuntu é a prova Linux deste push.
**Verificação à mão para o mantenedor:** um `seeya start-day` com o handoff longo retomando a
sessão original, e a medição interativa (TTY real) de `--resume` + `--append-system-prompt-file`,
que o agente só conseguiu fazer em modo de impressão. **Decidido em 13/09: o portão
de segurança reporta, não reprova**
(Q-068); o achado do CodeQL em `scripts/spike-j-measure.mjs` **é corrigido na próxima tarefa que
tocar `scripts/`** — quem despachar essa tarefa inclui isto no briefing. **Verificado em 13/09 depois de um reinício real:** a tarefa rodou no logon (resultado 0), o
daemon subiu sozinho às 15:43, recuperou o lock, fez o reset do dia e tentou a captura atrasada
(sem sessão viva, listou as fechadas); `seeya status` mostra `enabled` com o caminho novo. **S5-T1
aceita em 13/09:** nenhuma janela com o daemon no ar (observação de um minuto); a piscada isolada
logo após o reinício não se repetiu. Linux e macOS não foram medidos. O resultado do spike K está em
[`spikes/K-sessao-limpa.md`](spikes/K-sessao-limpa.md).

## Renomeação (S5-T0, 2026-09-13)

O repositório no GitHub chama-se `seeya`, no mesmo dono (a URL antiga redireciona), e a pasta local é
`C:\code\seeya`. O pacote é `@seeya-ai/cli`, binário `seeya`. **A chave que o Claude Code usa
para memória e transcripts é derivada do caminho**, então a pasta nova começa sem memória de
diretório e sem transcripts antigos — os de `see-you-tomorrow-ai` continuam em
`~/.claude/projects/`, só não são desta chave. O `npm link` foi refeito na pasta nova. **A pasta
antiga (`see-you-tomorrow-ai`) ainda existe** porque o Windows recusou renomeá-la (handle aberto
por processo não identificado); a nova é um clone com o mesmo HEAD. Apagar a antiga quando soltar.

## Monorepo (V2-T1, 13/09)

**Mesclado na `main` em 13/09** (feito numa worktree isolada, revisado pelo PO, fast-forward
de sete commits): o repositório virou monorepo `npm workspaces` (D-043). `core/`,
`application/`, `adapters/` e `scheduler/` moveram (`git mv`) para `packages/engine/src/`; `cli/` moveu para `packages/cli/src/`.
`@seeya-ai/engine` exporta cada camada por subcaminho; `packages/cli` importa por
`@seeya-ai/engine/<camada>/...`. Sete commits ao todo — quatro do movimento em si (um por passo:
`packages/engine`, `packages/cli`, testes/ferramental, documentação), um achado de ferramental no
meio do caminho, e dois de ajuste pedidos na revisão do PO — cada um com o portão relevante verde
antes de commitar; `npm run verificar` completo (format, tipos, lint, `tsc -b`, `dependencias`,
cobertura) verde no fim, com **1.567 testes passando, 3 pulados** (1.566 da base + 1 teste novo
para a oitava regra do `dependency-cruiser`, recolocado na revisão depois de ter sido removido por
engano — Q-070 item 5). `npm run verificar:linux` também verde num container Docker real:
1.565 passando, 5 pulados (1.570 no total, igual ao Windows — a diferença de pulados entre SOs é
comportamento plataforma-condicional que já existia antes desta tarefa, não uma regressão dela).
`git log --follow` confirmado num arquivo movido (`packages/engine/src/core/schedule.ts`).
Achado no meio do trabalho, corrigido na mesma tarefa: `scripts/clean-dist.mjs` limpava só o
`dist/` de cada pacote, não o `tsconfig.build.tsbuildinfo` do `tsc -b` — um `npm run build`
depois de um clean "tinha sucesso" (exit 0) sem realmente reconstruir nada, e o `seeya` do link
quebrava com `MODULE_NOT_FOUND`. Corrigido antes da mesclagem.

**O caminho do binário muda:** `packages/cli/package.json`'s `bin.seeya` aponta para
`./dist/index.js` (raiz do dist do pacote, sem o antigo prefixo `cli/`) — ou seja, o artefato
passa a ser `packages/cli/dist/index.js`, não mais `dist/cli/index.js`.

**Autostart reapontado em 14/09.** A tarefa agendada apontava para o caminho antigo
(`C:\code\seeya\dist\cli\index.js`); o mantenedor rodou `seeya autostart enable`, que
respondeu pelo caminho "já existia, atualizou" da S5-T1 e reescreveu para
`C:\code\seeya\packages\cli\dist\index.js` (`autostart status` confirma). O `brokenPath`
não chegou a aparecer: a pasta `dist/` antiga continuou no disco como resto de build (ignorada
pelo git), então o caminho velho nunca deixou de existir. Ainda não confirmado: o daemon subir
sozinho pelo caminho novo no próximo logon — o daemon em execução em 14/09 é o que subiu em
13/09 pelo código antigo, até ser reiniciado.

`npm link` desta tarefa roda em `packages/cli`, não na raiz — o `seeya` do PATH deste notebook
aponta para a worktree enquanto ela existir; religar depois da mesclagem aponta de volta para
`C:\code\seeya\packages\cli`.

## Ambiente do mantenedor

Não faz parte do projeto, mas afeta o trabalho:

- Este notebook é Windows 11, com Git Bash e PowerShell; **o dia a dia de trabalho dele é Linux**
  (D-042), e é lá que a interface precisa funcionar primeiro. O `seeya` foi instalado com
  `npm link` e aponta para este repositório, então **`npm run build` troca o binário que ele usa**.
- Ele roda o daemon de verdade. Reconstruir ou reiniciar no meio de um teste dele muda o que ele
  está medindo — combine antes.
- Ele lança o `claude` da pasta pai dos repositórios de propósito, para ter uma memória única
  (D-032).
- No Git Bash, aspas duplas expandem `$_` e barras invertidas fora de aspas são comidas. Use barras
  normais nos caminhos.
- **Máquina de validação macOS:** um MacBook Pro de 2012 (Intel x64) rodando **Sonoma 14** por
  patch fora do suporte da Apple. Serve para validar o binário e a interface em macOS Intel — que a
  CI (`macos-latest`, ARM) não cobre —, com a ressalva de que sistema com patch pode ter
  comportamento que o macOS oficial não tem. Node 22 e Electron atuais suportam Sonoma; o piso de
  versão dos dois está acima do que a máquina roda.
- **A sessão do PO não aparece no `--resume` do Claude Code em `C:\code`**, porque o seletor do
  harness lista por slug do diretório e o transcript dela vive sob o slug antigo do repositório,
  embora o `cwd` do registro seja `C:\code`. **`seeya start-day` a retoma normalmente**, porque
  retoma por identidade (`--resume <id>`) e acha o transcript em qualquer slug. Aconteceu em
  13/09, depois de apagar a pasta antiga; não é defeito do seeya — é argumento a favor dele.
