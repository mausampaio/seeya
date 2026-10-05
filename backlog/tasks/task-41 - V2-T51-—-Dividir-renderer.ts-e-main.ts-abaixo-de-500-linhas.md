---
id: TASK-41
title: V2-T51 — Dividir renderer.ts e main.ts abaixo de 500 linhas
status: Review
assignee: []
created_date: '2026-09-25 03:41'
updated_date: '2026-10-05 13:44'
labels: []
milestone: m-2
dependencies: []
references:
  - packages/app/src/electron
priority: low
type: chore
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T51 — Dividir `renderer.ts` e `main.ts` abaixo do teto de 500 linhas.** Achado do PO ao
especificar a V2-T30 (2026-09-24): `packages/app/src/electron/renderer.ts` tem ~1.390 linhas e
`main.ts` ~1.130, contra o teto de 500 do `AGENTS.md` ("se um começar a crescer, o sinal é que ganhou
uma segunda responsabilidade"). A V2-T30 foi proibida de engordá-los e não os dividiu, de propósito:
dividir o que existe é trabalho próprio.

**O que entra:** separar cada arquivo por responsabilidade — no `main.ts`, os grupos de handlers de
IPC (sessões, painel Hoje, end-day, daemon/autostart, configurações, projetos), o ciclo de
atualização e a criação da janela; no `renderer.ts`, cada painel da lateral, as abas/terminal e os
diálogos. O que for **lógica** (decisão, texto, transição) sai para módulos puros testados em
`state/`/`sidebar/`/`ipc/`/`text/`, como a V2-T30 fez; `electron/` fica só com fiação de DOM/Electron.

**Regras:** refatoração pura — nenhum comportamento muda, nenhum texto muda; os testes existentes
passam sem editar o esperado; os comentários com medição são **preservados** e acompanham o código
que explicam. Nenhum arquivo acima de 500 linhas no fim.

**Custo:** subida e repouso remedidos em A/B na mesma sessão (lição da Q-096) — não pode piorar.

**Aceite:** do PO — portão verde, nenhum arquivo acima de 500 linhas, A/B sem piora; do mantenedor —
usar a janela normalmente um dia e não notar diferença nenhuma.
<!-- SECTION:DESCRIPTION:END -->

## Comments

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Escopo (atualizado pelo PO em 2026-10-05):** main.ts (3622 linhas), ipc/channels.ts (974), composition/index.ts (829), text/messages.ts (660). Refatoração pura: comentários movidos verbatim (conferido por script: toda linha de comentário do original existe nos arquivos novos, salvo cabeçalhos de módulo e nomes de variável trocados por `state.<campo>`).

**Contagem antes -> depois:**
- main/main.ts 3622 -> 75. Novos em main/: window.ts 87, application-menu.ts 57, protocol-registration.ts 114, wire-ipc.ts 55, ambient-refresh.ts 144, ambient-state.ts 33, tabs-ipc.ts 169, theme-ipc.ts 45, settings-ipc.ts 95, today-ipc.ts 173, end-day-ipc.ts 115, schedule-ipc.ts 71, daemon-ipc.ts 130.
- main/verification/ (toda a instrumentação SEEYA_APP_*; a produção só importa verification/index.ts): index.ts 109, hooks.ts 115, quit-after.ts 31, context-overrides.ts 99, window-captures.ts 259, screenshot-captures.ts 240, projects-tab-captures.ts 139, sessions-tab-captures.ts 208, confirmations-captures.ts 236, adoption-captures.ts 279, menu-clipboard.ts 160, click-automation-{common 23, tabs 345, today 193, schedule 188, sidebar 137}.ts, mais os quatro verify-*/verification-* que já existiam (movidos). Cada flag virou uma função registerXxx(window, clock), chamadas por registerWindowVerification na MESMA ordem em que createWindow as registrava.
- ipc/channels.ts 974 -> 310 (CHANNELS) + channel-types-{tabs,today,end-day,schedule-daemon,projects,sessions,project-details}.ts (reexportados por `export type *`; nenhum importador mudou).
- composition/index.ts 829 -> 234 (buildAppContext) + app-context.ts 233, deps-builders.ts 224, app-context-overrides.ts 57, cli-daemon-script.ts 51, daemon-wiring.ts 145 (fio de daemon/autostart; única extração que exigiu assinatura nova, DaemonWiringInputs/DaemonWiring).
- text/messages.ts 660 -> 57 + messages-{tabs,today,end-day,schedule-daemon,settings,sidebar,projects,sessions}.ts (maior 143) + format-plan-age.ts (formatPlanAge saiu para evitar ciclo; messages.ts reexporta).
- Maior arquivo de packages/app/src agora: project-ipc.ts 482.

**Estado compartilhado:** os `let` fechados em wireIpc (autostartCache, latestSidebarRows, latestTodayPanelInputs) viraram AmbientState (um objeto mutável); tabs fica em tabs-ipc.ts e o ciclo lê por getTabs(). Os dois pontos de produção com instrumentação inline (pid da aba, log de resize) agora chamam recordCreatedTabPid/recordResizeForVerification.

**Guard:** tests/integration/guards/app-file-size.test.ts — falha se qualquer .ts/.tsx/.css de packages/app/src passar de 500 linhas; sem lista de exceções; testa o limite permitido (500 passa, 501 falha), extensão não checada e última linha sem newline. Confirmado que reprova (arquivo temporário de 600 linhas) e volta a passar ao apagar. Onde para: conta linhas físicas, não mede qualidade do desenho.

**AGENTS.md:** a lista das SEEYA_APP_* e as referências a funções que mudaram de lugar apontam para main/verification/ e para os módulos novos; linha nova no glossário descreve a divisão.

**A/B (mesma sessão, alternado; antes = origin/main, depois = esta branch; bundle de produção, home descartável, offscreen):**
- (a) subida até a lista de sessões (measure-startup.mjs, 3 lançamentos por rodada): antes 5704-6056 ms / 5711-5761 ms; depois 5734-5781 ms / 5706-5777 ms. Faixas sobrepostas.
- (b) memória em repouso (measure-idle.mjs, janelas 1/2/3): depois 408,3/372,5/371,6 e 400,9/362,8/361,9 MiB; antes 395,1/362,9/362,1 e 406,8/368,8/367,8 MiB. Sobrepostas (a janela 1 de toda rodada é mais alta: settling).
- (c) CPU ocioso: depois 0,13-0,26% e 0,10-0,21%; antes 0,16-0,23% e 0,08-0,26%.
- Bundle main.js: 1.113.801 -> 1.123.599 bytes (+0,9%, wrappers de função); sem efeito mensurável acima.

**Instrumentações rodadas antes e depois, mesmos drivers, home e --user-data-dir descartáveis:** SEEYA_APP_VERIFY_SELECT_STATES_DIR (+ADOPTION_FAKE), SEEYA_APP_VERIFY_ADOPTION_FLOW_DIR (+ADOPTION_FAKE, sucesso e COMMIT_FAILURE), SEEYA_APP_VERIFY_CONFIRMATIONS_DIR, SEEYA_APP_VERIFY_DAEMON_OWNERSHIP_DIR, SEEYA_APP_VERIFY_ARCHIVE_DIR. Mesmo conjunto de arquivos antes e depois; 18 de 43 byte-idênticos; os demais diferem só por horário e ordem de linhas empatadas (conferido olhando select/02, adoption/03, adoption-fail/04, archive/01, confirm/01). Arquivos de texto (foco, métricas, log do espaço de trabalho) idênticos. Achado pré-existente, não tocado: adoption-fail/04-result-failure.png mostra o passo 1 do diálogo tanto antes quanto depois.
- HKCU\Software\Classes\seeya e seeya-dev e o hash de ~/.seeya/protocol-handler.json real (E3D8A283...) iguais antes e depois.

**Fora do escopo, acima de 500 linhas (seguimento):** engine/core/ports.ts 1737, engine/core/types.ts 1250, cli/composition.ts 729, engine/application/project-open.ts 686, cli/index.ts 634, engine/adapters/storage/config-schema.ts 606, engine/adapters/storage/index.ts 542.

**Limites:** funções de ~20 linhas não foram aplicadas aos handlers movidos (código verbatim); mudou o tamanho dos arquivos e a responsabilidade de cada módulo. Comentários genéricos que citam `electron/main.ts` (renome antigo) em ipc/ e composition/ ficaram como estavam, exceto os que apontavam para funções que mudaram de lugar. docs/ARQUITETURA.md não foi tocado (exige aprovação).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-10-05 13:44
---
Revisão do PO (2026-10-05): aprovada numa rodada. main.ts 3622→75 (ciclo de vida só), handlers de IPC em módulos próprios, toda a instrumentação SEEYA_APP_* em main/verification/ com um único ponto de entrada; ipc/channels.ts 974→310, composition/index.ts 829→234, text/messages.ts 660→57, sem mudar import de nenhum chamador. Guard novo app-file-size (500 linhas, caso permitido testado). A/B na mesma sessão sem piora (subida, memória, CPU parado dentro do ruído; bundle +0,9%). Instrumentações rodadas antes/depois com saídas iguais salvo horário. Achado pré-existente para seguimento: a captura 04-result-failure da instrumentação de adoção com falha de commit mostra o passo 1, não o resultado. Fora do escopo, ainda acima de 500: ports.ts, types.ts, cli/composition.ts, project-open.ts, cli/index.ts, config-schema.ts, storage/index.ts. Processo: scripts de verificação movidos para arquivos no scratchpad para fugir de recusa de comando composto — limite do que o despacho aceita; registrado. Mesclada no po-gate; portão do zero e npm test sem identidade git verdes (3995 testes). Agente Sonnet 5.5 (53 min).
---
<!-- COMMENTS:END -->

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-30 10:34
---
2026-09-30: absorvida pela V2-T62 (fundação da interface em Preact, D-051) — dividir renderer.ts acontece na troca de camada. Fechar junto com a V2-T62.
---

author: Dev (V2-T62)
created: 2026-09-30 12:13
---
V2-T62 dividiu electron/renderer.ts (1407 -> 74 linhas, 10 modulos por regiao). electron/main.ts NAO foi dividido -- fora do escopo explicito do despacho da V2-T62, que so absorveu renderer.ts. Falta decidir se abre tarefa nova so para main.ts (1346 linhas).
---

author: PO
created: 2026-09-30 13:06
---
Correção do PO em 2026-09-30: a V2-T62 dividiu o renderer.ts (1407 → 74 linhas), mas o main.ts (1346 linhas) ficou fora do escopo dela. Esta tarefa continua aberta, agora só para o main.ts.
---
<!-- COMMENTS:END -->
