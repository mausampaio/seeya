---
id: TASK-22
title: 'V2-T34 — Fundação da D-047: as guardas'
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels:
  - fundacao
  - d-047
milestone: m-0
dependencies:
  - TASK-20
references:
  - docs/PLANO-DE-ENTREGA.md
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T34 — Fundação da D-047, parte 2: as guardas que não dependem de o agente obedecer.**
Especificada pelo PO em 2026-09-22. **Depende da V2-T33.** É a D-047 item 5: o que precisa
valer sempre é garantido por código.

**O que entra:**
1. **Ganchos de git no repositório do espaço de trabalho**, instalados pelo seeya ao criar o
   espaço de trabalho e **reafirmados a cada `open`** (um gancho apagado volta sozinho). Eles
   recusam, cada um com a mensagem dizendo o que faltou e como deveria ser: commit sem os
   trailers da V2-T33; commit que toca mais de um projeto; commit de uma sessão que não segura
   o lock daquele projeto; commit que inclua o arquivo de lock. **O gancho não depende de o
   `seeya` estar no `PATH`**: chama a verificação do próprio seeya pelo caminho absoluto
   gravado no momento de instalar — e **medir** isso nos três sistemas; no Windows os ganchos
   rodam no shell que vem com o git.
2. **Gancho do harness no diretório do projeto**, onde o harness permitir: no Claude Code, as
   configurações de projeto dentro do diretório do projeto (que é do seeya, dentro do espaço
   de trabalho — **nunca** `~/.claude`), recusando os comandos que furam os ganchos de git
   (`--no-verify`, trocar o diretório de ganchos). **Medir primeiro** se as configurações de
   projeto valem para uma sessão que só enxerga o projeto por `--add-dir` — é o caso da adoção,
   cujo diretório de trabalho é o original da sessão. Se não valerem, registrar: nesse caso a
   segunda camada não protege a adoção, e ela depende da primeira e da terceira.
3. **A auditoria**: `seeya project audit <id>` confere o histórico do projeto desde a última
   auditoria contra as mesmas regras e mostra o que escapou — é a camada que enxerga o
   contorno deliberado, depois do fato. Chamada também pelo `open`, antes de tomar o lock.
4. **Onde o guarda-corpo termina**, escrito no código e no `AGENTS.md` do projeto: cobre o
   descuido; não cobre quem forja o identificador de outra sessão, nem um harness sem gancho
   rodando `--no-verify` — isso só a auditoria mostra.

**O que não entra:** gancho antes da compactação (spike do passo 5); qualquer escrita em
`~/.claude`.

**Cuidados:** nenhuma dependência nova; os ganchos são texto gerado pelo seeya e testado como
texto **e** executados de verdade num repositório descartável (um gancho que só passa no teste
de texto pode não rodar no shell real); nada no `~/.seeya` real.

**Aceite do mantenedor:** numa sessão aberta pelo `open`, pedir ao agente que commite sem o
identificador e ver o git recusar; pedir `--no-verify` e ver o harness recusar; e rodar
`seeya project audit` depois de um commit feito à mão, por fora, e vê-lo apontado.

**Pré-requisito vindo da revisão da V2-T33 (PO, 2026-09-22):** antes das guardas compararem "quem
commita" com "quem segura o lock", o `open` precisa gravar no lock o identificador da sessão do
`claude` que ele lança — hoje, aberto de um terminal comum, o lock fica sem `sessionId` (Q-087).
Gerar o identificador no `open`, passá-lo com `--session-id <uuid>` e gravá-lo no lock; medir antes
que `--session-id` funciona numa sessão **interativa** nova (a S2-T2 mediu com `--resume` e fork).
<!-- SECTION:DESCRIPTION:END -->
