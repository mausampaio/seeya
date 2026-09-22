---
id: TASK-8
title: >-
  V2-T16 — Correção: a janela responde com a configuração da subida, não com a
  que está em disco
status: Review
assignee: []
created_date: '2026-09-22 11:10'
labels: []
milestone: m-2
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: bug
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T16 — Correção: a janela responde com a configuração da subida, não com a que está em
disco.** Especificada pelo PO em 2026-09-20 a partir de um achado do mantenedor no mesmo dia,
no aceite da V2-T14. **Depende da V2-T13** só por ordem de fila: as duas mexem em
`electron/main.ts`.

**O defeito, medido.** Com a janela aberta, o mantenedor mudou o horário de encerramento de
11:00 para 09:30 e clicou em **Snooze +15m**. A região de estado piscou **11:15** e só depois
virou **09:45**; no clique seguinte, piscou **11:30** e virou **10:00**. **Causa:**
`electron/main.ts` guarda a configuração lida **uma vez, na subida da janela**
(`AppContext.config`) e a passa para `snoozeToday`/`skipToday`, que devolvem a decisão de
agenda calculada com ela — o horário velho. O valor certo só aparece no ciclo seguinte de
atualização, que desde a V2-T14 relê o arquivo. **O que foi gravado está correto**: o que o
adiamento persiste é o total de minutos, que não depende do horário; só a resposta exibida
estava errada.

**O que entra:**
1. **Nenhuma resposta da janela sai de uma configuração velha.** Todo lugar de
   `electron/main.ts` que hoje usa `AppContext.config` passa a usar a configuração lida no
   momento: adiar, pular hoje, a prévia e o relatório do `end-day`, e a busca do briefing
   pendente.
2. **O tipo impede a recaída** (D-024). `AppContext` deixa de expor uma configuração de
   propósito geral — se um campo de subida ainda for necessário para algo que só vale na
   criação da janela, ele tem nome que diz isso e é usado só ali. Assim o erro não volta por
   descuido: não há mais o que ler por engano.
3. **Teste de regressão que falha antes da correção:** um duplo de `Storage` devolve um
   horário na subida e outro depois; o adiamento tem de responder com o segundo.

**O que não entra:** reler configuração dentro do motor (quem lê arquivo é a raiz de
composição); mudar a fonte do terminal já aplicada numa aba aberta; qualquer mudança no
daemon, que já relê a cada ciclo.

**Cuidados:** nenhuma dependência nova; sem tocar no `~/.seeya` real; a leitura a mais por
clique é de um arquivo pequeno, no mesmo `Storage` que o laço de atualização já lê a cada
ciclo.

**Aceite do mantenedor:** mudar o horário com a janela aberta e clicar em **Snooze +15m** —
o valor certo de primeira, sem piscar o antigo.

**Relatório.** `AppContext.config: Config` foi removido inteiramente
(`packages/app/src/composition/index.ts`) — no lugar sobrou só
`AppContext.initialTerminalFontOptions: TerminalFontOptions`, o único valor que genuinamente
só importa na criação da janela (a fonte do primeiro `new Terminal({...})` da renderer,
item explícito de "o que não entra": mudar a fonte de uma aba já aberta é fora de escopo).
Item 2 (D-024) é garantido pelo próprio tipo: não existe mais `context.config` para ler por
engano — quem precisar de configuração chama `context.storage.readConfig()` (mesmo padrão
que `getSettingsPanel`/`onTick` já usavam) ou, para adiar/pular hoje, as novas
`snoozeTodayNow`/`skipTodayNow` (`packages/app/src/state/schedule-actions.ts`), cujas
assinaturas nem aceitam um `Config` — não há argumento por onde um valor velho possa entrar.

Os quatro lugares citados pela spec foram corrigidos: adiar/pular hoje
(`state/schedule-actions.ts`, chamado pelos handlers `CHANNELS.snoozeToday`/`skipToday`),
a prévia e o relatório do `end-day` (`CHANNELS.endDayPreview`/`endDayRun`, cada um lê
`context.storage.readConfig()` depois de rodar `endDay` — que já lê a sua própria cópia
internamente, `application/end-day.ts`) e a busca do briefing pendente
(`CHANNELS.getTodayPanel`, `maxBriefingScanDays` lido na hora). Nenhum outro uso de
`context.config` sobrou em `packages/app/src` (`grep -rn "context\.config\b"` confirma).

**Teste de regressão (item 3):** `tests/unit/app/state/schedule-actions.test.ts`, com
`InMemoryDaemonStorage` (`tests/unit/scheduler/_fakes.ts` — escolhido porque seu
`readConfig()` reflete o que `saveConfig()` gravou por último; o `FakeStorage` comum tem a
config fixada na construção e não serviria). Primeiro clique com `endOfDayTime: '11:00'` →
`"End of day at 11:15 — in 2 h 15 min"`; a config é trocada para `'09:30'` (o mesmo
`saveConfig` que o diálogo de Settings chama); segundo clique → `"End of day at 10:00 — in 1
h 0 min"`. **Provado que falha antes da correção:** trocando `schedule-actions.ts`
temporariamente por uma versão que lê a config uma vez e reaproveita (mimetizando o
`AppContext.config` antigo), o mesmo teste falhou com exatamente o valor velho do relato do
mantenedor — `"End of day at 11:30 — in 2 h 30 min"` em vez de `"...10:00..."` — confirmando
que o teste prova a correção, não só a passa. A versão-armadilha nunca foi commitada; o
arquivo no branch é só a correção.

**Portão:** `npm run verificar` completo, em primeiro plano, sem partição — 198 arquivos de
teste, 2012 testes passando, 4 pulados; cobertura 96,39%/92,56%/94,94%/96,76% (todos acima
dos pisos por diretório, incluindo `packages/app/src/composition/**` em 91,93% e
`packages/app/src/state/**` em 99,05%). `npm run verificar:linux` não foi rodado (opcional).

**Nenhuma questão nova aberta** — a spec cobriu os quatro lugares e a forma do tipo sem
ambiguidade; nenhuma premissa técnica se mostrou errada.

**Mesclada na `main` em 2026-09-20** (portão na worktree do PO: 198 arquivos, 2.012 testes
passando, 4 pulados; cobertura 96,39%/92,61%/94,94%/96,76%). Revisão sem ajustes. Fica em
`[~]` até o aceite do mantenedor.
<!-- SECTION:DESCRIPTION:END -->
