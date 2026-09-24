---
id: TASK-37
title: V2-T47 — Log do instalador com codificação errada
status: To Do
assignee: []
created_date: '2026-09-24 14:40'
labels: []
milestone: m-3
dependencies: []
references:
  - packages/app/build/installer.nsh
priority: low
type: bug
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T47 — O log do instalador grava a saída da CLI com a codificação errada.** Achado do PO no
aceite da V2-T45 (2026-09-24), lendo o `~/.seeya/installer.log` real do mantenedor.

**O que se vê:**

```
[2026-09-24 11:35:03] [as-user] Restarting the seeya daemon (...)... -- exit 0 -- seeya daemon started (pid <pid>), detached from this terminal â€” closing this window or logging out will not stop it.

```

1. **`â€”` no lugar de `—`.** A CLI imprime UTF-8; o `nsExec::ExecToStack` devolve os bytes, e o
   `FileWrite` do NSIS os grava como se fossem da página de código ANSI. Qualquer caractere fora do
   ASCII na saída da CLI sai assim.
2. **Uma linha em branco depois de cada saída da CLI**: o texto capturado termina em quebra de
   linha, e `seeyaLogWrite` acrescenta outra.

**O que entra:** o log fica legível como texto UTF-8 (medir qual das saídas resolve sem dependência
nova — gravar em UTF-8 com as funções do próprio NSIS, ou converter na captura), e a quebra de linha
final da saída capturada é removida antes de escrever. Teste no mesmo estilo de
`tests/unit/app/build/installer-nsh.test.ts`, e `npm run dist:windows` de verdade.

**O que não entra:** mudar o texto da CLI para evitar o travessão. O problema é do log, não do
texto — outra saída com acento cairia no mesmo lugar.

**Aceite:** numa próxima instalação por cima, o `installer.log` mostra o travessão correto e sem
linhas em branco entre os passos.
<!-- SECTION:DESCRIPTION:END -->
