---
id: TASK-35
title: V2-T45 — Atualização por máquina desliga autostart e não religa
status: To Do
assignee: []
created_date: '2026-09-24 11:12'
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
5. **Corrigir os comentários que citam `%TEMP%\seeya-installer.log`**, que não existe. Onde a saída
   do instalador vai de fato (a janela de detalhes, enquanto ela está aberta) é o que se escreve.

**Limite que precisa estar no relatório e no aceite:** a correção do item 1 mora no desinstalador
**da versão corrigida**. A primeira atualização para ela ainda roda o desinstalador de hoje, que
desliga o autostart mais uma vez. Só a **segunda** atualização prova o item 1.

**Restrições:** não instalar, não desinstalar, não rodar instalador nesta máquina — o agente
compila (`npm run dist:windows`) e lê; quem executa é o mantenedor. Nenhuma dependência nova: tudo o
que está acima já vem no template do `electron-builder`.

**Aceite do mantenedor (Windows, por máquina):** instalar o build corrigido uma vez (o autostart
ainda pode cair — é o limite acima); ligar daemon e autostart; instalar o mesmo build por cima e
cronometrar. Ao abrir a janela: **daemon de pé, autostart ligado**, e o tempo de instalação dito
no comentário da tarefa.
<!-- SECTION:DESCRIPTION:END -->
