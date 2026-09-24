---
id: TASK-34
title: V2-T44 — O esqueleto do projeto não escreve CLAUDE.md
status: To Do
assignee: []
created_date: '2026-09-24 10:45'
labels: []
dependencies: []
references:
  - backlog/decisions
priority: medium
type: bug
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T44 — O esqueleto do projeto não escreve `CLAUDE.md`.** Achado da revisão das decisões
(V2-T39, 2026-09-24), resolvido pelo mantenedor no mesmo dia.

**O defeito.** A **D-030** diz que o `seeya` não escreve arquivo específico de harness. Mas
`packages/engine/src/core/project-skeleton.ts#buildClaudeMd` cria um `CLAUDE.md` em **todo** projeto
novo, incondicionalmente — um arquivo com o nome de um harness, escrito por `core/`, sem olhar o
`defaultHarness` do projeto. O ponteiro de uma linha para o `AGENTS.md` é fiel ao rumo, mas o
arquivo em si não deveria existir.

**A correção decidida pelo mantenedor:** **só `AGENTS.md`**. Não é para gerar `CLAUDE.md` nem
condicioná-lo ao `defaultHarness` — some inteiro. O motivo medido: a versão atual do Claude Code já
lê `AGENTS.md` direto, então o ponteiro deixou de comprar alguma coisa (mantenedor, 2026-09-24).

**O que entra:**

1. Remover `buildClaudeMd` e a entrada correspondente de `buildProjectSkeleton`. O esqueleto passa a
   ser `AGENTS.md` + `INDEX.md` + as seis pastas.
2. Atualizar os testes que afirmam a lista de arquivos do esqueleto —
   `tests/unit/core/project-skeleton.test.ts` e o que mais assertar sobre `writeProjectSkeleton`. O
   teste tem de afirmar **a lista inteira**, não só "contém `AGENTS.md`": é o que impede o arquivo
   voltar sem ninguém ver.
3. Conferir se algum texto de saída da CLI (`seeya project create`/`show`) ou do `README.md` promete
   o `CLAUDE.md`; se prometer, corrigir junto.
4. Citar **D-030** no comentário do módulo, no lugar do trecho que hoje justifica o `CLAUDE.md` pelo
   `docs/V2-RUMO.md`. O comentário atual está certo sobre a convenção e errado sobre a conclusão —
   reescreva a conclusão, preserve a parte medida.

**O que NÃO entra: mexer em projeto que já existe.** O `seeya` não apaga um arquivo que a pessoa
pode ter editado. Projetos criados antes desta tarefa ficam com o `CLAUDE.md` que já têm; a correção
vale para os próximos. Diga isso no relatório — não é esquecimento, é escopo.

**Aceite:** `seeya project create` num espaço de trabalho descartável produz um projeto **sem**
`CLAUDE.md`, e `npm run verificar` passa.
<!-- SECTION:DESCRIPTION:END -->
