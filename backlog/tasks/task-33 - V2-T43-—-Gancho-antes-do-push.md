---
id: TASK-33
title: V2-T43 — Gancho antes do push
status: To Do
assignee: []
created_date: '2026-09-24 10:21'
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
