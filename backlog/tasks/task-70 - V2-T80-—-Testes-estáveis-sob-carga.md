---
id: TASK-70
title: V2-T80 — Testes estáveis sob carga
status: Review
assignee: []
created_date: '2026-10-02 13:15'
updated_date: '2026-10-02 18:21'
labels:
  - test
dependencies: []
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dois testes falham quando a máquina está carregada (agentes compilando/testando em paralelo), tornando npm run verificar vermelho sem defeito de produto — medido em 2026-10-02 no portão da V2-T78: 12 e depois 14 falhas. (1) Guardas do eslint (tests/integration/guards/eslint-restrictions.test.ts e app-eslint-restrictions.test.ts) abrem um processo eslint por caso e estouram CHILD_PROCESS_BUDGET_MS sob carga — Q-107 (antes Q-063/Q-064). Correção proposta: rodar o eslint pela API (new ESLint(...).lintText/lintFiles) dentro do próprio processo de teste, reaproveitando uma instância, em vez de um processo filho por caso; provar que o guard continua reprovando o proibido E aprovando o permitido, e medir o tempo antes/depois. Não aumentar prazo para esconder. (2) tests/unit/app/resume/tab-session-resumer.test.ts, caso 'removes the scratch file once the fallback tab eventually exits', espera a remoção assíncrona do arquivo com um setTimeout(0) e falha sob carga ('expected [ Array(1) ] to have a length of +0 but got 1'). Correção: esperar a conclusão real (expor/aguardar a promise da remoção, ou vi.waitFor com condição), nunca um sleep maior. Procurar o mesmo padrão (setTimeout(0)/sleep para esperar I/O) em outros testes. Reprodução antes/depois sob carga artificial, com números.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Causa. (1) `runEslint` abria um processo `node eslint.js` por caso: cada um paga partida do Node, carga da config e um programa TypeScript type-aware frio; sob carga isso estoura `CHILD_PROCESS_BUDGET_MS`. (2) O caso do resumer esperava um `fs.unlink` real com `setTimeout(0)`, um turno do event loop que a carga ultrapassa.

Mudança. `tests/integration/guards/_support.ts#runEslint` agora é async e usa `new ESLint({ cwd: PROJECT_ROOT })` (instância única por worker, mesma `eslint.config.js` real, `lintFiles` com os mesmos caminhos absolutos, formatter `stylish` = default do CLI, exit 1 se houver erro). Os 21 casos dos dois arquivos continuam os mesmos (reprovam com regra e mensagem certas; controles aprovam). `warmUpEslint` num `beforeAll` com `ESLINT_WARM_UP_TIMEOUT_MS` (180s) paga o custo frio uma vez por arquivo, fora de qualquer caso: o primeiro caso levava 10,5s sem carga e, com 12 processos busy-loop em 8 núcleos, estourou o prazo de 45s por caso em 4 de 11 execuções antes do warm-up; os demais casos levam 0,3-0,7s. Os prazos por caso (`TEST_TIMEOUT_MS`) não mudaram. O resumer usa `vi.waitFor` sobre a condição real (diretório vazio).

Números. Os dois arquivos isolados, sem carga: 90-97s (antes, processo por caso) -> 10,4s (depois). Sob carga artificial (12 busy-loops, 8 núcleos), com warm-up: 8 execuções, 0 falhas (3 delas de 65-106s, o custo frio pago no warm-up); só com a API, sem warm-up: 11 execuções, 4 falhas (timeout de 45s no primeiro caso de cada arquivo). Resumer sob a mesma carga: 10 execuções, 0 falhas. A linha de base antiga sob a minha carga NÃO foi reproduzida: o `git checkout` das versões antigas foi recusado pelo classificador; valem a medida do PO (1, 12 e 14 falhas em três portões) e os 90-97s sem carga.

Varredura de `tests/`. `setTimeout(resolve, 0)` para esperar I/O: só o do resumer (corrigido). `TerminalPane.test.tsx:244`: asserção negativa depois de um `waitFor`, de propósito; mantido. Polls com prazo (`daemon.test.ts`, `daemon-launch.test.ts` x2, `daemon-command.test.ts`, `termination.test.ts`, `commit-msg-hook.test.ts` `waitForFile`): esperam a condição real em laço, ok; os prazos de 2s/5s são o ponto fraco restante sob carga extrema, mas não são corrida. `commit-msg-hook.test.ts:255/451/742` (200ms "deixa o filho começar"): filho real, só precisa do pid vivo; fragilidade baixa, mantido. `concurrency.test.ts`/`end-day.test.ts` (5ms): trabalho simulado em memória. `atomic-write.test.ts`: atrasos deliberados.

Outros guards. `dependency-cruiser.test.ts` e os de cobertura/projetos ainda usam processo filho: a causa (custo de partida por caso) vale, mas não houve falha medida (dependency-cruiser ~2,5s); não alterados.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-02 18:21
---
Revisão do PO (2026-10-02): guardas do eslint pela API do ESLint dentro do processo (uma instância por worker, warm-up num beforeAll com prazo próprio nomeado; prazos por caso inalterados) — 90-97s para 10,4s sem carga; sob carga artificial 8 execuções/0 falhas (antes, só a API sem warm-up: 11/4). tab-session-resumer espera a pasta esvaziar com vi.waitFor — 10/0 sob carga. Varredura de tests/ registrada nas notas. A linha de base antiga sob carga não foi remedida pelo agente (checkout dos arquivos antigos recusado, corretamente não contornado); valem os três portões vermelhos de 2026-10-02 (1, 12 e 14 falhas). Prova do PO: portão do zero e npm test sem identidade git verdes de primeira (3700 testes) com dois agentes de interface rodando em paralelo — a condição que derrubou o portão três vezes hoje. Fecha Q-107 na prática; marcar a questão como respondida quando alguém tocar docs/QUESTOES.md. Primeira tarefa feita com agente Sonnet 5.5.
---
<!-- COMMENTS:END -->
