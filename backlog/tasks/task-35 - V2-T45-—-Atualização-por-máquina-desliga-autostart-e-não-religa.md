---
id: TASK-35
title: V2-T45 — Atualização por máquina desliga autostart e não religa
status: Review
assignee: []
created_date: '2026-09-24 11:12'
updated_date: '2026-09-24 13:38'
labels: []
milestone: m-3
dependencies: []
references:
  - packages/app/build/installer.nsh
priority: high
type: bug
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T45 — Atualizar a instalação por máquina desliga o autostart e não religa o daemon.**
Relato do mantenedor em 2026-09-24, Windows, instalação por máquina (`C:\Program Files\seeya`):
fechou a janela com o daemon **de pé** e o autostart **ligado**, instalou a versão nova por cima.
O instalador passou (a V2-T15/V2-T22 resolveram a recusa), mas levou **cerca de 4 minutos**, e ao
abrir a janela **o daemon estava parado e o autostart desligado**.

**Evidência colhida pelo PO na máquina, só leitura, logo depois:**

- nenhum `seeya.exe` rodando além da janela; sem `~/.seeya/daemon.lock`;
- `estado.json` gravado pela última vez às 07:59:46 — antes da instalação (arquivos do app às
  08:02:20, janela aberta às 08:04:41). O daemon novo **nunca rodou**, nem por um ciclo;
- o atalho `bin\seeya.cmd` e a entrada do PATH estão lá — ou seja, o `customInstall` **rodou**;
  só o religamento não aconteceu;
- não existe `%TEMP%\seeya-installer.log` — o arquivo que os comentários de
  `packages/app/build/installer.nsh` citam como o lugar onde ler a saída da CLI **nunca foi
  produzido**. Hoje não há registro nenhum do que o instalador fez.

**Duas causas, lidas no template do `electron-builder` (`node_modules/app-builder-lib/templates/
nsis/`), a confirmar pelo agente:**

1. **O autostart: o desinstalador antigo roda em toda atualização.** O instalador novo chama o
   desinstalador da versão anterior (`installUtil.nsh#uninstallOldVersion`), e ele executa o nosso
   `customUnInstall` inteiro — `autostart disable` e `DeleteRegKey HKCU Software\Classes\seeya`
   incluídos — sem saber que é uma atualização. O próprio template distingue os dois casos com
   `${isUpdated}` (`uninstaller.nsh`, linhas ~164 e ~224); o nosso macro não olha.
2. **O daemon: na instalação por máquina, o `.onInit` roda duas vezes.** A instância sem
   privilégio roda `customInit` (vê o `daemon.lock`, marca "estava de pé", **para o daemon**) e
   depois se reabre elevada (`multiUserUi.nsh`, `UAC_RunElevated` seguido de `Quit`). A instância
   elevada roda `customInit` **de novo**: o lock já sumiu, a marca vira "0", e o `customInstall`
   dela não religa nada. Na instalação por usuário não há elevação e o defeito não aparece — por
   isso passou nos testes anteriores.

**O que entra:**

1. **Atualização não é desinstalação.** Em `customUnInstall`, sob `${isUpdated}`: **não** desligar o
   autostart e **não** apagar a chave do protocolo — o `customInstall` da versão nova é quem deixa o
   estado final. Parar o daemon continua (ele precisa sair para os arquivos serem trocados). O
   atalho e o PATH podem continuar sendo removidos e recolocados como hoje (é o que cobre uma troca
   de pasta de instalação); diga no relatório se mudou isso e por quê.
2. **"Estava de pé" atravessa a elevação.** A instância elevada não recalcula a marca a partir do
   lock: pega o valor da instância original. O template já traz o mecanismo —
   `UAC_AsUser_GetGlobalVar` (`include/UAC.nsh`), com `${UAC_IsInnerInstance}` para saber em qual
   das duas se está. Nada de arquivo novo em disco para isso.
3. **O daemon religado roda como a pessoa, não como administrador.** Um daemon lançado pela
   instância elevada nasceria elevado: a janela não conseguiria pará-lo, e tudo o que ele gravasse
   em `~/.seeya/` sairia de um processo com outro nível de integridade. O religamento vai para a
   instância sem privilégio — o template tem `UAC_AsUser_Call`/`UAC_AsUser_ExecShell` para isso.
   Meça qual dos dois preserva a saída da CLI no log de detalhes; se nenhum preservar, escolha o
   que roda como a pessoa e diga o que se perdeu.
4. **Contar e cortar as chamadas redundantes à CLI.** Hoje, numa atualização por máquina, a CLI
   empacotada é lançada pelo menos quatro vezes antes de o arquivo novo ser copiado (`daemon --stop`
   na instância original, de novo na elevada, de novo no desinstalador antigo, mais o
   `autostart disable`) — cada uma sobe o executável do Electron. É o primeiro suspeito dos 4
   minutos, mas **não foi medido**: o relatório diz quantas chamadas sobram e por quê.
5. **O instalador passa a ter log de verdade: `~/.seeya/installer.log`** (pedido do mantenedor,
   2026-09-24, no lugar de só corrigir os comentários que citavam um `%TEMP%\seeya-installer.log`
   que nunca existiu). Ao lado do `autostart.log` (V2-T23 item 5), pelo mesmo motivo: é saída de
   um processo que ninguém está olhando.
   - **Uma linha por passo, com horário** (`${GetTime}`, de `FileFunc.nsh`, que vem com o próprio
     NSIS) e **qual instância escreveu** — original, elevada, desinstalador da versão anterior.
     É isto que mede os 4 minutos: o aceite lê o log, não um cronômetro.
   - **A saída da CLI entra no arquivo**, não só na janela de detalhes: `daemon --stop`, `daemon` e
     `autostart disable` com o texto que imprimiram e o código de saída.
   - **Acrescenta, não sobrescreve** — uma atualização envolve três instâncias, e cada uma precisa
     deixar o seu pedaço. Com teto de tamanho: passou do teto no começo de uma instalação, o arquivo
     recomeça. Diga o teto escolhido e por quê.
   - **Nunca falha a instalação.** Não conseguir escrever o log é uma linha a menos, nunca um
     instalador parado.
   - Nome novo em disco: entra na tabela de identificadores do `AGENTS.md` antes de entrar no código.
   - Os comentários de `installer.nsh` que citam o arquivo inexistente passam a citar este.

**Limite que precisa estar no relatório e no aceite:** a correção do item 1 mora no desinstalador
**da versão corrigida**. A primeira atualização para ela ainda roda o desinstalador de hoje, que
desliga o autostart mais uma vez. Só a **segunda** atualização prova o item 1.

**Restrições:** não instalar, não desinstalar, não rodar instalador nesta máquina — o agente
compila (`npm run dist:windows`) e lê; quem executa é o mantenedor. Nenhuma dependência nova: tudo o
que está acima já vem no template do `electron-builder`.

**Aceite do mantenedor (Windows, por máquina):** instalar o build corrigido uma vez (o autostart
ainda pode cair — é o limite acima); ligar daemon e autostart; instalar o mesmo build por cima. Ao
abrir a janela: **daemon de pé, autostart ligado**. E `~/.seeya/installer.log` conta a história
das três instâncias com horário — de onde sai quanto tempo cada passo levou.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Causas confirmadas no template (`node_modules/app-builder-lib/templates/nsis/`), antes de corrigir:**

1. `uninstaller.nsh` — `customUnInstall` roda (linha ~157, `!insertmacro customUnInstall`) ANTES de
   qualquer `${if} ${isUpdated}` no mesmo `Section un.${...}` (linhas ~164 e ~224 são os dois
   lugares em que o próprio template já trata atualização diferente de desinstalação de verdade).
   `${isUpdated}` já está em escopo nesse ponto — confirmado pelo próprio template usá-lo mais
   adiante na mesma função. O nosso macro não olhava para ele.
2. `multiUserUi.nsh` (linhas ~51-52 e ~79-80, `FUNCTION_INSTALL_MODE_PAGE_FUNCTION`) e
   `installer.nsi` (linhas ~99-119, `Section install`, caminho silencioso) — os dois pontos onde
   uma instalação por máquina eleva (`UAC_RunElevated` seguido de `Quit`) rodam DEPOIS que
   `.onInit`/`customInit` já rodou uma vez na instância original. `UAC_RunElevated` sobe uma
   segunda instância do mesmo instalador, que roda `.onInit`/`customInit` de novo — `${UAC_
   IsInnerInstance}` (`include/UAC.nsh`) é o que distingue as duas.

**Os cinco itens:**

1. `customUnInstall` (`packages/app/build/installer.nsh`) só desliga o autostart e apaga
   `HKCU\Software\Classes\seeya` quando `${ifNot} ${isUpdated}`; parar o daemon continua
   incondicional (os arquivos precisam ficar substituíveis de qualquer forma, e um stop contra um
   daemon já parado é o mesmo no-op seguro que o comentário da V2-T15 já descreve — mantido de
   propósito, como cinto e suspensório). Atalho/PATH continuam sendo removidos e recolocados
   incondicionalmente, como já era (cobre troca de pasta de instalação).
2. `customInit` agora ramifica em `${UAC_IsInnerInstance}`: a instância elevada usa
   `UAC_AsUser_GetGlobalVar $SeeyaDaemonWasRunning` para puxar o valor já calculado pela instância
   original, em vez de reler `daemon.lock` (que a essa altura o stop da instância original já
   apagou) — e não chama `daemon --stop` de novo.
3. O restart do daemon, em `customInstall`, agora roda dentro de `SeeyaRestartDaemonAsUser`
   (Function nova, só existe na passada do instalador), chamada via `UAC_AsUser_Call` — executa na
   instância ORIGINAL (sem privilégio), nunca na elevada. Medido: `UAC_AsUser_ExecShell` (a outra
   opção citada) é `ShellExecute` — sem código de saída, sem nada para popar, não alimentaria nem o
   aviso de falha (V2-T22) nem o log. `UAC_AsUser_Call` roda uma Function de verdade que ainda
   consegue chamar `nsExec::ExecToStack` e devolver o código de saída via `$0` sincronizado
   (`UAC_SYNCREGISTERS`). O que nenhum dos dois preserva: a janela de detalhes ON-SCREEN da
   instância elevada — a janela original foi escondida antes da elevação
   (`ShowWindow $HWNDPARENT ${SW_HIDE}`), então `DetailPrint` desse passo escreve numa lista que
   ninguém está olhando. É por isso que o item 5 existe.
4. Contagem de chamadas à CLI empacotada antes do arquivo novo ser copiado, numa atualização por
   máquina silenciosa: **antes, 4** (`daemon --stop` na original, de novo na elevada, de novo no
   desinstalador antigo, mais `autostart disable`); **depois, 2** (`daemon --stop` na original e no
   desinstalador antigo — este último mantido de propósito, cinto e suspensório). O `daemon`
   restart de `customInstall` continua sendo 1 chamada adicional depois da cópia, agora correta
   (como a pessoa, não como admin).
5. `~/.seeya/installer.log` — uma linha por passo, com `${GetTime}` (`FileFunc.nsh`, já incluído
   pela cadeia de `multiUser.nsh`, não incluído de novo) e qual instância escreveu (`original` /
   `elevated` / `old-uninstaller`). Toda chamada à CLI passou de `nsExec::ExecToLog`/`ExecWait` para
   `nsExec::ExecToStack` (`seeyaRunLoggedCli`), que devolve o texto e o código de saída para o
   arquivo — a janela de detalhes deixa de ser a única fonte. Teto: 256 KiB
   (`SEEYA_INSTALLER_LOG_MAX_BYTES`) — dezenas de atualizações cabem antes de truncar, verificado a
   cada escrita (`seeyaLogWrite`), nunca falha a instalação (`${if}${Errors}`/`ClearErrors` em toda
   operação de arquivo). Nome novo em disco já entrou na tabela do `AGENTS.md` antes deste commit.

**Limite registrado no próprio arquivo e aqui:** a correção do item 1 mora no desinstalador da
VERSÃO CORRIGIDA. A primeira atualização para esta versão ainda roda o desinstalador de hoje
(sem a checagem de `${isUpdated}`), que desliga o autostart mais uma vez — só a segunda atualização
prova o item 1 (e o `installer.log` do desinstalador antigo, nessa primeira vez, não existe: ele
não sabe escrever nele).

**Exemplo do que o log deve conter numa atualização por máquina, na ordem:**
```
[2026-09-24 08:02:11] [original] Stopping the seeya daemon before installing... -- exit 0 -- seeya daemon stopped (pid 1234)
[2026-09-24 08:02:12] [elevated] Reused the original instance's own daemon state (1) instead of stopping it again
[2026-09-24 08:02:41] [old-uninstaller] Stopping the seeya daemon... -- exit 0 -- seeya daemon is not running
[2026-09-24 08:02:41] [old-uninstaller] Skipping autostart/protocol cleanup: this uninstall is part of an update
[2026-09-24 08:04:02] [elevated] Restarting the seeya daemon (it was running before this install)... -- exit 0 -- seeya daemon started (pid 5678)
```
(a segunda linha do `old-uninstaller` só aparece a partir da SEGUNDA atualização para esta versão,
pelo limite acima)

**Prova de compilação.** `npm run dist:windows` não pôde rodar nesta worktree: ela não tem
`node_modules` (nem na raiz, nem em nenhum pacote), e a tarefa proíbe `npm install`/`npm ci` e
proíbe criar uma junction para o `node_modules` da raiz — registrado em Q-088. Em vez disso, montei
um harness `makensis` isolado (fora do repositório, só em `%TEMP%`), usando o `makensis.exe`/UAC.dll
já baixados no cache do `electron-builder` nesta máquina (de uma build anterior do mantenedor —
nada instalado por mim) e os arquivos reais de `node_modules/app-builder-lib/templates/nsis/`
(lidos, não copiados para o repositório), reproduzindo a mesma geração de `${isUpdated}` que
`nsisScriptGenerator.js` produz de verdade. Compilei `packages/app/build/installer.nsh` desta
tarefa com `-WX` (avisos são erro fatal, igual ao `makensis` do `electron-builder`) nas duas
passadas — `BUILD_UNINSTALLER` definido e não definido. **As duas compilaram limpas, sem aviso nem
erro** (a primeira tentativa pegou um erro de verdade — `$SeeyaDaemonWasRunning` referenciado fora
do `!ifndef BUILD_UNINSTALLER` certo no meu próprio harness, não no `installer.nsh` — corrigido no
harness, não no arquivo). Isto prova a sintaxe NSIS e os mecanismos novos (`UAC_AsUser_Call`,
`UAC_AsUser_GetGlobalVar`, `${GetTime}`, `nsExec::ExecToStack`) contra os headers/plugins reais;
NÃO prova o pipeline inteiro do `electron-builder` (ícones, `app.asar`, assinatura, o
`installer.nsi` real com as páginas MUI). `npm run verificar` também não pôde rodar, pelo mesmo
motivo (Q-088) — nenhuma mudança de código depende do resultado dele para estar correta
(`installer.nsh` não é TypeScript, não passa por `tsc`/`eslint`/`dependency-cruiser`), mas o comando
de verdade ainda precisa rodar antes do `Done`.

**Restrições respeitadas:** nada foi instalado, desinstalado ou executado como instalador nesta
máquina; nenhum toque em `~/.seeya`/`~/.claude`/registro reais; nenhuma dependência nova; branch
`tarefa/V2-T45-atualizacao-por-maquina`, commit único e pequeno já feito.
<!-- SECTION:NOTES:END -->
