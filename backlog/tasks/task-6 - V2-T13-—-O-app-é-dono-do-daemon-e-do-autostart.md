---
id: TASK-6
title: V2-T13 — O app é dono do daemon e do autostart
status: Review
assignee: []
created_date: '2026-09-22 11:10'
updated_date: '2026-09-23 10:46'
labels: []
milestone: m-1
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T13 — O app é dono do daemon e do autostart; a CLI vira cliente (D-045).**
Especificada pelo PO em 2026-09-20; terceiro passo do recorte da v2 (`docs/V2-RUMO.md`).
Implementa os itens 1 e 2 da D-045 — os itens 3 e 4 dela (o handoff sair do centro, adotar
uma sessão) são das tarefas de projetos, não desta.

**O problema, medido na máquina do mantenedor.** Duas cópias do seeya controlam a mesma
coisa: o app instalado e o checkout. Nada diz qual está no comando; o daemon é o de quem o
subiu por último, e no aceite da V2-T11 o daemon vivo era um processo de três dias antes,
rodando código anterior ao clique no toast existir — a pessoa clicava e nada acontecia, sem
nenhum sinal de por quê. Hoje a máquina também não tem nada no autostart: o registro sumiu
numa troca de caminho e ninguém percebeu.

**O que entra:**

1. **Saber se o app está instalado, pelo registro do sistema** (D-045 item 2: nunca por um
   arquivo nosso, que qualquer um apaga). Porta nova `AppInstallation` em `core/ports.ts`,
   com `find()` devolvendo união discriminada `installed` (com o caminho do executável) /
   `notInstalled` / `unknown` (D-024, D-025 — falha de consulta não vira "não instalado").
   Adaptador em `adapters/installation/`, uma classe por sistema escolhida por
   `process.platform` no `index.ts` da pasta, no mesmo formato de `adapters/autostart/`:
   Windows lê a entrada de desinstalação que o NSIS por usuário cria; Linux pergunta ao
   `dpkg` pelo pacote; macOS procura o app em `/Applications`. **`AppImage` nunca é dono** —
   não deixa registro de instalação, e o próprio processo sabe disso (V2-T8 já lê essa marca
   para o protocolo).
2. **Quem é dono, num lugar só.** `application/daemon-ownership.ts#resolveDaemonOwner`
   (puro, sobre o resultado da porta) devolve `DaemonOwner`: `app` (com o caminho de
   lançamento), `cli` ou `unknown`. **Regra:** app instalado → o dono é o app; sem
   instalação → a CLI, como na v1; consulta que falhou → `unknown`, e nesse caso **nada é
   recusado** (D-025: na dúvida, o comportamento de hoje, nunca um bloqueio inventado).
3. **A CLI vira cliente.** Quando o dono é o app, `seeya daemon` (subir) e
   `seeya autostart enable` recusam com uma linha que diz o porquê e o que fazer na janela;
   `seeya daemon --stop`, `seeya status`, `seeya autostart status` e `autostart disable`
   continuam funcionando — um cliente pode olhar e pode parar, nunca assumir a posse.
   **Cuidado:** o worker do daemon que a própria janela lança passa pelo mesmo arquivo da
   CLI (`SEEYA_DAEMON_CHILD`); a recusa vale só para a invocação humana, e um teste prova
   que o filho lançado pela interface continua subindo.
4. **O autostart passa a ser do app.** Quando o dono é o app, a janela registra no autostart
   o lançamento do **daemon do app** (o mesmo `DaemonLaunchTarget` que o botão *Start
   daemon* já monta, V2-T5b), nunca uma janela abrindo sozinha a cada login. A janela ganha,
   ao lado do estado de autostart que já mostra, um botão para ligar e desligar — hoje isso
   só existe na CLI, que passa a recusar.
5. **A pergunta única da transição** (D-045 item 1). Na primeira abertura em que o app é dono
   e encontra daemon ou autostart da CLI, ele **pergunta uma vez** se pode assumir. Aceitando:
   para o daemon da CLI, reaponta o autostart para si e sobe o próprio. Recusando: não
   pergunta de novo e segue sem assumir. A resposta é estado de uso e mora num arquivo novo
   em `~/.seeya/` (chave nova em disco: nome no glossário do `AGENTS.md` **antes** do código,
   D-027), com `schemaVersion`. Nada em `~/.seeya/` muda de formato além desse arquivo novo.

**O que não entra:** pôr o `seeya` da CLI no `PATH` pelo instalador (vale a pena, mas é do
instalador — vira tarefa própria depois desta); desinstalar o app removendo o autostart (item
do instalador, mesma tarefa futura); migrar dado nenhum (os dois usam o mesmo `~/.seeya`);
a CLI instalada sozinha muda de comportamento em nada.

**Cuidados:** `process.platform` e `app.isPackaged` só nas raízes de composição; `core/` e
`application/` continuam puros; a porta nova entra na matriz de `docs/ARQUITETURA.md` e no
glossário antes do código; nenhum agente instala o app, nem toca no `~/.seeya` real, no
`~/.claude` real, no autostart real (a tarefa **inteira** é testável com dublês da porta e,
no manual, com `SEEYA_APP_HOME_OVERRIDE`) nem nas chaves `seeya`/`seeya-dev`; nenhuma
dependência nova.

**Aceite do mantenedor:** com o app instalado, `seeya daemon` recusa e explica; a janela
liga o autostart e, depois de reiniciar a máquina, o daemon está de pé sem ninguém abrir
nada; a pergunta da transição aparece uma vez só.

**Relatório do agente (2026-09-20).**

**O que entrou, na ordem da spec, cada item num commit próprio (mais o achado do
mantenedor num commit à parte):**

1. **`AppInstallation`** (`core/ports.ts`) + `adapters/installation/` — um adaptador por SO.
   Windows: três raízes de registro (`HKCU`, `HKLM`, `HKLM\...\WOW6432Node`), procurando
   `DisplayName` batendo em `^seeya(\s|$)`; caminho do executável por `InstallLocation` →
   diretório de `UninstallString` → `DisplayIcon`, nessa ordem — todos os três medidos contra
   instalações reais (a própria e a do mantenedor, ver achado abaixo). Linux: `dpkg-query`
   pelo pacote `seeya`; um `AppImage` nunca aparece nesse banco, então "não instalado" sai da
   própria consulta. macOS: `seeya.app` em `/Applications`. Falha da consulta (qualquer SO)
   → `unknown`, nunca `installed`/`notInstalled` inventado.
2. **`application/daemon-ownership.ts#resolveDaemonOwner`** — puro, `AppInstallationStatus` →
   `DaemonOwner` (`app`/`cli`/`unknown`). `shouldOfferDaemonOwnershipTransition` no mesmo
   arquivo decide a pergunta única do item 5.
3. **A CLI vira cliente** — `runDaemonLauncher`/`runAutostartEnableCommand` ganharam
   `daemonOwner`; recusam só quando `kind === 'app'`. `--stop`/`status`/`autostart
   status`/`disable` continuam sem checagem (o item explícito da spec: "um cliente pode
   olhar e pode parar"). O **cuidado central**: `cli/index.ts` agora decide o modo da
   invocação (`daemon-command.ts#resolveDaemonInvocationMode`, puro: `'stop'`/`'status'`/
   `'worker'`/`'launcher'`) só a partir de `--stop`/`--status`/`SEEYA_DAEMON_CHILD` — nunca de
   `DaemonOwner`. Só o modo `'launcher'` chega a `runDaemonLauncher`; o modo `'worker'` (o
   filho que a janela lança) vai direto a `runDaemonWorker`, cuja assinatura nem tem
   parâmetro de posse — não tem como recusar por engano. `tests/unit/cli/daemon-command.test.ts`
   prova isso rodando `runDaemonWorker` até o fim, com sucesso, no mesmo cenário em que
   `runDaemonLauncher` teria recusado.
4. **Autostart do app** — `Autostart.enable` ganhou um segundo argumento opcional,
   `AutostartLaunchOptions` (`execPath`/`env`), sem mudar o comportamento de quem não o
   passa. No Windows, `env` é injetado envolvendo o lançamento em `cmd.exe /c "set VAR=...&&
   ..."` (`New-ScheduledTaskAction` não tem parâmetro de ambiente); Linux ganha uma linha
   `Environment=` no `[Service]`; macOS ganha um `EnvironmentVariables` no plist — os dois
   últimos são o mecanismo nativo de cada um, sem embrulho. `AppContext.enableAppAutostart`
   chama isso com o mesmo `execPath`/`env` que `startDaemon` já monta (o binário do Electron
   + `ELECTRON_RUN_AS_NODE=1`). Botão novo na janela (`state/autostart-control-panel.ts`,
   mesmo formato idle→running→result do botão do daemon), escondido inteiro quando
   `daemonOwner.kind !== 'app'`.
5. **A pergunta única** — `DaemonOwnershipTransitionAnswer` (`accepted`/`declined`) em
   `~/.seeya/daemon-ownership-transition.json`, lido/gravado por
   `Storage.read/saveDaemonOwnershipTransitionAnswer`. `AppContext.
   checkDaemonOwnershipTransitionOffer` junta `previousAnswer` + `checkLiveLock` + `Autostart.
   status()`; `applyDaemonOwnershipTransition` (extraída para
   `composition/daemon-ownership-transition.ts`, pura, testada com dublês — o corpo de
   `buildAppContext` não tem como ser testado sem tocar o autostart real) para o daemon da
   CLI, reaponta o autostart e sobe o próprio, só para `'accepted'`; qualquer resposta
   persiste, então a pergunta nunca repete. Diálogo na janela, mostrado uma vez no `main()` do
   renderer, depois de tudo mais já estar funcional; fechar com Escape conta como recusar
   (nunca fica sem resposta).

**Achado do mantenedor durante a tarefa, incorporado (Q-081).** A implementação inicial só
lia `HKCU` (instalação por usuário). O mantenedor mediu, na própria máquina, uma instalação
"para todos os usuários" real — registro só em `HKLM`, `InstallLocation` e `UninstallString`
ambos vazios, só `DisplayIcon` carregava o caminho. `buildQueryScript` passou a varrer três
raízes (`HKCU`, `HKLM`, `HKLM\...\WOW6432Node`) e `deriveExecutablePath` ganhou o terceiro
fallback. A prova manual abaixo confirma isso rodando de verdade contra a própria instalação
por máquina do mantenedor, ainda na máquina onde a tarefa foi feita.

**Texto exato da recusa da CLI:**
- `seeya daemon`: `seeya: the app is installed (<launchPath>) and now owns the daemon. Open
  seeya and use the daemon control there (Start daemon / Stop daemon) — "seeya daemon" no
  longer starts one here.`
- `seeya autostart enable`: `seeya: the app is installed (<launchPath>) and now owns
  autostart. Open seeya and use the autostart toggle there — "seeya autostart enable" no
  longer registers one here.`

**Prova manual, na janela, contra um `SEEYA_APP_HOME_OVERRIDE` descartável
(`%TEMP%\seeya-verify-v2t13`, apagado ao final, nunca o `~/.seeya` real).** Nenhuma chave de
registro `seeya`/`seeya-dev` foi criada, alterada ou apagada — só leitura da instalação real
já existente (a própria, medida na tarefa anterior). Um processo real e descartável
(`Start-Sleep`, morto ao final) forneceu um `daemon.lock` real (pid + `procStart` capturados
pela mesma rotina que `tests/integration/cli/daemon-command.test.ts` usa) para simular "a CLI
tem um daemon vivo", sem tocar no daemon de verdade. Duas capturas
(`SEEYA_APP_OFFSCREEN`/`SEEYA_APP_SCREENSHOT_PATH`/`SEEYA_APP_QUIT_AFTER_MS`):
1. Sem resposta prévia: a pergunta única aparece, com o texto exato "seeya is installed
   (C:\Program Files\seeya\seeya.exe) and can now own the daemon and autostart on this
   machine..." — confirma ao vivo a instalação por máquina do mantenedor (o achado do
   Q-081) sendo lida corretamente pelo `DisplayIcon`, e o painel de status atrás mostra
   "Daemon: running (pid <do processo semeado>...)".
2. Com `daemon-ownership-transition.json` pré-semeado como `declined` (escrito à mão, nunca
   pelo botão "Let seeya take over" — clicar nele chamaria o autostart real): a pergunta não
   aparece, e o botão "Disable autostart" mostra (a instalação real desta máquina tem
   autostart da CLI de verdade registrado, apontando para o binário antigo do checkout —
   prova que `resolveAutostartControlAvailability` leu o `AutostartStatus` real e escolheu o
   rótulo certo). O botão "Disable autostart" **não foi clicado** — nenhum agente altera o
   autostart real.

**Portão**, tudo na worktree do agente: `format:check` verde; `tsc -p tsconfig.json --noEmit`
verde; `eslint .` verde; `build` (`tsc -b`) verde; `dependencias` verde — "no dependency
violations found (363 modules, 974 dependencies cruised)";
`npx vitest run --project unit --project integration --project integration-process --project
guards --maxWorkers 2 --coverage` — **197 arquivos de teste, 2.008 testes passando, 4
pulados**; cobertura agregada **96,39% statements / 92,56% branches / 94,93% funções / 96,75%
linhas**, acima dos pisos do `AGENTS.md` (todo diretório novo — `adapters/installation`,
`state/autostart-control-panel.ts`, `composition/daemon-ownership-transition.ts` — está
registrado em `vitest.config.ts`/`tests/integration/guards/_coverage-directories.ts`).
`verificar:linux` não rodado (mesma classe de limite de memória do host já registrada em
tarefas anteriores; CI cobre).

**Questões abertas:** Q-081 (detecção de instalação no Windows — o que foi medido, o achado
do mantenedor sobre instalação por máquina, e o que ainda não foi medido em Linux/macOS).
Nenhuma outra questão nova — a spec e a D-045 cobriram o resto.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 197 arquivos, 2.008 testes
passando, 4 pulados; cobertura 96,39%/92,56%/94,93%/96,75%). Revisão com um ajuste, no texto
do diálogo da transição: ele afirmava que o daemon encontrado era "da CLI", coisa que a trava
não permite saber (ela não guarda dono), e o botão de recusar dizia "Not now" embora a
pergunta nunca mais volte. O texto passou a dizer só o que sabe, e que a pergunta é feita uma
vez só. Fica em `[~]` até o aceite do mantenedor.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 200 arquivos, 2.029 testes
passando, 4 pulados; cobertura 96,40%/92,62%/94,95%/96,76%). Revisão sem ajustes. Fica em
`[~]` até o aceite do mantenedor — que é instalar por cima com o daemon de pé, no Windows, e
abrir uma aba no app instalado no Mac.

**Aceite parcial do mantenedor em 2026-09-20 (Windows):** instalou por cima **com o daemon
rodando** e o instalador não pediu para fechar nada — a metade que mais o incomodava está
resolvida. **Mas o daemon não voltou**, e o diagnóstico do PO no mesmo dia achou a causa: a
chamada de religar é recusada pela própria CLI desde a V2-T13. Vira a **V2-T22**; esta
entrada segue em `[~]` até ela fechar e o ciclo completo passar.

**Aceite do macOS em 2026-09-20:** o mantenedor instalou o `.dmg` construído pela CI a partir
desta tarefa e **as abas abrem** — shell e `claude`, no mesmo Mac Apple Silicon onde toda aba
falhava com `posix_spawnp failed`. Na mesma sessão ele mediu, pela primeira vez num Mac, mais
duas coisas que só tinham medição no Windows: a **detecção de instalação** (Q-081, a CLI do
checkout recusou e o caminho resolveu para dentro do bundle) e os botões **Start daemon**/
**Stop daemon** da janela, que se comportaram igual ao Windows — inclusive no atraso do
rótulo, que é o defeito da V2-T21. E, ainda no mesmo dia, **a primeira notificação do seeya
vista num Mac**: com o encerramento marcado para as 15:00, o aviso prévio apareceu na hora
certa, com o texto de sempre (`adapters/notification/macos-osascript.ts`). O sistema também
avisou, por conta própria, que "seeya" virou item de início de sessão — confirmação de fora
de que o registro de autostart da V2-T13 chegou ao lugar certo. O item 2 está fechado na plataforma onde o defeito existia,
e a versão de macOS deixou de sair quebrada.
<!-- SECTION:DESCRIPTION:END -->
