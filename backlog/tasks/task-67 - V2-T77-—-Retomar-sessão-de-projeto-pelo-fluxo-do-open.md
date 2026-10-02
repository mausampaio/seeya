---
id: TASK-67
title: V2-T77 — Retomar sessão de projeto pelo fluxo do open
status: Review
assignee: []
created_date: '2026-10-01 21:03'
updated_date: '2026-10-02 21:50'
labels: []
milestone: m-0
dependencies: []
priority: high
type: feature
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 5a. Caso real do mantenedor (2026-10-01): a máquina reiniciou no meio de uma sessão aberta por `open` e não havia como voltar a ela pelo seeya — só por `claude --continue` manual no diretório do projeto, sem lock nem proteções. Entra: (1) no motor, `openProject` aceita uma sessão para retomar (`--resume <id>` no lugar de `--session-id` novo), com lock, ganchos, CLAUDE.md, restauração do seeya.json e pergunta de mudanças pendentes iguais ao open; o lock registra a sessão retomada; (2) CLI `seeya project open <id> --resume <sessão>` (id ou prefixo); (3) janela: Resume nas sessões de cada projeto (aba Projects) e no Resume da aba Sessions quando a sessão é de um projeto. Recusa (D-024, com motivo) se a sessão estiver viva. Depois da interface (V2-T67 a V2-T71), por decisão do mantenedor; a V2-T67/V2-T68 deixam o lugar do botão previsto.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-02 21:50
---
Revisão do PO (2026-10-02): aprovada numa rodada. openProject aceita sessão a retomar (união nova/retomada; --resume no lugar de --session-id; lock registra a retomada), recusas com motivo (sessão viva, sessão fora do projeto, referência ambígua) antes de qualquer efeito colateral; CLI seeya project open <id> --resume <sessão>; janela com linha expansível na aba Projects (5 sessões, Go to tab/Resume, Show all in Sessions) e Resume de projeto na aba Sessions; aviso do resultado sempre visível. Prova: capturas nos dois temas e harness fictício registrando launch=resume com o id certo. Limites registrados (Q-109): regras de trabalho/aviso de lock não chegam à sessão retomada (Q-069, não remedido em sessão interativa); sessão fora de relevanceHours só pela CLI. Piso da janela 1200x700 (700 medido). Mesclada com a V2-T50; portão do zero e npm test sem identidade git verdes (3828 testes). Agente Sonnet 5.5 (65 min).
---
<!-- COMMENTS:END -->

<!-- SECTION:NOTES:BEGIN -->
Entrega (branch `tarefa/V2-T77-retomar-sessao-de-projeto`).

Motor: `openProject` ganhou `OpenSessionRequest` (`new`/`resume`, D-024) e `HarnessLauncher.open` recebe `HarnessSessionLaunch` (`fresh`/`resume`) no lugar do id solto; `buildOpenArgs` troca `--session-id` por `--resume` na mesma posição, `--` continua terminando o `--add-dir`. Recusas antes de qualquer efeito: `sessionRunning` e `sessionNotInProject` (`core/project-session-membership.ts`, a mesma evidência do agrupamento da lateral, agora compartilhada). O lock registra a sessão retomada. Sem `--append-system-prompt` na retomada (Q-069, não remedido).

CLI: `seeya project open <id> --resume <sessão>` (resolução do `adopt`, com a busca direta fora de `relevanceHours`); avisa antes de lançar que as regras não chegam à sessão retomada.

Janela: linha expansível na aba Projects (até cinco sessões, Resume/Go to tab, "Show all N in Sessions"), Resume de sessão de projeto na aba Sessions, canal `resumeProjectSession` (mesmo pipeline e mesmas perguntas do Open), aviso de resultado dispensável nas duas abas. Piso da janela 1200x700 (700 medido). Questão: Q-109.

Prova: capturas nos dois temas e log do harness falso (`launch: resume` com o id, nos dois cliques). Provas em scratchpad, fora do repo.
<!-- SECTION:NOTES:END -->
