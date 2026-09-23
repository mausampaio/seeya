---
id: TASK-7
title: 'V2-T15 — Instalador: daemon religado e macOS que abre aba'
status: Review
assignee: []
created_date: '2026-09-22 11:10'
updated_date: '2026-09-23 10:46'
labels: []
milestone: m-3
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T15 — Instalador: o daemon parado e religado, e o macOS que não abre aba nenhuma.**
Especificada pelo PO em 2026-09-20 e aprovada pelo mantenedor no mesmo dia, depois de quatro
achados dele em dois sistemas. **Depende da V2-T13**, já mesclada, que define de quem é o
daemon. Os itens de arrumação que não são defeito — o `seeya` no `PATH`, a desinstalação
removendo o autostart, e a revisão do que muda na instalação por máquina — saem daqui e
viram a **V2-T20**, para esta tarefa ficar só com o que hoje quebra ou irrita.

**O que entra:**

1. **Instalar e desinstalar param o daemon, e instalar religa se ele estava de pé.** Sem
   pergunta na tela (ver a decisão de desenho do PO abaixo). O desinstalador não religa nada.
   **Medir antes de escolher o mecanismo:** o que o NSIS do `electron-builder` já oferece
   para encontrar e encerrar um processo, e o que sobra para os ganchos `customInit`/
   `customInstall`/`customUnInstall`. Encerrar o daemon do próprio seeya é permitido
   (`ProcessControl.terminateAbruptly`, D-002 — a proibição é sobre as sessões descobertas,
   nunca sobre o nosso daemon). **Saber se ele estava de pé** vem do lock em `~/.seeya/`,
   que já existe; nada de chave nova em disco.
2. **O macOS instalado volta a abrir aba.** Causa medida ponta a ponta pelo mantenedor no
   Mac dele, em 2026-09-20 — três `ls -l`, nesta ordem:
   - `node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper` → `-rw-r--r--`;
     `darwin-x64/spawn-helper` → `-rwxr-xr-x`. **Só o prebuild `arm64` vem sem o bit de
     execução**, e é do próprio tarball do node-pty, não do `npm`.
   - depois de `npm run dist:mac`, o mesmo arquivo no `node_modules` **continuava** `644`:
     `ensureSpawnHelperExecutable` só é chamada por `launchElectron()` (`build.mjs`), ou
     seja, **só no `npm run app`** — o caminho do empacotamento nunca passa por ela.
   - dentro do app instalado,
     `seeya.app/Contents/Resources/app.asar.unpacked/.../darwin-arm64/spawn-helper` também
     `644`.
   Portanto **dois pontos**: a correção não roda no caminho do `dist`, e o empacotamento não
   preserva o bit. Corrigir os dois, com o segundo garantido **depois** de empacotar (gancho
   do próprio `electron-builder`) — é o único que protege o artefato que chega a quem instala.
   O sintoma que isso encerra: `Error invoking remote method 'seeya:create-tab': Error:
   posix_spawnp failed` em toda aba do app instalado num Mac Apple Silicon.
3. **Teste que prova o item 2 sem um Mac.** O modo do arquivo dentro do pacote é verificável
   em qualquer sistema — inclusive no CI, que constrói o `.dmg`. Um teste de guard confere o
   bit de execução no artefato empacotado, para que isto não volte calado.

**O que não entra:** assinatura (Q-078); o `seeya` no `PATH`, a remoção do autostart e a
revisão da instalação por máquina (V2-T20); qualquer mudança no comportamento do daemon fora
do momento de instalar e desinstalar.

**Cuidados:** nenhuma dependência nova; **nenhum agente instala, desinstala ou roda o
instalador na máquina do mantenedor** — o item 1 se prova pelo script gerado e por teste, e o
aceite real é dele; o item 2 se prova pelo modo do arquivo dentro do pacote construído, sem
instalar. Nada do `~/.seeya` real, do `~/.claude` real, do registro ou do autostart real é
tocado.

**Aceite do mantenedor:** no Windows, instalar por cima com o daemon de pé, sem precisar
matar processo nenhum à mão, e o daemon de volta ao fim; desinstalar e a pasta ficar vazia.
No Mac, instalar e abrir uma aba.

**Histórico dos achados que originaram esta tarefa** (medições do mantenedor, mantidas aqui
porque é delas que a spec acima vive):

**O achado do terceiro item, do mantenedor em 2026-09-20.** Instalando por cima da versão
anterior, o instalador avisou que o seeya estava rodando — mesmo com a janela já fechada. Era
o daemon, lançado pela própria janela: ele é **o mesmo executável** do app rodando como
processo de apoio, então fechar a janela não o encerra e não há como a pessoa adivinhar isso.
Instalar por cima funcionou depois de encerrá-lo, mas o aviso não diz o que encerrar.

**Segundo achado, medido na desinstalação de 2026-09-20.** O desinstalador **também não
encerra o daemon**: depois de desinstalar, `seeya.exe` (246 MB) e `resources/app.asar`
(17 MB) continuaram em disco porque o processo do daemon, lançado pela janela às 08:57, ainda
os mantinha abertos — ele seguia rodando o código de um app que já não está instalado. A
pasta só fica vazia depois de encerrá-lo. Ou seja: o mesmo item vale para os dois lados,
instalar **e** desinstalar.

**Terceiro achado, medido em 2026-09-20: a instalação por máquina existe e não estava
prevista.** O `electron-builder.yml` documenta a escolha "NSIS por usuário... a que nunca
pede UAC" (V2-T8), mas o instalador **oferece a opção "para todos os usuários"**, e o
mantenedor a escolheu: o app foi para `C:\Program Files\seeya`, com elevação, e a entrada
de desinstalação foi criada em **HKLM** (`InstallLocation` vazio), não em HKCU. A realidade
diverge do que o comentário afirma. Esta tarefa decide qual das duas vale: manter as duas
formas (e então dizer isso no comentário, e conferir tudo que depende do local — autostart,
caminho do daemon, remoção na desinstalação) ou esconder a opção. **A V2-T13 já foi avisada**
do efeito imediato: a detecção de instalação no Windows tem de olhar HKCU e HKLM.
**Quarto achado — CONFIRMADO no mesmo dia, com o app instalado:** o mantenedor rodou
`npm run dist:mac`, instalou, e a primeira aba falhou com
`Error invoking remote method 'seeya:create-tab': Error: posix_spawnp failed`. O
desenvolvimento funciona no mesmo Mac; o app instalado, não. **A versão do macOS que o CI
publica hoje está quebrada para qualquer aba**, e isto deixa de ser arrumação de instalador
para ser o defeito mais grave da fila. Detalhe que a investigação precisa resolver: o
`dist` roda o `build.mjs` **antes** de empacotar, e ele corrige a permissão no
`node_modules` — então a permissão se perde **no empacotamento**, não antes. A suspeita a
medir é o `asar`: arquivo extraído para `app.asar.unpacked` pode sair sem bit de execução,
e nesse caso a correção é garantir o modo depois do empacotamento (gancho do próprio
`electron-builder`), nunca só antes.

**Quarto achado, origem (medido pelo mantenedor no Mac em 2026-09-20, ver V2-T3).** O
`spawn-helper` do node-pty vem **sem bit de execução no prebuild `arm64`** (e com ele no
`x64`). No desenvolvimento, `build.mjs` corrige antes de subir; o app **instalado** nunca
roda esse script, então o `.dmg` leva o arquivo como está e um Mac Apple Silicon instalado
falharia em toda aba com `posix_spawnp failed`. Esta tarefa garante o bit de execução no
pacote (o `electron-builder` preserva o modo do que empacota: ou o arquivo é corrigido antes
de empacotar, ou o alvo macOS declara isso) e **mede num Mac de verdade** antes de fechar.

**Decisão do mantenedor, 2026-09-20: manter as duas formas de instalação**, com o cuidado que
ele mesmo levantou — "dois daemon rodando em dois users ao mesmo tempo". O que já protege
hoje, e o que a tarefa precisa **conferir**:

- **Já isolado por construção:** cada usuário tem o próprio `~/.seeya` (raiz injetável,
  D-027), e dentro dele o próprio `daemon.lock`, a própria config e o próprio estado do dia.
  Dois usuários com daemon de pé ao mesmo tempo é o caso normal, não um conflito: cada um
  captura as sessões do próprio `~/.claude`. Autostart e a chave do protocolo também são por
  usuário (HKCU), mesmo com o app instalado em `Program Files`.
- **A conferir, e é onde pode doer:** o `pid` é global da máquina, e o lock guarda `pid` +
  `procStart`. Se o processo do lock de um usuário tiver o mesmo `pid` de um processo **de
  outro usuário**, a checagem de vivacidade pode não conseguir ler o `procStart` alheio
  (permissão negada no Windows) e, sem o desempate, tratar um `EPERM` como "está vivo"
  (`adapters/process/liveness.ts`, decisão correta e deliberada para o caso de um processo
  protegido). O efeito seria um daemon recusando subir por achar que já existe outro. Medir
  antes de mudar qualquer coisa: reproduzir com dois usuários, e só então decidir se o lock
  precisa de mais um campo (dono do processo) ou se a chance de reuso de `pid` torna isto
  teórico demais para pagar.

**Decisão de desenho do PO, a confirmar na especificação: sem pergunta na tela.** O
instalador para o daemon antes de instalar e, **se ele estava de pé**, sobe de novo no fim,
avisando numa linha. Perguntar no meio de uma instalação sobre um processo que a pessoa não
vê não produz uma resposta informada, e uma das respostas possíveis apenas impede a
instalação. O daemon é processo do próprio seeya — a D-002 proíbe encerrar à força as
**sessões descobertas**, nunca o nosso daemon (`ProcessControl.terminateAbruptly` existe
para isso) — e todo o estado dele mora em disco.

**Entregue pelo agente em 2026-09-20, worktree isolada, branch `tarefa/V2-T15-instalador`,
seis commits** (`5a841e6` item 1; `9773b7a` o guard de regressão do item 1; `d0aa578`+`2c5664d`
a declaração de tipos e o JSDoc de `after-pack.mjs` (item 2/3); `6073a65` a correção achada
pela própria medição, abaixo).

**Item 1 — mecanismo, medido antes de escolher.** O próprio template NSIS do
`electron-builder` já tem um guard genérico de "app rodando"
(`CHECK_APP_RUNNING`/`_CHECK_APP_RUNNING`, `app-builder-lib/templates/nsis/installer.nsi` →
`installSection.nsh`/`uninstaller.nsh`): ele varre `${APP_EXECUTABLE_FILENAME}` por nome de
imagem (PowerShell `Win32_Process.Path.StartsWith($INSTDIR)` quando disponível, senão
`tasklist`/`findstr`) e mata — silenciosamente quando `${isUpdated}` (uma flag interna do
template sobre "isto é upgrade no MESMO modo de instalação", não "o daemon estava rodando"),
com um `MessageBox MB_OKCANCEL` genérico ("$(appRunning)") caso contrário. É exatamente essa
caixa que o mantenedor bateu — ela não diz o que é o processo, porque o template não sabe que
existe um daemon. Não há plugin de kill de processo bundlado como alternativa:
`app-builder-lib/templates/nsis/include/nsProcess.nsh` (wrapper do plugin de terceiro
`nsProcess`) existe na árvore de templates, mas nenhum `nsProcess.dll` é distribuído em
`node_modules`, e nada que o `electron-builder` gera `!include`a esse arquivo — é peso morto
não usado, não uma opção funcional sem um plugin novo e não bundlado.

Decisão: em vez de tentar reconfigurar esse guard genérico (os únicos ganchos disponíveis são
`customInit`/`customInstall`/`customUnInstall`, e nenhum deles altera o comportamento do
`CHECK_APP_RUNNING` do template), o daemon é parado **pelo nome, em `customInit`** — que roda
dentro de `.onInit`, antes de `Section "install"` chegar ao seu próprio `CHECK_APP_RUNNING`.
Quando esse guard genérico varre depois, o daemon já não existe mais; sobra só o caso de uma
janela de verdade aberta, que é outro problema, fora do escopo desta tarefa. "Estava de pé"
vem da mera existência de `~/.seeya/daemon.lock` (`$PROFILE\.seeya\daemon.lock`), checada uma
vez em `customInit` — não uma segunda checagem de vivacidade: isso evitaria ter de parsear a
saída em texto de `daemon --stop` de volta no `nsExec` (o `StrContains.nsh` do próprio
template só é `!include`do no lado do INSTALADOR, nunca no do desinstalador), e não compra
nada que o próprio `runDaemonLauncher` não já cubra de graça: se o stop não tiver realmente
terminado, ele recusa com "already running" — uma tentativa de religar contra um daemon ainda
vivo é um no-op seguro, nunca um segundo daemon (o lock de instância única da D-005).

Parar/religar passam pela CLI empacotada, não por um kill NSIS de mão. `daemon --stop` é
`runDaemonStop` (já testado); `daemon` sem flag é `runDaemonLauncher` — o mesmo spawn que
`AppContext.startDaemon`/`seeya daemon` já usam. Ambos são alcançados exatamente como
`composition/index.ts#daemonLaunchTarget` já alcança em runtime: o próprio
`${APP_EXECUTABLE_FILENAME}` empacotado, com `ELECTRON_RUN_AS_NODE=1` no ambiente, apontando
para o `dist/index.js` de `@seeya-ai/cli` **dentro** do `app.asar` — nunca desempacotado, e
não precisa ser (o comentário do `asarUnpack` em `electron-builder.yml` já mediu essa mesma
invocação lendo certo de dentro do arquivo). `packages/app/build/installer.nsh`:
`customInit` para (religando com `daemon` no fim do `customInstall` só se
`$SeeyaDaemonWasRunning == "1"`); `customUnInstall` só para, nunca religa. `ELECTRON_RUN_AS_NODE`
é setado no ambiente do PRÓPRIO instalador via `System::Call 'Kernel32::SetEnvironmentVariable'`
(plugin `System.dll`, já usado em todo o template, nenhuma dependência nova) e **sempre**
limpo logo depois — sem isso, o `StartApp` do próprio template (que abre o app no fim de uma
instalação não silenciosa) herdaria a variável e abriria o processo errado.

**Achado durante a própria medição, corrigido no mesmo commit (`6073a65`).** Um
`npm run dist:windows` de verdade (não simulado) falhou o build inteiro:
`makensis` trata variável não referenciada como erro fatal, e `$SeeyaDaemonWasRunning` só é
lida/escrita por `customInit`/`customInstall` (metade do instalador), nunca por
`customUnInstall` — a passada de compilação do DESINSTALADOR (`BUILD_UNINSTALLER` definida)
nunca a referencia. Saída bruta:

```
Processed 1 file, 10 command line commands, writing output (x86-unicode):
warning 6001: Variable "SeeyaDaemonWasRunning" not referenced or never set, wasting memory!
Error: warning treated as error
```

Corrigido guardando a declaração com `!ifndef BUILD_UNINSTALLER` — o mesmo idioma que o
próprio `installer.nsi` já usa para `Var appExe`/`Var launchLink` (estado só do instalador).
Depois da correção, `node scripts/dist.mjs --win` (dentro de `packages/app`) terminou com
sucesso: `seeya.exe`/`OpenConsole.exe`/`winpty-agent.exe`/`elevate.exe` assinados (sem
certificado real, `signtool.exe` local), NSIS compilado, `seeya-0.1.0-x64.__uninstaller.exe` e
`seeya-0.1.0-x64.exe` gerados e assinados, blockmap construído — a prova real de que o script
NSIS compila e um instalador de verdade sai do outro lado, sem instalar nem rodar nada disso.

**Item 2 — dois pontos, os dois corrigidos.** (a) `packages/app/scripts/build.mjs`:
`ensureSpawnHelperExecutable()` agora roda incondicionalmente em `main()` (antes só dentro de
`launchElectron()`, ou seja, só em `npm run app`) — o caminho `dist` (este mesmo script sem
`--dev`, depois `electron-builder`) deixava `node_modules` exatamente tão quebrado quanto o
tarball do node-pty. (b) `packages/app/scripts/after-pack.mjs` (novo) — gancho `afterPack` do
próprio `electron-builder` (`electron-builder.yml`'s own `afterPack: scripts/after-pack.mjs`),
que roda depois do `asarUnpack` extrair os arquivos de verdade em disco e antes do alvo mac
virar `.dmg`: acha todo `spawn-helper` sob `<Resources>/app.asar.unpacked/node_modules/
node-pty/prebuilds/darwin-*/` e restaura o bit de execução que faltar. A lógica de achar+chmod
recebe um `fs` injetável (`fixSpawnHelperModeIn(fs, prebuildsDir)`), não `node:fs` direto — 
medido nesta mesma máquina: `chmodSync(caminho, 0o755)` no Windows não altera nada que
`statSync().mode & 0o111` consiga observar (a doc do próprio Node: "on Windows only the write
permission can be changed"), então um teste que checasse o modo real depois de um chmod real
passaria no CI Linux/macOS e não provaria nada no `windows-latest`. O double
(`FakePackagedFs`, em memória) prova a decisão em qualquer sistema — inclusive este.

**Prova do item 2, sem Mac, com pacote de verdade.** O Windows deste agente **não consegue
nem tentar** um alvo mac: `node_modules/app-builder-lib/out/packager.js` recusa de cara —
`if (platform === Platform.MAC && process.platform === Platform.WINDOWS.nodeName) throw
"Build for macOS is supported only on macOS"` — medido rodando
`node node_modules/electron-builder/cli.js --mac --dir --publish=never` direto (contornando
o guard do próprio `dist.mjs`, só para medir): recusa imediata, nenhum arquivo tocado. Essa
checagem é ESPECÍFICA de `process.platform === 'win32'`, não "qualquer host não-mac" — dentro
de um container `node:22-bookworm` (Docker, o mesmo usado por `verificar:linux`, com
`node_modules` isolado num volume nomeado, nunca o do host) o MESMO comando passa da checagem
e empacota de verdade, sem assinatura (`CSC_IDENTITY_AUTO_DISCOVERY=false`), sem `.dmg`
(`--dir`, sem `hdiutil`). Saída bruta relevante (`electron-builder`, dentro do container):

```
• packaging       platform=darwin arch=x64 electron=44.3.0 appOutDir=dist-installer/mac
• downloaded electron zip extracted successfully  output=/repo/packages/app/dist-installer/mac
spawn-helper was missing its execute bit in the packaged app — chmod +x applied: /repo/packages/app/dist-installer/mac/seeya.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
spawn-helper was missing its execute bit in the packaged app — chmod +x applied: /repo/packages/app/dist-installer/mac/seeya.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-x64/spawn-helper
• skipped macOS application code signing  reason=supported only on macOS
[exited with code 0]
```

E a conferência independente do modo, no mesmo container, depois do build:

```
$ stat -c '%a %n' .../seeya.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper .../darwin-x64/spawn-helper
755 .../darwin-arm64/spawn-helper
755 .../darwin-x64/spawn-helper
```

Ou seja: o `afterPack` de fato encontrou os dois `spawn-helper` (`arm64` **e** `x64` vieram
`644` desta vez — variação do próprio `npm ci`, não muda a lógica, que conserta os dois de
qualquer forma) dentro do pacote real, sem assinatura, gerado por uma passada real do
`electron-builder` para o alvo `darwin`, e restaurou `755` nos dois. É a prova mais forte
possível sem um Mac de verdade — falta só o `.dmg`/assinatura, fora do escopo desta tarefa
(Q-078) e do alcance de qualquer host não-mac.

**Item 3 — os guards.** `tests/unit/app/scripts/after-pack.test.ts` (6 casos): conserta o
`darwin-arm64` sem bit, deixa um `darwin-x64` já executável intocado, conserta só o quebrado
quando os dois aparecem juntos, não quebra quando o diretório de prebuilds não existe (alvo
win/linux), ignora uma entrada que não é `darwin-*`, e pula um diretório `darwin-*` sem
`spawn-helper` dentro. Removendo o `chmodSync`/a checagem do bit em `fixSpawnHelperModeIn`
derruba os três primeiros casos — prova de regressão real.
`tests/unit/app/build/installer-nsh.test.ts` (5 casos) é o guard possível para o item 1: como
não há compilador NSIS na suíte (mesmo precedente do `customUnInstall` da V2-T10 item 4, que
também não tem teste próprio), confere por conteúdo que `customInit` para com `daemon --stop`
e grava `SeeyaDaemonWasRunning`, que `customInstall` só religa (`daemon`, nunca `--stop`)
quando essa flag é `"1"`, que `customUnInstall` continua parando e continua removendo a chave
de protocolo (regressão da V2-T10 item 4), que todo `seeyaSetRunAsNode` tem seu
`seeyaClearRunAsNode` par, e que o arquivo nunca introduz um `MessageBox` próprio (a decisão
de desenho do PO, "sem pergunta na tela").

**Portão — rodado em partes nesta máquina (pouca memória).** A tentativa de rodar os quatro
projetos de teste combinados (`--project unit --project integration --project
integration-process --project guards`, sem cobertura) num único comando em segundo plano
passou de 50 minutos sem terminar — não travou (processos de worker continuavam trocando de
PID), mas nunca voltou saída utilizável; interrompido e refeito em partes, em primeiro plano:
`format:check` (limpo), `tsc -p tsconfig.json --noEmit` (limpo), `lint` (limpo), `build`
(limpo), `dependencias` (limpo, "no dependency violations found, 364 modules, 978
dependencies cruised"), depois os quatro projetos de teste em primeiro plano, um de cada vez:
`unit` 144 arquivos/1569 testes (42s), `integration` 35 arquivos/282 testes + 1 pulado (32s),
`integration-process` 12 arquivos/78 testes + 3 pulados (54s), `guards` 9 arquivos/100 testes
(190s) — todos verdes. `npm run cobertura` (os quatro projetos com `--coverage`, concorrência
padrão) reproduziu um flake conhecido do próprio `vitest.config.ts` desta máquina: um teste
de `tests/integration/app/composition.test.ts` (`checkDaemonOwnershipTransitionOffer`, da
V2-T13, sem relação com esta tarefa) estourou o timeout padrão de 5000ms sob a carga
combinada de instrumentação de cobertura + concorrência total — confirmado como contenção, não
regressão, rodando o arquivo isolado (`15 passed (15)`, 16.87s) e reproduzindo o mesmo timeout
duas vezes seguidas só sob cobertura completa. `npm run cobertura -- --maxWorkers 2` (mesma
redução de concorrência que a instrução de fallback já sugeria) saiu limpo e repetível: **200
arquivos, 2029 testes passando, 4 pulados**, e o portão de cobertura fechou em
`exitCode 0`:

```
Statements   : 96.4% ( 3351/3476 )
Branches     : 92.62% ( 1795/1938 )
Functions    : 94.95% ( 904/952 )
Lines        : 96.76% ( 3264/3373 )
```

`npm run verificar:linux` não foi rodado (opcional, e a bateria acima já cobriu tudo que
importa para esta tarefa; o container Docker usado para medir o item 2 foi descartado depois
de coletar a saída acima, não reaproveitado para o portão completo).

**O que não entra, e por quê continua de fora.** A revisão do que a instalação por máquina
(HKLM) muda para este mecanismo não foi feita — o item 1 usa `$PROFILE` (por usuário, sempre
correto para `~/.seeya`) e `$INSTDIR` (já resolvido por `initMultiUser` antes de `customInit`
rodar, então correto nos dois modos) — mas a checagem de dois usuários com daemon simultâneo
que o histórico de achados desta tarefa registra como pendente ("a conferir, e é onde pode
doer") continua pendente, é da V2-T20. Assinatura do `.dmg`/`.exe` continua fora (Q-078).

**Sem questão nova aberta.** Nenhuma ambiguidade da spec, decisão trancada violada, ou
premissa técnica errada apareceu durante a tarefa — as duas medições que mudaram o plano
original (o `warning 6001` do NSIS, e a recusa `platform === 'win32'` do `electron-builder`
para alvo mac) foram resolvidas dentro do próprio escopo, com a medição registrada em
comentário perto do código, como o contrato pede.
<!-- SECTION:DESCRIPTION:END -->
