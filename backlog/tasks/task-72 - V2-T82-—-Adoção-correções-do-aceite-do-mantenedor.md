---
id: TASK-72
title: 'V2-T82 — Adoção: correções do aceite do mantenedor'
status: Review
assignee: []
created_date: '2026-10-02 17:29'
updated_date: '2026-10-02 18:48'
labels:
  - ui
dependencies: []
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Aceite do mantenedor da V2-T70 (2026-10-02, instalador 13:40, adoção real). (1) Close abre o projeto: em renderer/features/adoption/AdoptionDialog.tsx os botões Close e Open project chamam o mesmo controls.closeResult, que em useAdoption.ts chama api.openProject sempre que state.adopted — Close tem de só fechar; só Open project abre. Esc/fechar pelo diálogo = Close. Teste renderizado que trava os dois caminhos (falha antes da correção). (2) Cartão do resultado colado nos botões: o rodapé do Dialog compartilhado (components/Dialog/Dialog.module.css#.footer) não tem espaço em relação ao corpo — corrigir no componente (vale para todo diálogo com footer), conferindo os outros diálogos que usam footer (End day, confirmações, New project) para não dobrar espaço onde o corpo já termina com margem. (3) Diálogo de revisão ocupa a vertical inteira com 9 arquivos: max-height hoje é 100vh menos uma margem pequena; dar um teto próprio (algo como min(80vh, 720px), medido nas capturas) com a lista rolando por dentro, cabeçalho e rodapé fixos; conferir que End day e mudanças pendentes ficam coerentes com o mesmo teto. (4) A revisão lista arquivos que não entram no commit: a tela mostrou '9 files' incluindo teste-projeto/.claude/settings.json e teste-projeto/.seeya-audit, mas o commit da adoção teve 7 — os dois são ignorados pelo .gitignore do espaço de trabalho (.seeya-audit, **/.claude/). O commit está certo; a lista está errada. Achar a causa com medição (hipótese: listChangedFilesWithStats roda antes de o .gitignore do espaço de trabalho ganhar os padrões, que só são garantidos no commitAll; ou a contagem de arquivos novos lê o disco sem passar pelo ignore) e corrigir de modo que a lista seja exatamente o que commitAll vai commitar — teste de integração contra repositório git real temporário que falha antes da correção, cobrindo também listChangedFiles/listChangedFilesWithStatus (mudanças pendentes do open) se tiverem o mesmo defeito. Capturas reais nos dois temas: revisão com 9+ arquivos (altura), resultado de sucesso (espaço), e prova por instrumentação de que Close não abre aba e Open project abre.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Item 4, causa medida.** Reproduzido num repositório git real temporário (`tests/integration/workspace/listing-matches-commit.test.ts`): espaço de trabalho com `.gitignore` antigo (só `.seeya-lock`), projeto com `.claude/settings.json` e `.seeya-audit` no disco mais uma mudança real. Antes da correção, `listChangedFiles` devolvia 3 caminhos (os dois operacionais inclusos), e o commit seguinte de `commitAll` continha 1 — a diferença exata do aceite (9 listados, 7 commitados). Causa: hipóteses (a)/(c) — os padrões de ignore (`.seeya-audit`, `**/.claude/`) só eram garantidos dentro de `commitAll` (`ensureWorkspaceGitignoreIgnoresProjectLock`), e as três listagens (`listChangedFiles`, `listChangedFilesWithStatus`, `listChangedFilesWithStats`) rodam ANTES, contra um `.gitignore` que no espaço do mantenedor ainda era o antigo. Não era (b): a contagem de linhas só roda para o que o `git status` já listou. Correção: as três listagens chamam a mesma função (agora exportada) antes de ler o status, então lista e commit usam a mesma verdade; o que é commitado não mudou (o `.gitignore` atualizado entra no commit seguinte, como já entrava). Efeito colateral aceito: uma listagem pode reescrever o `.gitignore` do espaço de trabalho (dentro dele, idempotente).

**Item 1.** `useAdoption.ts`: `closeResult` só dispensa; `openProjectFromResult` abre e dispensa. Esc/fechar = `closeResult`. Três testes renderizados em `AdoptionDialog.test.tsx` (Close, Esc, Open project); confirmado que os dois primeiros falham contra o código antigo. Prova na janela real: `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG` (HarnessLauncher fictício) + `SEEYA_APP_VERIFY_ADOPTION_RESULT_BUTTON`: Close = 0 chamadas de `open` nos dois temas; Open project = 1 chamada nos dois.

**Itens 2 e 3 (Dialog compartilhado).** `Dialog.module.css`: `.footer` ganhou `margin-top: var(--seeya-space-4)` (16px); `.scrollableBody[open]` passou de `calc(100vh - space-8)` para `min(80vh, 720px)` com `box-sizing: border-box` (sem isso, com `content-box`, medido: janela de 1000px desenhava 845px = 84%; com `border-box`, 800px = 80%). Escolhi o teto compartilhado: End day (preview conferido nos dois temas) e as três confirmações usam o mesmo `footer` e ficam coerentes; `display` continua só sob `[open]` (guard). Nenhum chamador dobrava o espaço (os `margin-bottom` de `end-day/*Pane` são entre itens de lista); nenhum precisou de ajuste. Settings monta o próprio layout e não usa a prop `footer`.

**Prova visual** (scratchpad, janela real, home descartável, `HarnessLauncher`/adoção fictícios): revisão com 17 arquivos (rolagem interna, título e rodapé fixos), resultado de sucesso e End day, nos temas claro e escuro. O fake de adoção agora também deixa `.claude/settings.json` e `.seeya-audit` no projeto; a lista continua em 17 (nenhum dos dois aparece). `HKCU\Software\Classes\seeya`/`seeya-dev` e o hash de `protocol-handler.json` real (`E3D8A283…`) inalterados antes e depois.

Instrumentação nova (em AGENTS.md): `SEEYA_APP_VERIFY_FAKE_HARNESS_LOG`, `SEEYA_APP_VERIFY_ADOPTION_RESULT_BUTTON`.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Claude
created: 2026-10-02 18:29
---
PO pediu conferir os diálogos do V2-T71 contra o Dialog compartilhado alterado. Capturas reais nos dois temas (projeto travado com processo-isca real e procStart lido pelo adaptador, mudanças pendentes com 18 arquivos, retomada que falhou nas duas formas, transição do daemon em repouso e em loading) e a 04-result clara da adoção, todas abertas e olhadas: nenhum diálogo ficou cortado pelo teto 80vh/720px nem com espaço dobrado; os três cartões da retomada cabem sem rolagem; a lista longa rola por dentro com título e rodapé fixos. Observação: o espaço entre o último parágrafo e os botões soma a margem padrão de p com os 16px do rodapé, legível e coerente nos cinco diálogos; a folga entre parágrafos dentro dos corpos é anterior a esta tarefa. Ajuste de instrumentação: a espera da captura em repouso da transição do daemon subiu de 4s para 7s (aos 4s o diálogo ainda não tinha aparecido).
---

author: PO
created: 2026-10-02 18:48
---
Revisão do PO (2026-10-02): os quatro defeitos do aceite corrigidos. (1) Close/Esc só fecham; Open project abre — provado na janela real por contagem de chamadas ao HarnessLauncher fictício (0 e 1) e por três testes renderizados que falhavam antes. (2) Dialog compartilhado: margem de 16px acima do rodapé. (3) Teto min(80vh, 720px) com box-sizing border-box, lista rolando por dentro. (4) Causa medida com git real: os padrões .seeya-audit e **/.claude/ só eram garantidos no .gitignore dentro de commitAll, e as listagens rodavam antes (3 listados vs 1 commitado na reprodução); as três listagens agora garantem os padrões antes de ler — efeito colateral registrado: uma listagem pode reescrever o .gitignore do espaço de trabalho (idempotente, a mesma escrita do commit). Diálogos da V2-T71 e do End day reconferidos em captura com o Dialog alterado, sem espaço dobrado nem corte. Mesclada no po-gate; portão do zero e npm test sem identidade git verdes (3734 testes). Agente Sonnet 5.5.
---
<!-- COMMENTS:END -->
