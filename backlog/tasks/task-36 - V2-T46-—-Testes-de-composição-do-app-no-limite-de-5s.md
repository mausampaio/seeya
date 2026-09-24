---
id: TASK-36
title: V2-T46 — Testes de composição do app no limite de 5s
status: To Do
assignee: []
created_date: '2026-09-24 14:27'
labels: []
dependencies: []
references:
  - tests/integration/app/composition.test.ts
priority: medium
type: bug
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T46 — Dois testes de composição do app vivem no limite de 5s.** Encontrado pelo PO em
2026-09-24, no portão da V2-T45; o agente da V2-T43 já tinha visto o mesmo sintoma no mesmo dia.

**O sintoma.** `npm run verificar` falhou **duas vezes seguidas** no mesmo ponto,
`tests/integration/app/composition.test.ts`, com `Test timed out in 5000ms`:

- `buildAppContext > reads config.json for relevanceHours and wires a SessionProvider that discovers real fixture sessions`
- `buildAppContext > checkDaemonOwnershipTransitionOffer resolves to a boolean without throwing`

**Não é da V2-T45** (que não toca em TypeScript): medido no `main` sem ela, o arquivo sozinho,
com `--reporter verbose`, dá **3.180 ms** e **4.495 ms** para esses dois testes. A folga do segundo
é de meio segundo; com a suíte inteira rodando em paralelo, estoura. É repetível nesta máquina, não
um acaso.

**O que entra:**

1. **Medir para onde vão os 4,5 s.** A suspeita é que `buildAppContext` monta os adaptadores de
   verdade, e `checkDaemonOwnershipTransitionOffer` consulta o estado real da máquina — a detecção
   de instalação (registro do Windows) e o autostart. Depois de 2026-09-24 esta máquina tem o app
   instalado por máquina, o que pode ter mudado o caminho percorrido. Confirme ou descarte com
   medição, não com leitura.
2. **Se o teste lê estado global da máquina, isso é o defeito**, não o tempo: "nenhum teste toca...
   o `~/.seeya` real" existe porque o resultado passa a depender de em que máquina ele roda. A
   correção é o teste não depender disso (duplo nomeado implementando a porta, como manda o
   `AGENTS.md`), e o que ele protege continuar protegido.
3. **Só aumentar o timeout não é correção.** Se, depois do item 1, algum custo for legítimo e
   inevitável, o timeout novo cita a medição no comentário.

**Aceite:** `npm run verificar` verde três vezes seguidas nesta máquina, e o tempo de cada um dos
dois testes, antes e depois, no relatório.
<!-- SECTION:DESCRIPTION:END -->
