# Desempenho

> V2-T17. Este documento **não otimiza nada** — mede, registra o método e fixa a régua. Se um
> número aqui sair ruim, a otimização é tarefa própria, decidida com o número na mão.

## Por quê

O mantenedor declarou o objetivo: fazer do seeya um caso de uso de um bom app em Electron — leve,
rápido. A diferença entre um app leve e um pesado quase nunca é uma decisão grande: é um laço a
mais, uma consulta periódica, uma leitura extra por ciclo, e meses depois ninguém sabe de onde
veio o peso. Sem número, a conversa vira "acho que ficou pesado". Este documento existe para que
vire "isto custou X".

## As quatro medidas

Cada uma foi medida três vezes; a faixa (mínimo–máximo) está registrada ao lado, não só uma
média — um número único sem faixa esconde o ruído.

| # | O quê | Método (uma linha) | Faixa medida |
|---|---|---|---|
| (a) | Tempo até a lista de sessões na tela | `packages/app/scripts/measure-startup.mjs`: instante do `spawn()` até o primeiro `sessionsUpdate` enviado ao renderer | 5782–5801 ms |
| (b) | Memória em repouso, árvore inteira de processos | `packages/app/scripts/measure-idle.mjs` + `process-tree-stats.ps1`: soma de `WorkingSet64` de todo processo cujo pid remonta ao processo raiz do Electron | 335,6–338,0 MiB |
| (c) | Trabalho de processador parado | mesmo script, delta de `Process.CPU` (segundos de processador) da árvore inteira ao longo de janelas de 60 s | 0,39%–0,57% de um núcleo lógico |
| (d) | Tamanho em disco | saída de `npm run dist:windows` (`packages/app/dist-installer/`) | instalador 117.497.232–117.497.269 bytes; instalado (unpacked) 409.525.903 bytes (constante) |

### (a) Tempo até a lista de sessões na tela

**O que é medido, com precisão (D-025):** não é o instante em que os pixels apareceram na tela —
é o instante em que `packages/app/src/electron/main.ts` enviou o primeiro `sessionsUpdate` por
IPC ao renderer. A distância entre os dois é de microssegundos perto da chamada de
`SessionProvider.list()` que a precede (algumas centenas de ms, ver a docstring de
`REFRESH_INTERVAL_MS` no mesmo arquivo), então essa aproximação é aceitável para este orçamento
sem precisar de uma segunda viagem de IPC só para o renderer confirmar sua própria pintura.

**Como reproduzir:**

1. `node scripts/build.mjs` (dentro de `packages/app`) — produz `dist/electron/main.js`.
2. `node scripts/measure-startup.mjs` — três lançamentos descartáveis (`SEEYA_APP_HOME_OVERRIDE`
   numa pasta temporária nova a cada um, nunca o `~/.seeya` real), cada um com
   `SEEYA_APP_STARTUP_TIMING_PATH` apontando para um arquivo que
   `main.ts#writeStartupTiming` grava (instrumentação nova desta tarefa, item 4 — o mesmo padrão
   `SEEYA_APP_*` já usado por toda verificação anterior, nunca lida por `npm run app`). O script
   subtrai o instante do `spawn()` (relógio do processo que mede, `Date.now()` — permitido em
   `scripts/`, fora do escopo de D-019, mesmo precedente de `scripts/spike-j-measure.mjs`) do
   instante gravado pelo processo medido (relógio injetado, `Clock.now()` — D-019).
3. `SEEYA_APP_OFFSCREEN=1` é usado nos três lançamentos: esta máquina de medição não tem uma
   sessão de desktop interativa disponível para o agente que mediu. O modo offscreen evita o erro
   de composição do Chromium sem depender de GPU real; o desktop do mantenedor não precisa dele.

**O que ficou de fora:** a primeira execução de `measure-startup.mjs` nesta máquina incluiu, uma
única vez, o download do binário do Electron pelo próprio pacote `electron` do npm (não medido
como parte do tempo de subida — é um custo de instalação, não de lançamento; as três medidas
registradas acima são de uma segunda rodada, já com o binário em cache).

### (b) Memória em repouso, árvore inteira de processos

**O que é medido:** a soma de `Process.WorkingSet64` (memória residente, o mesmo número que o
Gerenciador de Tarefas do Windows chama de "Memória") de todo processo cujo pid remonta, por
`ParentProcessId`, ao processo raiz do Electron desta janela — nunca só o processo principal, que
sozinho mentiria (um Electron em repouso já é ao menos processo principal + GPU + rede/utilitário
+ um renderer). `process-tree-stats.ps1` caminha essa árvore via `Win32_Process`, nunca por nome
de processo — ver a nota sobre isso mais abaixo.

**Janela aberta, nenhuma aba** (o estado pedido pela tarefa): `measure-idle.mjs` lança o mesmo
bundle de desenvolvimento, espera 15 s (passa do primeiro ciclo de atualização de 10 s) e faz três
capturas espaçadas por janelas de 60 s de nada acontecer.

**Dev, não instalado — a diferença registrada (D-025).** Esta medida usa o binário de
desenvolvimento (`node_modules/electron/dist/electron.exe`, não empacotado, sem assinatura, sem
`asar`) contra o mesmo bundle JS (`dist/electron/**`) que o instalador empacota. Nenhum agente
instalou o app para medir isto (proibido nesta tarefa). O runtime do Chromium/V8 é o mesmo
(`electronVersion` fixado em `packages/app/electron-builder.yml`), então o número deve ficar perto
do que uma cópia instalada usaria — mas **isto não foi confirmado contra uma cópia instalada
medida da mesma forma**; se um dia isso importar, é uma medição própria, não uma suposição desta.

### (c) Trabalho de processador parado

**O que é medido:** o mesmo `process-tree-stats.ps1`, chamado duas vezes por janela de 60 s
(início e fim), soma `Process.CPU` (segundos de processador acumulados, já convertidos pelo
próprio PowerShell) por processo da árvore; a diferença dividida por 60 s dá a fração de **um**
núcleo lógico consumida — não a fração da capacidade total da máquina. Nesta máquina (8 núcleos
lógicos), 0,5% de um núcleo é ~0,06% da capacidade total.

**Por que uma janela contínua, não três lançamentos** (D-025, diga o que a medida é): (b) e (c)
são sobre o comportamento em regime — quanto o app custa depois de estabilizado — não sobre a
variância de lançamento (essa é exatamente a pergunta de (a)). Três lançamentos separados só
somariam três reinícios frios sem acrescentar nada à pergunta "quanto isto custa parado", e nesta
máquina — que às vezes fica com pouca memória livre — cada lançamento evitável importa. As três
amostras vêm de três janelas de 60 s consecutivas dentro de **um** processo contínuo.

**Achado incidental, não uma medição desta tarefa:** enquanto isto era medido, a máquina já tinha
uma cópia **instalada** do app rodando em segundo plano (`C:\Program Files\seeya\seeya.exe`,
árvore própria, pid raiz diferente do processo medido aqui) — de uma tarefa de instalador
anterior. `process-tree-stats.ps1` soma pela árvore de pids a partir do processo que
`measure-idle.mjs` acabou de lançar, nunca por nome de processo, exatamente para nunca confundir
essa cópia alheia com o processo sob medição. Registrado aqui porque é a causa mais provável da
pouca memória livre desta sessão de medição (próxima seção) — não porque tenha contaminado o
número.

### (d) Tamanho em disco

**O que é medido:** a saída real de `npm run dist:windows` (raiz do monorepo) —
`packages/app/dist-installer/seeya-<versão>-x64.exe` (o instalador NSIS) e
`packages/app/dist-installer/win-unpacked/` (o que o instalador deixa em disco depois de
instalado — mesmo conteúdo, sem compressão). As três medições rodaram o comando completo três
vezes (não um atalho `--dir`), cada uma do zero.

**O tamanho instalado (`win-unpacked/`) saiu byte-a-byte idêntico nas três rodadas** —
409.525.903 bytes (~390,6 MiB). O instalador variou em 37 bytes entre a menor e a maior rodada
(117.497.232–117.497.269, ~112,1 MiB) — ruído de metadado da compilação NSIS (provavelmente um
timestamp interno do instalador), não do conteúdo empacotado.

## Linha de base

**Data:** 2026-09-20. **Máquina:** Windows 11 Home, 8 núcleos lógicos, 16 GB de RAM total —
nunca o nome da máquina, por regra deste projeto. No momento da medição, a máquina tinha pouca
memória livre (por volta de 2–3 GB), em parte por já ter uma cópia instalada do próprio app
rodando em segundo plano (achado incidental, seção (c) acima) e outros programas abertos — **os
números de (b) e (c) são sensíveis a isso**: a mesma medida numa máquina ociosa, ou numa com mais
memória livre, pode sair melhor. Não repita esta medição sem necessidade — ela já custa minutos
de uma máquina que às vezes está apertada.

| Medida | Linha de base (2026-09-20) |
|---|---|
| (a) Tempo até a lista de sessões | 5782–5801 ms |
| (b) Memória em repouso (árvore inteira) | 335,6–338,0 MiB |
| (c) CPU ocioso (janela de 60 s) | 0,39%–0,57% de um núcleo lógico |
| (d) Instalador / instalado | ~112,1 MiB / ~390,6 MiB |

**Linux e macOS:** fora do escopo desta tarefa (sem máquina disponível para medir). A tabela acima
está pronta para ganhar uma coluna por sistema operacional quando houver onde medir.

## A régua

**Toda tarefa de interface que acrescente trabalho em repouso, na subida ou no tamanho em disco
diz o custo na própria especificação da tarefa; uma piora sem essa explicação vira questão em
`docs/QUESTOES.md`, nunca passa calada.**

Não há piso automático no CI. Um piso de desempenho medido numa máquina compartilhada e variável
(a mesma variabilidade que a seção "Linha de base" acima descreve) só produziria falha
intermitente — isto é uma escolha registrada, não um esquecimento.

## O que fazer quando um número piorar

1. Meça de novo com os mesmos três scripts (`measure-startup.mjs`, `measure-idle.mjs`, e
   `npm run dist:windows`), na mesma faixa de condições desta linha de base (máquina com pouco
   mais aberto do que o necessário já é esperado, D-025 — não precisa de silêncio absoluto).
2. Se o número novo estiver fora da faixa registrada acima e a tarefa que mudou não tiver
   declarado esse custo na própria especificação (a régua, seção anterior), abra questão em
   `docs/QUESTOES.md` citando os dois números (antes/depois) e a tarefa suspeita — nunca decida
   sozinho se a piora é aceitável.
3. Se o número novo estiver dentro da faixa (ruído normal desta máquina), não é preciso abrir
   nada — atualize a linha de base aqui só se a mudança for deliberada e o mantenedor concordar
   que o novo número é o novo normal.
4. Esta tarefa não otimiza nada — corrigir uma piora encontrada aqui é tarefa própria, decidida
   com o número em mãos, não um adendo a este documento.

## Como remedir (resumo)

```
# (a) tempo até a lista de sessões
cd packages/app
node scripts/build.mjs
node scripts/measure-startup.mjs

# (b)/(c) memória e CPU em repouso (Windows apenas — process-tree-stats.ps1 é PowerShell)
node scripts/measure-idle.mjs

# (d) tamanho em disco
npm run dist:windows   # raiz do monorepo
# packages/app/dist-installer/seeya-<versão>-x64.exe
# packages/app/dist-installer/win-unpacked/
```

## Observação, não medida: Linux contra Windows (2026-09-24)

No aceite da V2-T8 no Ubuntu de uso diário do mantenedor (22.04, `.deb`), ele relatou a janela
abrindo **de forma praticamente instantânea** e o **Enable autostart** respondendo **em
milissegundos** — "absurdamente mais rápido" que no Windows. **Não é número**: ninguém mediu com o
método deste documento no Linux, e ele não substitui a linha de base acima.

O que já se sabe e explica boa parte da diferença, medido na V2-T46: no Windows, as operações que o
mantenedor sente como lentas passam por um `powershell.exe` novo a cada chamada — a consulta ao
agendador de tarefas (o status do autostart) custa **1,3–4 s por chamada**, porque o módulo
`ScheduledTasks` recarrega em cada processo, e a leitura do registro (a detecção de instalação),
**~0,4 s aquecido / ~3 s no primeiro processo**. No Linux, os equivalentes são um `systemctl --user` e
a leitura de um arquivo.

Se virar tarefa, são duas: medir o Linux com o mesmo método (as quatro medidas), e atacar no Windows
o custo de subir o PowerShell nas operações que a pessoa espera na janela — com o número antes e
depois, como manda a régua.
