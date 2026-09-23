---
id: decision-5
title: D-005 — Daemon próprio para o agendamento
date: '2026-09-23 10:53'
status: accepted
---
## Contexto

## Decisão

`seeya daemon` é um processo de longa duração que cuida do relógio, das notificações
prévias, do adiamento e do disparo. Não usamos Task Scheduler / cron / launchd para a lógica.

## Consequências

- Instância única obrigatória: lockfile em `~/.seeya/daemon.lock` com PID e
  verificação de liveness.
- O daemon precisa sobreviver a suspensão da máquina: o disparo é decidido comparando relógio
  de parede, nunca contando `setTimeout` longo.
- Instalar o daemon no autostart do SO é tarefa do Sprint 5, não da lógica.
- **O daemon se desliga do shell que o iniciou.** Não é processo filho preso ao terminal: sobe
  desanexado, sem console, e sobrevive a fechar a janela, encerrar o shell ou deslogar. Um daemon
  que morre junto com quem o chamou não é um daemon — é um comando em segundo plano.

  Acrescentado em 2026-08-18, a partir de uma observação do mantenedor. A ausência disto no texto
  original era buraco, não omissão deliberada: o `seeya daemon &` num shell parecia suficiente e
  não é.

  Em Node, `detached: true` + `stdio: 'ignore'` + `unref()` cobre os dois mundos: no POSIX faz
  `setsid`, e no Windows usa `DETACHED_PROCESS`, que dá **console nenhum**. Medido no Spike G, de
  lado: um processo assim recusa `AttachConsole` com erro 6.

  **Consequência de segunda ordem, e é o motivo de isto ter aparecido agora:** sem console, o
  daemon fica **inalcançável por evento de console**. O risco de o `seeya` se matar com o
  Ctrl+Break que ele mesmo gera (S1-T2b) desaparece por construção, em vez de depender de uma
  proteção que alguém precisa lembrar de manter.

  **Custo assumido:** desanexado, o daemon não escreve no terminal de quem o subiu. Diagnóstico
  passa a ser arquivo de log e `seeya daemon --status`, não saída ao vivo. É o comportamento
  normal de daemon, mas é uma troca real e fica registrada aqui para não ser redescoberta como
  defeito.
