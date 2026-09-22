---
id: TASK-12
title: >-
  V2-T20 — Instalador, o que sobrou: o `seeya` no `PATH`, a desinstalação
  removendo o autostart, e a instalação por máquina revisada
status: Review
assignee: []
created_date: '2026-09-22 11:11'
labels: []
milestone: m-3
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T20 — Instalador, o que sobrou: o `seeya` no `PATH`, a desinstalação removendo o
autostart, e a instalação por máquina revisada.** Especificada pelo PO em 2026-09-20;
aprovada pelo mantenedor para entrar **depois da V2-T23**. São os itens que saíram da V2-T15
quando ela foi cortada para ficar só com os dois defeitos que quebravam ou irritavam.

**O que entra:**

1. **O comando `seeya` disponível no terminal depois de instalar.** Hoje o app instalado traz
   a CLI dentro dele, mas ninguém consegue chamá-la sem saber o caminho para dentro do
   pacote. **Medir por sistema antes de escolher o mecanismo**, porque cada um tem o seu
   jeito honesto: no Windows, o instalador NSIS pode acrescentar o diretório ao `PATH` do
   usuário e deixar um atalho de linha de comando que já chama o executável com
   `ELECTRON_RUN_AS_NODE=1` e o caminho da CLI (é a mesma invocação que o
   `installer.nsh` e o autostart já usam); no Linux, o `.deb` pode instalar um link em
   `/usr/bin`; no macOS, um link em `/usr/local/bin` exige permissão de administrador, então
   **avalie oferecer isso pela janela** (um botão que pede a permissão na hora) em vez de
   fazer o instalador exigir elevação. Se algum caminho não se sustentar, registre e entregue
   os que se sustentam — melhor dois sistemas certos que três improvisados.
2. **A desinstalação remove o autostart.** Hoje o desinstalador limpa a chave do protocolo
   (V2-T10) e, desde a V2-T15, para o daemon — mas deixa o registro de autostart para trás,
   apontando para um app que não existe mais. Vale para os três sistemas, com a mesma
   medição por sistema do item 1.
3. **A instalação por máquina revisada.** O mantenedor decidiu **manter as duas formas**
   (por usuário e para todos), e o `electron-builder.yml` ainda afirma no comentário que só
   existe a por usuário — corrigir o texto e conferir o que muda de verdade quando a
   instalação é para todos: o autostart continua por usuário, a chave de protocolo continua
   por usuário, o caminho do daemon muda, e a entrada de desinstalação vai para outro lugar
   do registro (já tratado pela V2-T13).
4. **O risco dos dois usuários, medido ou registrado.** Com instalação para todos, duas
   pessoas podem ter daemon ao mesmo tempo. O isolamento já existe (cada uma tem o próprio
   `~/.seeya`), mas o `pid` é global da máquina: se o `pid` do lock de uma bater com um
   processo **de outra**, a checagem de vivacidade pode não conseguir ler o `procStart`
   alheio (permissão negada) e tratar como "vivo", impedindo o daemon de subir. **Medir com
   duas contas**; se o custo da medição não se pagar, registrar como limite conhecido com o
   sintoma descrito — nunca "resolver" às cegas.

**O que não entra:** assinatura do instalador (Q-078); atualização automática (D-041).

**Cuidados:** nenhuma dependência nova; **nenhum agente instala, desinstala ou roda o
instalador** — a prova é o script gerado, o conteúdo do pacote e teste; nada do `~/.seeya`
real, do registro, do autostart real ou do `PATH` real é tocado.

**Aceite do mantenedor:** depois de instalar, abrir um terminal novo e `seeya status`
responder; desinstalar e não sobrar autostart registrado.

**Relatório do agente (branch `tarefa/V2-T20-instalador-resto`, worktree isolada).**

1. **Item 1, Windows: `bin\seeya.cmd` + `HKCU\Environment\Path`.** `customInstall`
   (`packages/app/build/installer.nsh`) escreve `$INSTDIR\bin\seeya.cmd` — um shim
   `%~dp0`-relativo (nunca um `$INSTDIR` gravado à mão, sobrevive a
   `allowToChangeInstallationDirectory`) que roda `ELECTRON_RUN_AS_NODE=1` mais o `index.js`
   da CLI dentro do `app.asar`, a mesma invocação que o `daemon --stop`/restart já usam — e
   acrescenta `$INSTDIR\bin` (nunca `$INSTDIR` sozinho: já tem `seeya.exe`, e o `PATHEXT`
   escolheria o `.exe` da janela antes do `.cmd`) ao PATH do usuário atual, não ao do
   `HKLM`. `customUnInstall` desfaz os dois, incondicional (não depende do exe ainda
   existir). **Sem plugin novo** (nada como `EnvVarUpdate.nsh` existe em `node_modules`) —
   a busca/remoção de um segmento `;`-delimitado é uma função NSIS escrita à mão
   (`SeeyaPathFind`/`un.SeeyaPathFind`, duplicada com prefixo `un.` porque o compilador da
   metade desinstaladora recusa `Call` sem esse prefixo — achado real, pegou o primeiro
   `npm run dist:windows`), **verificada contra sete casos** (único, primeiro/meio/
   último de vários, ausente, um "decoy" com prefixo igual, PATH vazio) com um `test.nsi`
   descartável compilado pelo próprio `makensis` que o `electron-builder` já baixa —
   ferramental de verificação, fora do repositório. `npm run dist -- --win` (dentro de
   `packages/app`) compila o instalador de verdade duas vezes durante a tarefa, sem erros —
   a prova pedida pelo cuidado da tarefa ("nenhum agente... roda o instalador"): o script
   gerado compila, nunca foi executado.
2. **Item 1, Linux: `/usr/bin/seeya` vira um script CLI, não mais o link para a GUI.**
   `deb.afterInstall`/`deb.afterRemove` (`packages/app/electron-builder.yml`) SUBSTITUEM os
   scripts padrão do `electron-builder` inteiros (medido lendo `FpmTarget.js`: não há
   mesclagem) — `packages/app/build/deb-after-install.sh`/`deb-after-remove.sh` reproduzem
   tudo que o padrão fazia (bit suid do `chrome-sandbox`, bancos de mime/desktop, perfil
   AppArmor) e trocam só a seção do `/usr/bin/${executable}`: em vez do
   `update-alternatives` apontando para o binário Electron (o padrão do template), escrevem
   um shim marcado por comentário (`Generated by the seeya .deb postinst`) que despacha para
   a CLI do `app.asar`, do mesmo jeito que o Windows. **Medido, não assumido, que isso não
   quebra o ícone**: `LinuxTargetHelper.js#computeDesktopEntry` gera o `Exec=` do `.desktop`
   com o caminho absoluto `/opt/seeya/seeya`, nunca por esse symlink. A remoção só apaga o
   arquivo se o marcador bater (D-025) — nunca um arquivo que a pessoa colocou lá.
   Verificado com um simulacro em diretório descartável (instalação limpa, reinstalação
   idempotente, arquivo estranho sem marcador preservado nos dois sentidos) — `dist:linux`
   não roda desta máquina Windows (`dist-platform-check.mjs`'s own guard já bloqueia,
   medido antes desta tarefa).
3. **Item 1, macOS: não entrou — Q-083.** A própria spec já desaconselhava o caminho óbvio
   (link em `/usr/local/bin` exige elevação; um `.dmg` não tem gancho de instalação para
   pedir isso) e sugeria uma peça de UI nova na janela — algo que não dá para fazer às cegas
   numa máquina Windows sem nunca ver rodando num Mac, o mesmo motivo que já estacionou a
   V2-T19. Registrado em Q-083 com a consequência prática e o contorno manual disponível.
4. **Item 2, autostart na desinstalação.** Windows: `customUnInstall` roda
   `seeya autostart disable` pelo mesmo `nsExec::ExecToLog` best-effort do restart do
   daemon (nunca aborta a desinstalação num código de saída não-zero — o app já foi embora a
   essa altura). Linux: `deb-after-remove.sh` localiza a conta que instalou
   (`$SUDO_USER`/`logname`) e roda `systemctl --user disable` mais a remoção do unit,
   com `|| true` em cada passo (um `postrm` que falha pode deixar o `dpkg` quebrado — pior
   que um autostart sobrando) — **não medido contra um `systemd` de verdade**, mesma
   ressalva que `adapters/autostart/linux.ts` já carrega desde a Q-067; registrado, não
   escondido. macOS: fora de escopo por não ter gancho de desinstalação nenhum (um `.dmg` é
   arrastar para a lixeira, sem script algum rodando) — mesma limitação estrutural do item 1.
5. **Item 3, o comentário do `electron-builder.yml` corrigido.** Lendo
   `NsisTarget.js#configureDefines`: `INSTALL_MODE_PER_ALL_USERS_REQUIRED` (que decide se a
   página do instalador mostra a opção "para todos os usuários") é definido sempre que
   `oneClick: false`, **independente** de `perMachine` — `perMachine: false` só escolhe a
   opção padrão, nunca removeu a escolha. O comentário agora documenta as duas formas, e o
   que muda de verdade entre elas: caminho do daemon (recomputado a cada hook a partir de
   `$INSTDIR`, já funcionava) e raiz do registro de desinstalação (HKCU/HKLM, já tratado
   pela V2-T13); autostart e a chave de protocolo continuam por usuário nos dois casos.
6. **Item 4, o risco dos dois usuários: registrado em Q-083, não medido.** Duas contas
   Windows reais não existem neste ambiente (sandboxed, uma conta só) e o custo de arranjar
   isso não se paga para esta tarefa. O mecanismo exato foi confirmado em código —
   `adapters/process/liveness.ts#resolveIsAlive`'s own branch `capture.kind === 'unavailable'
   → true` — e o sintoma (o segundo daemon recusa subir apontando para um `pid` que não é
   seeya de ninguém) está escrito em Q-083 com a citação exata.

**Testes.** `tests/unit/app/build/installer-nsh.test.ts` ganhou seis casos novos (shim
escrito/removido em customInstall/customUnInstall, caminho `%~dp0`-relativo, nunca reusa
`StrContains.nsh`, par `SeeyaPathFind`/`un.SeeyaPathFind`, `autostart disable` best-effort em
customUnInstall). `tests/unit/app/build/deb-scripts.test.ts` é novo (oito casos: o shim
substitui o symlink padrão, preserva o comportamento default de chrome-sandbox/mime/
apparmor, remoção condicionada ao marcador, autostart best-effort com `|| true`).

**Portão (`npm run verificar`, rodado em partes por causa da memória da máquina):**
`format:check`, `tsc -p tsconfig.json --noEmit`, `lint`, `build` e `dependencias` — todos
verdes (366 módulos, 998 dependências, sem violação). `npm run cobertura`: **2 falhas**, as
mesmas duas de sempre em `tests/integration/app/composition.test.ts` estourando em 5000ms —
a instabilidade conhecida da Q-081, confirmada rodando o arquivo sozinho, sem cobertura:
15/15 em 14,6s. 2093 passando, 4 pulados, 2099 no total, em duas rodadas completas
idênticas. **Percentuais de cobertura não saíram desta vez**: nas duas rodadas completas o
`v8` não imprimiu a tabela nem escreveu `coverage/` quando há falha — diferente de tarefas
anteriores (V2-T23/V2-T25), que relataram números com a mesma dupla de testes falhando; não
investigado a fundo (fora do escopo desta tarefa, e uma terceira rodada completa não mudou o
resultado). Sem regressão nova: as duas falhas são as mesmas da Q-081, no mesmo arquivo, pelo
mesmo motivo.

**Questões abertas:** Q-083 (registrada nesta tarefa) — item 1 do macOS não entrou, e o item
4 (dois usuários) fica como limite conhecido, não medido, ambos pelos motivos acima.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 202 arquivos, 2.095 testes
passando, 4 pulados; cobertura 96,46%/92,59%/95,09%/96,83% — a instabilidade da Q-081 não
apareceu aqui, terceira vez que ela falha no agente e passa no portão do PO). Revisão sem
ajustes, com **entrega parcial aceita**: o `PATH` no macOS e a medição dos dois usuários
ficaram de fora, os dois registrados na Q-083 com o motivo — é o que a própria spec mandava
fazer quando um caminho não se sustentasse.

**Regressão pega pela CI logo depois da mesclagem, corrigida pelo PO no mesmo dia:** a
construção do `.deb` morreu com `Error: Macro name is not defined`
(`app-builder-lib/out/targets/FpmTarget.js#writeConfigFile`). O `electron-builder` substitui
todo token `${...}` desses scripts e aborta num que não conhece — **inclusive dentro de
comentário de shell**, e era exatamente ali que estava: num comentário que explicava esse
mesmo mecanismo, usando um marcador de exemplo. Nenhum portão local pegaria (Windows não
constrói alvo Linux, V2-T12). Corrigido o comentário e acrescentado teste de guard que recusa
marcador fora da lista conhecida — roda em qualquer sistema, então o defeito deixa de depender
de alguém construir para Linux para aparecer.

**Custo de manutenção que o PO registra junto:** os ganchos do pacote `.deb` agora
**substituem por inteiro** os scripts que o `electron-builder` gera. O agente preservou tudo
o que eles faziam (sandbox do Chrome, bancos de mime e de atalhos, AppArmor) e conferiu isso
lendo o gerador — mas, numa atualização futura da ferramenta, melhorias dela nesses scripts
não chegam sozinhas. Quem atualizar o `electron-builder` precisa comparar. Fica em `[~]` até
o aceite do mantenedor.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 202 arquivos, 2.095 testes
passando, 4 pulados; cobertura 96,46%/92,59%/95,09%/96,83%). Revisão sem ajustes.

**Leitura do PO sobre os números, para quem chegar depois:** três estão bons e um não.
Processador parado em ~0,5% de um núcleo é ótimo para um ciclo que a cada 10s lê `config.json`
e descobre sessões. Memória em ~336 MiB é o preço de entrada de um Electron com terminal
embutido — nem bom nem mau, é a base a defender. Tamanho em disco é o de qualquer app
Electron. **Quase 6 segundos até a lista na tela é lento**, e contradiz o objetivo declarado
pelo mantenedor ("leve e rápido"). Antes de otimizar, falta a medida que esta tarefa não podia
fazer: **a subida do app INSTALADO**, que não passa pelo lançamento a partir de
`node_modules`. Só depois dessa comparação é que uma tarefa de otimização tem alvo — hoje ela
teria palpite.
<!-- SECTION:DESCRIPTION:END -->
