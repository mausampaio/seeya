---
id: TASK-75
title: V2-T85 — Prazo dos testes de integração com git real
status: To Do
assignee: []
created_date: '2026-10-02 21:17'
labels:
  - test
dependencies: []
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Com cinco agentes rodando em paralelo (2026-10-02), npm run verificar do agente da V2-T31 falhou duas vezes, cada vez num teste diferente que roda git de verdade e estourou o prazo padrão de 5000ms do vitest: tests/integration/git/git-adapter.test.ts ('leaves the main worktree… identical', seguido de EBUSY no rmdir) e tests/integration/workspace/fs-workspace-repository.test.ts ('findCommitsAfter…'). Os dois passam isolados (14/14 e 60/60). Mesma classe da V2-T78 (workspace-boundary), que corrigiu um arquivo só. Fazer de uma vez: medir, sob carga artificial, o tempo dos testes de integração que lançam processos reais (git, CLI compilada) e dar ao(s) projeto(s) vitest de integração um testTimeout próprio justificado pela medição (como guards/_support.ts já faz para os guards), em vez de prazo por arquivo; rm de diretório temporário com maxRetries onde um processo filho pode ainda estar vivo (precedente: tests/e2e/_harness.ts, V2-T78). Não serializar nem desligar paralelismo. Reprodução antes/depois sob carga, com números; listar os arquivos cobertos.
<!-- SECTION:DESCRIPTION:END -->
