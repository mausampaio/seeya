---
id: TASK-62
title: V2-T72 — Adoção que commita sozinha e projeto que some
status: To Do
assignee: []
created_date: '2026-09-30 13:13'
labels: []
milestone: m-0
dependencies: []
priority: high
type: bug
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T72 — Adoção que commita sozinha e projeto que some.** Achado do mantenedor em 2026-09-30, no
uso real no Ubuntu: numa adoção, a própria sessão commitou o que escreveu (e editou o
`seeya.json`, preenchendo `repositories` e `trackers` num formato inválido). Dois defeitos:

1. **A adoção descarta a cópia quando a sessão já commitou.** `application/project-adopt.ts`
   decide pelo que está sem commit (`listChangedFiles`); com tudo commitado, cai em `noChanges` e
   chama `discardFork` — apaga o transcript da cópia e não grava `adoptions.json`, embora o trabalho
   dela esteja no histórico. **Correção:** a adoção considera também os commits feitos no projeto
   desde que a cópia foi lançada (os com `Seeya-Session-Id` igual ao id da cópia, e qualquer commit
   novo no projeto nesse intervalo — o que for mais fiel ao que o código sabe; justificar na nota).
   Havendo commit, é adoção: registra em `adoptions.json`, tira de `forks.json` e mostra ao
   mantenedor o que já estava commitado (e ainda pergunta pelo que restar sem commit). **Nunca**
   apagar a cópia quando ela deixou commit. Teste de regressão que reproduz o caso: sessão que
   commita e fecha sem nada pendente — hoje apaga, depois registra.
2. **A janela esconde o projeto cujo `seeya.json` não valida.** A CLI mostra em "Ignored entries"
   com o motivo; a janela não mostra nada, e o projeto "some". **Correção:** a janela mostra os
   projetos ignorados, com o id e o motivo, de forma que se entenda o que consertar
   (`docs/INTERFACE.md` ganha a linha na seção 4 e na lateral antes do código).
3. **A sessão não deve escrever o `seeya.json`.** A instrução da adoção
   (`adapters/harness/adopt-instruction.ts`) e as regras de trabalho do `open`
   (`core/project-working-rules.ts`) passam a dizer que o `seeya.json` é mantido pelo seeya, e que
   repositórios entram por `seeya project add-repo`. Texto num lugar só.

**Cuidados:** nada no `~/.seeya` real nem no espaço de trabalho real; recusa não se contorna.

**Aceite do mantenedor:** no Ubuntu, uma adoção em que a sessão commita sozinha termina registrada
(a original deixa de ser adotável, a cópia continua existindo); um `seeya.json` quebrado aparece na
janela com o motivo.
<!-- SECTION:DESCRIPTION:END -->
