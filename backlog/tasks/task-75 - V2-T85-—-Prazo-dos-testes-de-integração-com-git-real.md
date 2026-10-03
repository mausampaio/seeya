---
id: TASK-75
title: V2-T85 — Prazo dos testes de integração com git real
status: Review
assignee: []
created_date: '2026-10-02 21:17'
updated_date: '2026-10-03 02:48'
labels:
  - test
dependencies: []
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Com cinco agentes rodando em paralelo (2026-10-02), npm run verificar do agente da V2-T31 falhou duas vezes, cada vez num teste diferente que roda git de verdade e estourou o prazo padrão de 5000ms do vitest: tests/integration/git/git-adapter.test.ts ('leaves the main worktree… identical', seguido de EBUSY no rmdir) e tests/integration/workspace/fs-workspace-repository.test.ts ('findCommitsAfter…'). Os dois passam isolados (14/14 e 60/60). Mesma classe da V2-T78 (workspace-boundary), que corrigiu um arquivo só. Fazer de uma vez: medir, sob carga artificial, o tempo dos testes de integração que lançam processos reais (git, CLI compilada) e dar ao(s) projeto(s) vitest de integração um testTimeout próprio justificado pela medição (como guards/_support.ts já faz para os guards), em vez de prazo por arquivo; rm de diretório temporário com maxRetries onde um processo filho pode ainda estar vivo (precedente: tests/e2e/_harness.ts, V2-T78). Não serializar nem desligar paralelismo. Reprodução antes/depois sob carga, com números; listar os arquivos cobertos.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Branch** `tarefa/V2-T85-prazo-testes-git`. Só `tests/**`, `vitest.config.ts` e `docs/QUESTOES.md` (Q-112); nenhum `packages/*/src` tocado, nenhuma corrida de produção achada.

**Medição** (2026-10-02, máquina de 8 núcleos, compartilhada com outros agentes; carga = `load.mjs N 600`, N laços de CPU que saem sozinhos; JSON do vitest por rodada). Projetos `integration` + `integration-process` (575 testes), código antes de editar:
- sem carga: 1 rodada, 0 falhas, 90s de parede, o mais lento 3,1s (daemon real em `app/daemon-launch`), casos de git do espaço de trabalho 1-2,3s cada;
- 12 laços: 3 rodadas, 573-590s de parede, **32/38/35 falhas em 3 de 3** (todas no prazo de 5000ms do vitest, exceto as de grace abaixo): todo caso de `fs-workspace-repository` e `changed-file-stats` (menos 2), `app/composition`, `deep-generator`, `spawn-interactive`, mais um `EBUSY` no `rmdir` de `fs-workspace-repository` (o mesmo par timeout+EBUSY da V2-T78); testes que já tinham 30s explícito levaram até 21,8s.
- não-timeout: `resumer` (4 casos) e `spawn-interactive` (1) falhavam em 3 de 3 por **`fastFailureGraceMs: 2_000`** — a janela de "falha rápida" conta desde o spawn, então a partida do `node` do falso `claude` já a estoura sob carga e a asserção inverte. Não é prazo de teste: é janela de classificação medida contra a máquina.

**O que mudou**
- `vitest.config.ts`: `INTEGRATION_TEST_TIMEOUT_MS`/`INTEGRATION_HOOK_TIMEOUT_MS` = 60s, nos DOIS projetos `integration`/`integration-process`; `unit` segue no padrão. Primeira escolha foi 30s (0 falhas em 3 de 3 no `integration` isolado, mais lento 23,0s, o antigo pior caso de 5s virou 13,8s) mas **não bastou dentro do `npm run cobertura` inteiro** (todos os projetos + cobertura num processo só): com 6 laços `daemon-launch` (2 casos) e `commit-msg-hook` chegaram a 32s e estouraram; com 12 laços o mesmo. 60s = pior caso (32,4s) com 1,8x de margem; um teste que passa nunca gasta o teto, então a suíte não fica mais lenta.
- `tests/_remove-temp-dir.ts#removeTempDir` (um só helper, `rm` com `maxRetries: 5`/`retryDelay: 100`) usado em todo `afterEach`/fixture de integração/e2e que lança processo: `workspace/*` (8 arquivos), `git/*` (3), `harness/harness-hook-command`, `process/daemon-launch`+`termination`, `cli/daemon-command`, `app/project-details-reader`, `application/project-lock`+`workspace-boundary`, `resumption/_fixtures`+`resumer`, `generation/_fixtures`, `e2e/_harness.ts#removeE2eHome` (que ficou com um só ponto de retry).
- Prazos por arquivo removidos por redundância: `WORKSPACE_CASE_TIMEOUT_MS` (20s, V2-T78) de `workspace-boundary`; o `vi.setConfig({ testTimeout: 30_000 })` de `project-details-reader`; os `30_000` de `commit-msg-hook` (incl. o do `beforeAll`), `local-identity` e `harness-hook-command`; os `60_000` de `listing-matches-commit`; e os que ficavam ABAIXO do projeto (`daemon-launch` 20s ×2 — os dois falharam em 20,0s no primeiro `verificar` sob carga —, `daemon-command` 20s, `composition` 15s).
- `resumption/_fixtures.ts#FAKE_CLAUDE_FAST_FAILURE_GRACE_MS` = 20s, usada pelos 6 lugares que passavam 2_000 (os dois testes que provam o contrário, grace 50ms, ficam como estão: não invertem sob carga).
- `guards/_support.ts`: `FULL_TREE_CHILD_PROCESS_BUDGET_MS` (90s) / `FULL_TREE_TEST_TIMEOUT_MS`, só para o filho do `dependency-cruiser` sobre a árvore inteira — 3,9s sem carga, morto pelo orçamento de 30s do filho em 4 de 4 `cobertura` com carga (30,3s, 30,9s...). Os outros filhos de guard ficam com `CHILD_PROCESS_BUDGET_MS`.
- Polls (`waitForFile`/`waitForLockFile` 5s, `waitUntilGone` 10s, os 2s de `termination`): **nenhum falhou** em 9 rodadas de integração sob carga (3 antes, 3 depois, 3 de cobertura) — não alargados, sem número que os justifique.

**Depois** (mesmo `integration` isolado, 12 laços, 3 rodadas): **0 falhas em 3 de 3**, 574-582s de parede (antes 573-590s: a mesma), mais lento 23,0s. `npm run verificar` inteiro, `rm -rf packages/*/dist` antes de cada: com 4 laços **exit 0 em 2 de 2** (608s e 1080s de parede — a segunda disputada por outros agentes na mesma máquina); sem carga nossa, exit 0 (622s). Antes da correção do `dependency-cruiser`, o mesmo `verificar` com 4 laços reprovava 1 de 1 (só esse caso). Custo: sem carga a suíte passa no mesmo tempo (90s antes, 108s depois no `integration` isolado, dentro do ruído de uma máquina compartilhada; os prazos são tetos, nunca esperas).

**Resíduo medido, fora do escopo e não corrigido** (Q-112): `cobertura` inteiro com 6-12 laços ainda reprova os dois casos de `termination` de orçamento "operação + folga" (8,3s/5,2s — o parágrafo de `docs/TESTES.md` S4-T10 manda não alargar), os dois `*-concurrent-write` (30s explícito, I/O real) e, com 12, `Hook timed out in 180000ms` em guards. 12 laços sobre `verificar` inteiro (28 min) é bem mais que os cinco agentes que originaram a tarefa; por isso a prova de `verificar` usou 4.

**Recusas:** nenhuma de comando; a ferramenta de shell recusou vários comandos compostos por conterem "git" em nome de arquivo ou heredoc — dividi em comandos simples, sem contornar.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-03 02:48
---
Revisão do PO (2026-10-02): aprovada numa rodada. Medido sob 12 busy-loops: antes 32–38 falhas por execução (3/3), depois 0 (3/3), mais lento 23s. Prazo de integração 60s num lugar só (vitest.config.ts, com a medição no comentário); unidade continua em 5s; helper único removeTempDir com maxRetries em ~20 arquivos; folga de falha rápida do claude fictício 2s→20s (5 testes invertiam o resultado, não estavam lentos); guarda full-tree do dependency-cruiser com prazo próprio; prazos por arquivo redundantes removidos. Nenhuma corrida real nem defeito de produção. Limite registrado: com 6–12 loops ainda falham os dois casos de termination com orçamento apertado de propósito (docs/TESTES.md S4-T10 manda não alargar) — Q-112 pergunta se docs/TESTES.md ganha um parágrafo sobre o prazo padrão de integração. Mesclada no po-gate; portão do zero e npm test sem identidade git verdes (3912 testes). Agente Sonnet 5.5.
---
<!-- COMMENTS:END -->
