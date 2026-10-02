---
id: TASK-70
title: V2-T80 — Testes estáveis sob carga
status: To Do
assignee: []
created_date: '2026-10-02 13:15'
labels:
  - test
dependencies: []
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dois testes falham quando a máquina está carregada (agentes compilando/testando em paralelo), tornando npm run verificar vermelho sem defeito de produto — medido em 2026-10-02 no portão da V2-T78: 12 e depois 14 falhas. (1) Guardas do eslint (tests/integration/guards/eslint-restrictions.test.ts e app-eslint-restrictions.test.ts) abrem um processo eslint por caso e estouram CHILD_PROCESS_BUDGET_MS sob carga — Q-107 (antes Q-063/Q-064). Correção proposta: rodar o eslint pela API (new ESLint(...).lintText/lintFiles) dentro do próprio processo de teste, reaproveitando uma instância, em vez de um processo filho por caso; provar que o guard continua reprovando o proibido E aprovando o permitido, e medir o tempo antes/depois. Não aumentar prazo para esconder. (2) tests/unit/app/resume/tab-session-resumer.test.ts, caso 'removes the scratch file once the fallback tab eventually exits', espera a remoção assíncrona do arquivo com um setTimeout(0) e falha sob carga ('expected [ Array(1) ] to have a length of +0 but got 1'). Correção: esperar a conclusão real (expor/aguardar a promise da remoção, ou vi.waitFor com condição), nunca um sleep maior. Procurar o mesmo padrão (setTimeout(0)/sleep para esperar I/O) em outros testes. Reprodução antes/depois sob carga artificial, com números.
<!-- SECTION:DESCRIPTION:END -->
