# Estado atual

_Atualizado em 2026-09-12, depois do spike L. Se o `git log`, a CI ou o `~/.seeya` contarem algo
diferente do que está aqui, **este arquivo está atrasado**: confie na evidência e atualize o
arquivo. Isso já aconteceu: a primeira versão dele, escrita à mão no mesmo dia, tinha quatro
afirmações falsas, e quem achou foi uma sessão limpa (spike K)._

## Em uma frase

O Sprint 4 foi **aceito pelo mantenedor em 2026-09-10**. O Sprint 5 (entregar)
não começou. A v2 tem rumo registrado, e o **spike K passou**: uma sessão limpa retoma o trabalho a
partir dos documentos.

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

**Feito, numa worktree isolada (`.claude/worktrees/`), aguardando revisão e mesclagem em 13/09**
(se este arquivo não tiver uma nota de mesclagem abaixo, ainda está nesse estado — confira o
`git log` de `main` em vez de assumir): o repositório virou monorepo `npm workspaces` (D-043). `core/`, `application/`, `adapters/` e
`scheduler/` moveram (`git mv`) para `packages/engine/src/`; `cli/` moveu para `packages/cli/src/`.
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

**Consequência para o mantenedor, pendente em 13/09:** a tarefa agendada do autostart aponta
para o caminho antigo (`C:\code\seeya\dist\cli\index.js`), que deixa de existir depois desta
mesclagem e de um `npm run build` na `main`. `seeya autostart status` vai passar a mostrar
`brokenPath` nesse momento — é o comportamento desenhado pela S5-T1 para exatamente este caso, não
um defeito. **`seeya autostart enable` reaponta a tarefa** para o caminho novo; era, em 13/09, o
único passo manual pendente depois da mesclagem, e depois disso convém conferir que o daemon
volta a subir sozinho no próximo logon. Medido nesta tarefa, com o link apontando para a worktree
(não a `main`, que não foi tocada): `seeya --version`, `seeya status` e `seeya autostart status`
respondem certo pelo link novo — o `status` mostrou o caminho antigo porque, em 13/09, a tarefa
real da máquina ainda não tinha mudado.

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
