# Estado atual

_Atualizado em 2026-09-14, depois da mesclagem da V2-T2 na `main`. Se o
`git log`, a CI ou o `~/.seeya` contarem algo diferente do que está aqui, **este arquivo está
atrasado**: confie na evidência e atualize o arquivo. Isso já aconteceu: a primeira versão dele,
escrita à mão no mesmo dia, tinha quatro afirmações falsas, e quem achou foi uma sessão limpa
(spike K)._

## Em uma frase

O Sprint 5 mínimo está aceito, o monorepo (V2-T1) e o **esqueleto da interface (V2-T2,
`@seeya-ai/app`) estão mesclados na `main`** com o portão completo verde (Windows e o contêiner
Linux); falta o aceite manual do mantenedor: `npm run app` no Windows e, sobretudo, no Linux dele.

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
