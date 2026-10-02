---
id: TASK-40
title: V2-T50 — Desfazer o adiamento e zerá-lo ao mudar o horário
status: Review
assignee: []
created_date: '2026-09-24 18:04'
updated_date: '2026-10-02 21:50'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Motor.** `core/schedule.ts`: `resetSnooze` e `decideUndoSnooze` (união `UndoSnoozeAvailability`: `noSnooze`/`notAdjustable`/`tooLate`/`available`). `application/schedule-adjustments.ts`: `undoSnoozeToday` (recusa devolve o motivo e a decisão atual, nunca grava) e `readUndoSnoozeAvailability`. `application/config-update.ts#saveConfigChange`: caminho compartilhado de gravar config; zera o adiamento de hoje só quando `endOfDayTime` muda (validacao fica no chamador, pois `application/` nao importa `adapters/`).

**CLI.** `seeya config set` usa `saveConfigChange` (contexto de `set` ganhou `clock`) e acrescenta "Today's snooze was cleared." quando zerou. Nenhum comando novo de desfazer.

**Janela.** Item **Undo snooze** no menu do Snooze, abaixo de um divisor (`hidden`/`available`/`disabled` com motivo; IPC `undoSnoozeToday`; Q-110). `Menu` ganhou `disabledReason`/`separatorBefore`. `saveSetting` usa o mesmo `saveConfigChange` e recomputa a faixa ja sem o adiamento. Instrumentacao nova: `SEEYA_APP_AUTO_UNDO_SNOOZE`, `SEEYA_APP_AUTO_SET_END_OF_DAY` (AGENTS.md).

**Rearme dos avisos previos (item 3).** Ja coberto pela S4-T7 (`firedLeadTimesEffectiveEndOfDay` difere do horario efetivo novo, entao `resolveFiredLeadTimes` ignora os avisos ja marcados): so teste, nenhum codigo (`tests/unit/application/undo-snooze.test.ts`, desfazer e mudar o horario).

**Prova visual.** Janela real, offscreen, home descartavel, nos temas claro e escuro: menu com Undo snooze apos um adiamento; faixa de volta ao horario configurado apos desfazer (estado.json snooze 60 -> 0); Settings mudando endOfDayTime (snooze 60 -> 0, faixa no horario novo); item desabilitado com motivo depois do horario.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-02 21:50
---
Revisão do PO (2026-10-02): aprovada numa rodada. undoSnoozeToday com disponibilidade em união (noSnooze/notAdjustable/tooLate/available); saveConfigChange compartilhado zera o adiamento só quando endOfDayTime muda (CLI e Settings); rearme dos avisos já coberto pela S4-T7, provado por teste. Janela: item Undo snooze no menu do Snooze, abaixo de um divisor — ausente sem adiamento, desabilitado com motivo depois do horário configurado. Questão renumerada para Q-110 no merge (a V2-T77 ficou com Q-109). Capturas conferidas nos dois temas. Mesclada com a V2-T77; portão do zero e npm test sem identidade git verdes (3828 testes). Agente Sonnet 5.5 (51 min).
---
<!-- COMMENTS:END -->
