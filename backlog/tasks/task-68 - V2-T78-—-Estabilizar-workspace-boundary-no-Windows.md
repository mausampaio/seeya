---
id: TASK-68
title: V2-T78 — Estabilizar workspace-boundary no Windows
status: Review
assignee: []
created_date: '2026-10-02 00:54'
updated_date: '2026-10-02 15:19'
labels:
  - test
dependencies: []
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
tests/integration/application/workspace-boundary.test.ts, caso 'workspace.json (the pointer to where the workspace lives) is written outside the workspace itself', estourou 5000ms e deixou EBUSY no rmdir do diretório temporário no Windows sob carga paralela — duas vezes em 2026-10-01 (agente da V2-T69 localmente; CI windows-latest do commit beb731d, run 36944338002, verde no rerun). Achar a causa (processo git filho ainda segurando o diretório? timeout curto demais para o que o caso faz?) e corrigir a causa, não só aumentar o timeout; se o timeout for de fato a resposta, medir e justificar o número. Regra de AGENTS.md: paralelismo expõe corrida — não serializar o arquivo para esconder.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Branch e commits** (`tarefa/V2-T78-workspace-boundary`, rebaseada sobre `origin/main`
`bdfdc05` — ver nota de renumeração abaixo): `003ed7b` (o fix em
`tests/integration/application/workspace-boundary.test.ts`), `8b93626` (Q-107 em
`docs/QUESTOES.md`, o segundo achado do despacho).

**Causa medida — `workspace-boundary.test.ts`.** Cada caso roda `createProject` de ponta a
ponta: `git init`, dois `git config --local`, instalação do gancho, `git add`,
`git diff --cached --quiet`, e `git commit` — cujo próprio `commit-msg` hook chama de volta um
SEGUNDO processo `node` real (a CLI compilada, `verify-commit`), que por sua vez lança um
terceiro `git diff` (`listStagedFiles`). Medido nesta máquina, isolado, sem carga nenhuma:
~0,8-2,5s por caso — já mais da metade do prazo padrão do vitest (5000ms) com contenção zero.

A causa não é um processo filho da produção mal esperado: `run-git.ts#runGit` sempre resolve só
no evento `close`, e o próprio script do gancho usa `exec` (nunca um processo em segundo plano
desacoplado), então `git commit` só retorna depois que TODA a árvore (sh.exe → node → git)
já terminou. Confirmado por reprodução determinística, não por suposição: dando a um caso um
prazo artificialmente minúsculo (50ms, revertido antes do commit) os dois sintomas relatados no
despacho aparecem JUNTOS — "Test timed out in 50ms" seguido de
`EBUSY: resource busy or locked, rmdir '...\workspace'`. O vitest não cancela de verdade a
`Promise` em execução de um teste que estourou o prazo (não existe cancelamento real de um
`await` em JavaScript) — a cadeia de processos ainda viva continua escrevendo/segurando o
diretório por mais um instante, e o `rm` do `afterEach` perde essa corrida no Windows.

**Correção (dupla, a mesma dupla que `AGENTS.md` autoriza).** 1) Prazo explícito de 20000ms por
caso (`WORKSPACE_CASE_TIMEOUT_MS`), medido e justificado no comentário do próprio arquivo — larga
margem sobre o custo real medido (≤2,5s sem carga), na mesma ordem de grandeza da generosidade já
medida e aceita para `tests/integration/guards/_support.ts#CHILD_PROCESS_BUDGET_MS` (30s/45s para
uma operação mais leve, sob a mesma espécie de contenção entre projetos vitest). 2) `fs.rm` com
`maxRetries: 5, retryDelay: 100` no `afterEach` — não para esconder um timeout genuíno (confirmado:
com o prazo artificial de 50ms ainda ativo, o retry absorve o `EBUSY` mas o "Test timed out"
continua aparecendo, como deveria), mas como reforço contra a mesma folga de alguns milissegundos
que o Windows já demonstrou ter entre o evento `close` de um processo filho e a liberação real do
handle do diretório — a MESMA técnica e o MESMO raciocínio que `tests/e2e/_harness.ts#removeE2eHome`
já usa, com um `EBUSY` real idêntico, para exatamente este tipo de limpeza.

**Reprodução — números.** Antes da correção: reprodução determinística 1/1 (prazo forçado de
50ms → "Test timed out" + `EBUSY`, toda vez). Depois da correção: mesmo prazo forçado de 50ms →
"Test timed out" continua (correto, prova que o retry não mascara um timeout real), `EBUSY`
desaparece. Com o prazo real (20000ms) em vigor: arquivo isolado, 3/3 passam (≈0,7-2,5s por caso,
três execuções seguidas); `npm test` completo (4 projetos vitest concorrentes, 375 arquivos) rodou
3 vezes nesta máquina sem alteração nenhuma de `fileParallelism`/paralelismo — 375 passaram nas
três; uma quarta combinação (`integration-process` + `guards` juntos, sem `unit`/`integration`)
também passou. `npm run verificar` do zero (`rm -rf dist`+`tsbuildinfo`, build, lint, dependencias,
cobertura) passou limpo: 375 arquivos, 3581 testes, cobertura 95,86%/91,61%/95,45%/96,06%
(stmts/branches/funcs/lines), `dependencias` sem violação (763 módulos).

**Segundo achado — `eslint-restrictions.test.ts`/`app-eslint-restrictions.test.ts` (Q-107,
`docs/QUESTOES.md`).** A primeira execução de `npm test` nesta tarefa (sem carga artificial minha)
já reproduziu o timeout pedido no despacho: os dois arquivos mortos pelo próprio orçamento interno
do processo filho (`CHILD_PROCESS_BUDGET_MS`, 30000ms). Registrado como questão, não corrigido
aqui — não é a mesma causa nem trivialmente parecida: aquele arquivo já tem um orçamento próprio
generoso e já medido duas vezes (Q-063/Q-064), o processo filho que estourou é `kill`ado de forma
limpa (nunca um handle órfão que algum `rm` precise disputar), e o sintoma nunca foi `EBUSY` — foi
só o próprio orçamento interno, já generoso, sendo insuficiente na hora em que outro projeto vitest
competiu pela CPU da máquina. Alargar esse orçamento sem medição nova seria o "aumentar o timeout
sem medir" que `AGENTS.md` proíbe, e Q-063/Q-064 já registraram que a causa raiz (por que o runner
fica mais carregado numa hora e não noutra, entre projetos vitest diferentes) está fora do alcance
de `vitest.config.ts`. Q-107 registra esta nova observação (a primeira reprodução depois daquelas
duas tarefas, sem carga artificial) e as duas opções que vejo, para o PO decidir.

**Renumeração (pedido do PO, pós-aprovação de conteúdo).** A V2-T68 foi publicada em `origin/main`
enquanto esta tarefa estava em andamento e usou `Q-106` em `docs/QUESTOES.md` antes da minha
questão (criada numa `origin/main` mais antiga, também com o número `Q-106` livre naquele ponto).
Rebaseei `tarefa/V2-T78-workspace-boundary` sobre o `origin/main` atualizado (`bdfdc05`) e
renumerei minha entrada para `Q-107` — único lugar onde ela aparecia: `docs/QUESTOES.md` (o próprio
título e corpo da entrada), e as duas menções nestas notas. Nenhum comentário de código cita
`Q-106`/`Q-107`. Conflito em `docs/QUESTOES.md` resolvido mantendo as duas entradas completas (a
`Q-106` da V2-T68 intocada, a minha como `Q-107` logo depois). Os hashes de commit acima já são os
pós-rebase; os commits anteriores (`5bd042e`/`ff17540`) não existem mais no histórico da branch.

**Recusas encontradas:** nenhuma.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-02 15:19
---
Revisão do PO (2026-10-02): causa medida (createProject de ponta a ponta com git+gancho+CLI leva até 2,5s sem carga; sob carga estoura 5s e o git ainda vivo causa EBUSY no rm). Prazo de 20s justificado pela medição e rm com maxRetries (precedente de tests/e2e/_harness.ts). Questão renumerada para Q-107 (a V2-T68 já usara Q-106). O resíduo dos guardas do eslint vai para a V2-T80. Mesclada no po-gate; portão do zero e npm test sem identidade git verdes junto com a V2-T71 (3672 testes).
---
<!-- COMMENTS:END -->
