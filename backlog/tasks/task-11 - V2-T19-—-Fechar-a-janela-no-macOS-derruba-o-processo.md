---
id: TASK-11
title: V2-T19 — Fechar a janela no macOS derruba o processo
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels:
  - parada
  - macos
milestone: m-2
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
priority: low
type: bug
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T19 (na fila, sem pressa) — Correção: fechar a janela no macOS quebra o processo
principal ("Object has been destroyed").** **Prioridade rebaixada pelo mantenedor em
2026-09-20:** *"não uso Mac no dia a dia"* — o defeito continua real e a spec continua
válida, só não disputa lugar com o que dói no uso diário. Entra quando a fila do Windows
esvaziar, ou antes disso se alguém passar a usar o app no Mac com frequência. Especificada pelo PO em 2026-09-20 a partir de um achado do mantenedor no
mesmo dia, com captura de tela.

**O defeito, medido.** No Mac, em `npm run app`, fechar a janela abre o diálogo de erro do
Electron: `Uncaught Exception: TypeError: Object has been destroyed`, com a pilha começando
em `Object.onData` — o `onData` do pty (`node-pty/lib/terminal.js`) chamando
`window.webContents.send` numa janela que já não existe.

**Causa.** `electron/main.ts` tem **treze** chamadas de `webContents.send` e só o laço de
atualização se protege (`shouldStop: () => window.isDestroyed()`). Os avisos que vêm do pty
(`onData`/`onExit`) não se protegem — e no macOS, ao contrário do Windows e do Linux,
**fechar a janela não encerra o app** (`window-all-closed` só encerra fora do darwin): os
terminais continuam vivos, continuam produzindo saída, e a primeira linha que chegar depois
do fechamento derruba o processo principal.

**O que entra:**
1. **Nenhum aviso é enviado para uma janela destruída.** Um único ponto de envio, usado por
   todas as chamadas, que verifica antes; nada de treze verificações copiadas. O tipo faz o
   resto: quem for acrescentar um aviso novo encontra só esse caminho (D-024).
2. **Fechar a última janela desfaz os terminais.** Sem isso, no macOS os processos das abas
   ficariam vivos e invisíveis, sem nenhuma janela por onde voltar a eles — pior que perdê-los
   à vista. É o mesmo efeito que Windows e Linux já têm hoje, onde fechar a janela encerra o
   app e leva as abas junto; o macOS passa a combinar com isso. **Se o mantenedor preferir
   manter as abas vivas entre janelas, isso é decisão dele e vira tarefa própria** — a
   mínima aqui é não deixar processo órfão.
3. **Teste de regressão** que prove o item 1: um aviso emitido depois de a janela ser
   destruída não levanta exceção.

**O que não entra:** mudar a convenção do macOS de manter o app vivo no Dock com a janela
fechada; reabrir as abas ao reabrir a janela (é trabalho de sessão persistida, não desta
correção).

**Cuidados:** nenhuma dependência nova; a verificação manual é no macOS, que é onde o defeito
aparece — se nenhum agente tiver Mac, o item 1 se prova por teste e o aceite final é do
mantenedor.

**Aceite do mantenedor:** no Mac, abrir abas, fechar a janela e não ver diálogo de erro
nenhum; conferir que nenhum processo de aba ficou vivo depois.
<!-- SECTION:DESCRIPTION:END -->
