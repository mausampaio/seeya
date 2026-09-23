---
id: TASK-14
title: V2-T22 — O instalador não consegue religar o daemon
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels: []
milestone: m-3
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: bug
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T22 — Correção: o instalador para o daemon e não consegue religar, porque a própria
CLI o recusa.** Especificada pelo PO em 2026-09-20 a partir do aceite da V2-T15 pelo
mantenedor e de um diagnóstico do PO na máquina dele, no mesmo dia. Pequena, e com a causa
medida.

**O defeito, medido.** Instalar por cima com o daemon de pé funcionou e **não pediu para
fechar nada** (V2-T15 item 1, primeira metade, aceita) — mas o daemon **não voltou**: depois
da instalação não havia `daemon.lock` nenhum, e a janela subiu com o daemon parado. O PO
reproduziu à mão exatamente a chamada que o `installer.nsh` faz para religar
(`seeya.exe` + `ELECTRON_RUN_AS_NODE=1` + o `index.js` da CLI dentro do `app.asar`, com o
subcomando `daemon`) e recebeu, palavra por palavra:

```
seeya: the app is installed (C:\Program Files\seeya\seeya.exe) and now owns the daemon.
Open seeya and use the daemon control there (Start daemon / Stop daemon) —
"seeya daemon" no longer starts one here.
```

**Causa: duas tarefas do mesmo dia se cruzando.** A V2-T13 (D-045 item 3) fez `seeya daemon`
recusar quando o app está instalado; a V2-T15 fez o instalador religar o daemon chamando
exatamente esse comando. O `--stop` não é recusado, então a primeira metade funciona e a
segunda morre calada — o instalador nem olha o código de saída.

**A correção, e por que ela é a regra certa e não um contorno.** A recusa existe para uma
**CLI instalada à parte** não assumir o daemon de um app que é o dono. Quando quem chama é o
**próprio binário do app instalado** — o mesmo `process.execPath` que a detecção de instalação
já devolve como `launchPath` —, o chamador **é** o dono, e recusar é recusar a si mesmo. A
regra passa a ser: a recusa vale para qualquer outro binário, nunca para o do próprio app.
Isso conserta o instalador sem inventar flag nova e sem afrouxar o que a D-045 decidiu.

**O que entra:**
1. A comparação entre o executável em uso e o `launchPath` da instalação detectada, em módulo
   puro e testado (inclusive o caso de caminhos que diferem só por maiúsculas/minúsculas ou
   separador, no Windows — reusar a normalização que já existe em
   `core/cwd-normalization.ts` se ela servir, nunca uma segunda).
2. `runDaemonLauncher` deixa de recusar quando é o próprio app chamando; a mensagem e o
   comportamento para todo o resto ficam exatamente como estão.
3. **O instalador deixa de falhar calado:** se o religar não funcionar, isso aparece no
   registro do instalador (`DetailPrint`) em vez de sumir — um `ExecWait` cujo código de
   saída ninguém olha foi o que escondeu este defeito.
4. Teste de regressão: a chamada vinda do binário do app sobe o daemon; a de qualquer outro
   binário continua recusada.

**O que não entra:** mudar a D-045 (a CLI continua cliente); mexer no `--stop`, que já
funciona para qualquer chamador.

**Cuidados:** nenhuma dependência nova; nenhum agente instala, desinstala ou roda o
instalador; nada do `~/.seeya` real, do registro ou do autostart real é tocado — a
comparação de caminhos é testada com dublê.

**Aceite do mantenedor:** instalar por cima com o daemon de pé e, ao fim, o daemon estar de
pé de novo, sem clicar em nada.

**Relatório (agente, 2026-09-20).** Branch `tarefa/V2-T22-religar-daemon` a partir da
`main` (commit `7f2b4a7`). Três commits: `b0f1f73` (item 1, a comparação pura),
`33342b1` (item 2, `runDaemonLauncher`) e `c1e05ec` (item 3, `installer.nsh`).

**Item 1.** `isCallerTheOwningApp(daemonOwner, callerExecutablePath, platform)`
(`packages/engine/src/application/daemon-ownership.ts`) — reusa
`core/cwd-normalization.ts#normalizeCwdForComparison` (nenhuma normalização nova): um
caminho de executável e um `cwd` são a mesma forma de caminho de arquivo, e a mesma
diferença de separador/maiúsculas do Windows se aplica a ambos. `platform` é parâmetro, não
lido de `process.platform` ali dentro, para que o caso Windows seja testável em qualquer
executor de CI (mesma razão que `normalizeCwdForComparison` já documenta). Sete testes novos
em `tests/unit/application/daemon-ownership.test.ts`, incluindo separador+maiúsculas do
Windows, separador à direita, POSIX sensível a maiúsculas, e os casos `cli`/`unknown` (sem
`launchPath` para comparar).

**Item 2.** `runDaemonLauncher` (`packages/cli/src/daemon-command.ts`) ganhou um quinto
parâmetro, `platform: PathPlatformHint`, e a recusa virou
`daemonOwner.kind === 'app' && !isCallerTheOwningApp(daemonOwner, target.nodePath, platform)`.
`target.nodePath` já era `process.execPath` em todo call site existente (a mesma plumbing
que `spawnDetachedDaemon` usaria para religar o worker) — não precisou de um parâmetro novo
só para o caminho do chamador. `cli/index.ts` passa `PLATFORM_HINT`, uma constante de módulo
computada uma vez de `process.platform`, no mesmo padrão que `end-day-command.ts`/
`session-reference.ts` já usam. Mensagem e comportamento para `cli`/`unknown`/binário
diferente ficaram exatamente como estavam — só o `app` chamando a si mesmo mudou.

**Item 3.** `packages/app/build/installer.nsh`'s own `customInstall`: a chamada de religar
trocou de `ExecWait` (só devolve código de saída) para `nsExec::ExecToLog` (plugin já usado
em `allowOnlyOneInstallerInstance.nsh`, nenhuma dependência nova) — o texto que a própria CLI
imprime (sucesso ou recusa) passa a aparecer no registro do instalador linha a linha, em vez
de sumir. Medido durante a tarefa: o ramo "launcher" de `cli/index.ts` (a chamada humana,
sem `--stop`/`--status`) nunca marcou `process.exitCode` diferente de zero, nem na recusa
nem no sucesso — só o ramo "worker" marca. Ou seja, checar só o código de saída NÃO teria
revelado o defeito original; por isso o `ExecToLog` (que expõe o texto) é a correção
principal, e a checagem de código de saída (`$SeeyaDaemonRestartExitCode != 0`, com
`DetailPrint` próprio) ficou como cinto de segurança para um futuro modo de falha que já
saia com código diferente de zero (ex.: `spawnDetachedDaemon` falhando ao spawnar). Dois
testes novos em `tests/unit/app/build/installer-nsh.test.ts` — os quatro já existentes
continuam verdes (`daemon'` sem `--stop` no `customInstall` ainda bate, já que
`nsExec::ExecToLog '"..." daemon'` preserva o mesmo sufixo).

**Item 4.** Coberto pelos dois commits acima: `tests/unit/cli/daemon-command.test.ts` ganhou
um describe novo (`runDaemonLauncher — the caller IS the owning app`) provando que
`target.nodePath` igual a `daemonOwner.launchPath` não é mais recusado (chega ao
`checkDaemonLock`, sem spawn real); o teste existente de recusa foi anotado como a prova de
regressão do outro lado (binário diferente continua recusado).

**Portão (Windows, primeiro plano, em pedaços — a máquina derrubou por memória a primeira
tentativa combinada com `--coverage`):** `format:check` verde; `tsc -p tsconfig.json
--noEmit` verde; `lint` (`eslint .`) verde; `build` (`tsc -b`) verde; `dependencias`
(`depcruise`) verde — "no dependency violations found (364 modules, 983 dependencies
cruised)"; `npx vitest run --project unit --project integration --project
integration-process --project guards --maxWorkers 2` — 200 arquivos, 2.038 testes, 4
pulados (pré-existentes), verde; o mesmo comando com `--coverage` — 96,4% statements /
92,63% branches / 94,96% funções / 96,76% linhas (`src/core/` em 100%), acima dos pisos do
`AGENTS.md`, saída de `$?` conferida como 0. `verificar:linux` não rodado (CI cobre).
Nenhum agente instalou, desinstalou ou rodou o instalador; nada do `~/.seeya` real, do
`~/.claude` real, do registro ou de processos `seeya.exe` reais foi tocado.

Nenhuma questão nova aberta (Q-082 não foi necessária — a spec cobriu o caso sem ambiguidade;
a única descoberta de execução, o exit code sempre zero do ramo "launcher", está registrada
acima, no item 3, como comentário no próprio `installer.nsh`, não como questão separada).

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 200 arquivos, 2.038 testes
passando, 4 pulados; cobertura 96,40%/92,63%/94,96%/96,76%). Revisão sem ajustes. Fica em
`[~]` até o aceite do mantenedor.

**Terceira manifestação do mesmo defeito, medida no Mac horas depois (2026-09-20):** o
mantenedor reiniciou a máquina e, no login, **o autostart não subiu daemon nenhum** — sem
`~/.seeya/daemon.lock`, com o autostart ainda ligado. Rodando à mão exatamente o que o
`LaunchAgent` executa (`ELECTRON_RUN_AS_NODE=1 <app>/Contents/MacOS/seeya <cli>/dist/index.js
daemon`), veio a mesma recusa. Ou seja, a V2-T13 quebrou **três** caminhos legítimos, não dois
— instalador, desinstalador e autostart —, e esta tarefa conserta os três de uma vez, porque
todos são o próprio binário do app chamando a si mesmo. Também corrige uma suposição do PO
registrada antes: o autostart do logout/login anterior não "recuou por causa da trava viva",
foi recusado do mesmo jeito; o daemon que estava lá era o sobrevivente do logout.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 200 arquivos, 2.057 testes
passando, 4 pulados; cobertura 96,41%/92,68%/94,97%/96,77% — e **sem** o estouro de tempo que
o agente viu). Revisão sem ajustes; o agente acrescentou, por conta própria e com razão, o
ajuste que faltava na spec: além do rótulo, o botão precisava **aceitar um clique novo logo
após o anterior** — sem isso o texto se corrigiria na hora e o clique seguinte seria engolido
até o próximo ciclo. Fica em `[~]` até o aceite do mantenedor.
<!-- SECTION:DESCRIPTION:END -->
