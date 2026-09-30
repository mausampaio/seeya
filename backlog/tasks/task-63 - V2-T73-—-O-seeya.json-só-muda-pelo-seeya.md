---
id: TASK-63
title: V2-T73 — O seeya.json só muda pelo seeya
status: To Do
assignee: []
created_date: '2026-09-30 13:34'
labels: []
milestone: m-0
dependencies:
  - TASK-62
priority: high
type: feature
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T73 — O seeya.json só muda pelo seeya.** Decisão do mantenedor em 2026-09-30, depois do achado
da V2-T72 (uma sessão adotada editou o `seeya.json` num formato inválido e o projeto sumiu da
janela): instrução não basta, a regra vira mecanismo (princípio já seguido pela D-047).

**O que entra:**

1. **O gancho de git recusa commit que altere um `seeya.json` e não venha do seeya.** O seeya
   marca os próprios commits que gravam o manifesto (`WorkspaceRepository.writeProjectManifest` +
   `commitAll`, em `create`, `add-repo`, `remove-repo`, adoção…) com uma variável de ambiente no
   processo `git` que ele lança — mesmo padrão de `SEEYA_LOCK_HOLDER_PID`
   (`adapters/workspace/lock-holder-env.ts`); nome no glossário do `AGENTS.md` antes do código. A
   decisão pura mora em `core/workspace-commit-guard.ts`. Mensagem de recusa: que o `seeya.json` é
   mantido pelo seeya e que repositório entra por `seeya project add-repo`.
2. **Restauração do que ficou sem commit.** No início de cada `seeya project open` (CLI e janela) e
   no fim de cada adoção, se o `seeya.json` do disco difere da última versão commitada, o seeya
   restaura a versão commitada e diz, na saída, que restaurou e o que descartou (o diff resumido,
   nunca silêncio). Como o item 1 garante que só o seeya commita esse arquivo, a versão commitada é
   sempre a dele.
3. **Onde o guarda-corpo termina**, registrado no código e no glossário: `--no-verify` pula o
   gancho. Na sessão aberta por `open`, o gancho do harness já bloqueia `--no-verify`; na adoção
   não (a cópia roda fora do diretório do projeto) — ali a auditoria acusa o commit depois, e o
   item 2 conserta o arquivo no próximo `open`. Cobre o descuido, não o contorno deliberado.

**Testes:** gancho de verdade (como `tests/integration/workspace/commit-msg-hook.test.ts`), com o
caso proibido (sessão commitando `seeya.json`) e os permitidos (cada fluxo do seeya que grava o
manifesto); restauração com arquivo alterado, com arquivo inválido e com arquivo igual (nada a
fazer). Também sem identidade global do git.

**Depende da V2-T72** (as duas mexem no fluxo da adoção).

**Aceite do mantenedor:** pedir a uma sessão aberta num projeto que edite o `seeya.json` e commite
→ recusado com a explicação; editar à mão sem commitar e reabrir o projeto → restaurado, com aviso.
<!-- SECTION:DESCRIPTION:END -->
