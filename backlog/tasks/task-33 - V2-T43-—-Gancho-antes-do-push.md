---
id: TASK-33
title: V2-T43 — Gancho antes do push
status: Review
assignee: []
created_date: '2026-09-24 10:21'
updated_date: '2026-09-24 18:11'
labels:
  - portao
  - d-049
dependencies: []
references:
  - backlog/decisions
priority: high
type: chore
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T43 — Gancho antes do push com as verificações rápidas.** Especificada pelo PO em
2026-09-24, implementando a **D-049**.

**O que entra:**

1. **Um gancho de pre-push versionado no repositório** (o projeto já usa `husky` para o pre-commit —
   mesmo lugar, mesma instalação, para não inventar um segundo mecanismo).
2. **Ele roda o conjunto rápido**: `format:check`, `tsc -p tsconfig.json --noEmit`, `lint`,
   `dependencias` e o projeto de testes `guards`. **Nunca** a suíte inteira nem a cobertura — isso
   fica no portão do PO e na CI (D-049).
3. **Medir o tempo** do conjunto nesta máquina e registrar no comentário do próprio gancho. Se
   passar de ~90 segundos, cortar do conjunto o que mais custa e dizer por quê — um push que demora
   demais é um push que vai ser furado com `--no-verify`.
4. **A mensagem de recusa diz o que quebrou e como rodar aquilo sozinho** (`npm run lint`, por
   exemplo), nunca só "falhou".
5. **Onde o guarda-corpo termina, escrito no próprio gancho**: `--no-verify` fura, e um clone que
   nunca rodou a instalação dos ganchos não tem gancho nenhum.

**O que não entra:** proteção de branch, pull request obrigatório ou qualquer mudança na CI — é a
parte futura da D-049, quando o produto fechar.

**Cuidados:** nenhuma dependência nova (o `husky` já está aqui); o gancho não pode falhar por causa
de `node_modules` ausente — se não houver o que rodar, ele **recusa dizendo isso**, em vez de deixar
passar calado.

**Aceite do mantenedor:** quebrar de propósito uma formatação e tentar `git push`; ver o push ser
recusado com a mensagem certa; corrigir e ver passar.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `.husky/pre-push` (76 lines), same husky install as pre-commit -- no new
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-24 18:11
---
Aceite reescrito pelo PO em 2026-09-24: o original ('quebrar uma formatação e tentar git push') não chega a testar o gancho — o pre-commit já roda prettier --write, eslint --fix e tsc nos arquivos preparados, então a formatação é consertada ou recusada antes de virar commit. O caso que só o pre-push pega é o do backlog: markdown passa pelo pre-commit, e a guarda de nomes só roda no push. Aceite novo: numa branch de teste, criar uma tarefa com título de mais de 72 caracteres (backlog task create "..."), commitar, tentar git push e ver a recusa com a mensagem do D-048; apagar a tarefa, commitar e ver o push passar. O gancho já rodou de verdade em todos os pushes do PO hoje (a saída da guarda aparece antes do push).
---
<!-- COMMENTS:END -->
