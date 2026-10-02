---
id: TASK-37
title: V2-T47 — Log do instalador com codificação errada
status: Review
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Medição (harness `makensis` descartável, fora do repositório, NSIS 3.0.4.1 Unicode do cache do electron-builder; as MESMAS macros de `installer.nsh`, extraídas por `awk`; log redirecionado para uma pasta de rascunho pelos novos defines `SEEYA_INSTALLER_LOG_DIR`/`_FILE`; comando: `node -e` imprimindo `started — ok café`).**

1. Antes da mudança (só os defines de caminho adicionados). Bytes do arquivo:
   `... 73 74 61 72 74 65 64 20 e2 80 94 20 6f 6b 20 63 61 66 c3 a9 0a 0d 0a 5b 32 ...`
   Achado que corrige o diagnóstico da tarefa: os bytes UTF-8 da CLI JÁ chegam intactos ao arquivo
   (`—` = `E2 80 94`, `é` = `C3 A9`; `ExecToStack` devolve os bytes e `FileWrite` os estreita sem
   alterar). O que falta é o marcador: o arquivo é UTF-8 sem BOM, e leitores do Windows que
   adivinham (PowerShell 5 `Get-Content`, Notepad antigo) assumem ANSI e mostram `â€”`. Isto é a
   explicação coerente com os bytes medidos; não consegui confirmar no log real do mantenedor nem
   com o PowerShell (leitura recusada pelo classificador de permissões, ver relatório) — fica para
   o aceite. Também confirmado: a saída capturada termina em `\n` e `seeyaLogWrite` acrescenta
   `\r\n` -> `0a 0d 0a`, a linha em branco do item 2.
2. Escolha: gravar o arquivo como UTF-8 COM BOM (`EF BB BF`), com `FileWriteByte` do próprio NSIS (sem
   dependência). Descartado: `FileWriteUTF16LE` (o arquivo viraria UTF-16, ilegível por quem lê
   UTF-8 e dobraria o tamanho contra o teto de 256 KiB); converter na captura (os bytes já estão
   certos, não há o que converter).
3. Implementação: `SeeyaLogEnsureUtf8` (+ gêmea `un.`, mesma regra de `SeeyaPathFind`) chamada por
   `seeyaLogWrite` antes de abrir em modo `a`: arquivo ausente/vazio/acima do teto recomeça só com
   o BOM; log antigo sem BOM é copiado byte a byte para `installer.log.utf8` atrás de um BOM e
   trocado por `Rename` — o arquivo inteiro fica em uma codificação só. `seeyaTrimTrailingNewlines`
   tira os CR/LF finais de `$SeeyaLogOutput` antes de escrever.
4. Depois da mudança (hexdump, duas execuções do harness):
   fresco: `ef bb bf 5b 32 30 32 36 ...`, passo 1 `... 20 e2 80 94 20 6f 6b 20 63 61 66 c3 a9 0d 0a 5b 32 ...`
   (sem linha em branco: `0d 0a` e já o próximo `[`); segunda execução sobre o mesmo arquivo:
   um único BOM, linhas acrescentadas (2 ocorrências de "Step one").
   legado (sem BOM, com `—` e linha em branco antiga): `ef bb bf 5b 32 30 32 36 2d 30 39 ...
   e2 80 94 ... 0d 0a 0d 0a 5b 32 ...` — linhas antigas preservadas byte a byte atrás de BOM, as
   novas depois.
   acima do teto (300000 bytes de `x`): recomeçou com 152 bytes, BOM + os dois passos.
5. `npm run dist:windows` de verdade: exit 0, `seeya-0.1.0-x64.exe` gerado, nenhum `warning` na saída
   (o `-WX` do electron-builder tornaria um fatal).
6. Teste: `tests/unit/app/build/installer-nsh.test.ts` (estático, como os demais — não há NSIS no
   `npm test`): BOM nas duas pontas, conversão do log antigo, `Call` antes do `FileOpen ... a`,
   par de Functions por passo, trim antes do `seeyaLogWrite`, defaults de caminho. O teste do teto
   foi ajustado porque o `FileOpen ... w` passou a morar na função de garantia.

**Provado aqui:** que compila (dist) e que a lógica de escrita, isolada, produz os bytes acima.
**Só o aceite prova:** o instalador real (elevado, por máquina) escrevendo em `~/.seeya/installer.log`
e a leitura do log real mostrando `—`; nada foi instalado nem tocado nesta máquina.
<!-- SECTION:NOTES:END -->
