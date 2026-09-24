---
id: TASK-40
title: V2-T50 — Desfazer o adiamento e zerá-lo ao mudar o horário
status: To Do
assignee: []
created_date: '2026-09-24 18:04'
labels: []
milestone: m-1
dependencies: []
references:
  - backlog/decisions
priority: high
type: bug
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T50 — Desfazer o adiamento, e mudar o horário zera o adiamento.** Achado do mantenedor no uso
real em 2026-09-24 (Ubuntu); as regras estão na **emenda de 2026-09-24 ao D-006**.

**O que ele viveu:** tinha clicado em **Snooze +1h** (encerramento foi para 15:58). Foi em
**Settings…** e mudou `endOfDayTime` — e qualquer horário que pusesse continuava 1h à frente, porque o
`snoozeMinutesTotal` de hoje em `estado.json` seguia somando. Não existe opção nenhuma para desfazer.

**O que entra:**

1. **Desfazer o adiamento** — uma função em `application/schedule-adjustments.ts`, ao lado de
   `snoozeToday`/`skipToday`, que zera o adiamento de hoje e devolve o `ScheduleDecision` recomputado
   (mesmo formato das irmãs). **Só permitida antes do horário configurado sem o adiamento**; depois
   dele, recusa com o motivo (D-024: disponibilidade como união discriminada, nunca um booleano
   solto). Na janela, um botão na faixa de horário, ao lado dos de Snooze, que só aparece quando há
   adiamento **e** ainda dá para desfazer — com o mesmo padrão idle→running→resultado dos outros
   botões e a faixa atualizada na hora.
2. **Mudar `endOfDayTime` zera o adiamento de hoje.** No caminho **compartilhado** de gravar a
   configuração — o mesmo que `seeya config set` e o painel **Settings…** usam —, para que CLI e
   janela se comportem igual. Só quando o valor de `endOfDayTime` **muda**; salvar outra chave não
   mexe no adiamento.
3. **Os avisos prévios acompanham o horário efetivo novo.** Depois de desfazer ou de mudar o
   horário, os avisos que ainda cabem antes do novo encerramento voltam a poder disparar. Confira se o
   rearme da S4-T7 (`firedLeadTimesEffectiveEndOfDay`) já cobre isso; se cobrir, é teste, não código.

**O que não entra:** "pular hoje" continua como está (a emenda não o toca); nenhum comando novo na
CLI para desfazer o adiamento — a janela é a interface principal (D-045), e a CLI ganha só a regra
do item 2, que é do caminho de gravação.

**Testes:** desfazer antes do horário configurado (permitido) e depois (recusado, com o motivo);
mudar o horário com adiamento feito (zera) e salvar outra chave (não zera); a faixa e o
`seeya status` mostrando o horário certo em seguida.

**Aceite do mantenedor:** com um Snooze +1h feito, (a) desfazer pela janela e o horário voltar ao
configurado; (b) fazer outro Snooze, mudar o horário em Settings… e o horário novo valer sem +1h.
<!-- SECTION:DESCRIPTION:END -->
