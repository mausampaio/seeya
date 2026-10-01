---
id: TASK-56
title: V2-T66 — Aba Today
status: Review
assignee: []
created_date: '2026-09-30 10:34'
updated_date: '2026-10-01 20:08'
labels: []
milestone: m-2
dependencies:
  - TASK-65
type: feature
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 3 (item 5): o painel Hoje vira aba, com cartões por sessão, Resume in, rodapé de seleção, progresso e resultado na própria aba.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementação (V2-T66)

Branch `tarefa/V2-T66-aba-today`, a partir de `main` (953b741). HEAD `400c40b5f379bf7ad55c76679c928be5da4b4c88`, 12 commits.

### Estrutura final (`packages/app/src/renderer/features/today/`)

- `Today.tsx` — raiz, montada uma vez dentro de `#page-today` (`TabStrip.tsx`), junto de `useToday.ts`.
- `PlanHeader/` — título "Plan for \<dia\>" + linha de contexto ("Captured \<instante\> · N sessions").
- `SessionCard/` — um cartão por sessão, os três estados (`neverResumed`/`resumedEarlier`/`runningNow`).
- `CwdChangeNotice/` — a caixa informativa com o histórico de diretório + o seletor `Resume in`.
- `SelectionFooter/` — "N selected", "Clear selection", "Resume selected" (com `disabledReason`).
- `ResumeProgress/` e `ResumeResult/` — progresso e resultado da retomada, acima dos cartões.
- `index.ts` — exporta só `Today`.

Componentes novos do design system (D-052): `Button.disabledReason` (mesmo contrato do `disabledReason` que `Switch` já tinha) e `Icon.CheckIcon` (o "ícone de concluído" do estado `runningNow`). Trazidos ao padrão D-052 nesta tarefa (Q-102): `Checkbox`, `Select` (nova prop `monospace`), `InfoBox` (tone unificado com o `Tone` compartilhado), `EmptyState` — os quatro com CSS module + teste renderizado; as classes globais correspondentes em `renderer/legacy/components.css` saíram, confirmadas sem uso por grep antes.

### O que saiu do legado

`renderer/legacy/today-panel-view.ts` apagado por inteiro. `TabStrip.tsx`'s own `#page-today` passou a ter `<Today/>` em vez do antigo `#today-panel`. `renderer.tsx` não chama mais `wireTodayIncomingEvents`/`refreshTodayPanel`. `end-day-dialog-view.ts` não chama mais `refreshTodayPanel()` depois de "Run end-day now" — `main.ts`'s own `CHANNELS.endDayRun` agora empurra um `todayUpdate` fresco ele mesmo (extraído para `buildFreshTodayPanelData`, compartilhado com `getTodayPanel`), já que o Today real não tem mais uma referência que um diálogo irmão possa chamar diretamente.

### Dados novos

`TodaySessionRow.displaySessionId` e `TodayPanelData`'s own `capturedAt: Date | null` (`state/today-panel.ts`) — o id curto (escopado ao lote do dia, nunca o da lateral) e o instante mais recente de captura entre os handoffs do dia. `defaultResumeInCwd`/`resumableSelection` são as duas funções puras novas que `useToday.ts`/`CwdChangeNotice` compartilham (o default do seletor Resume in; o filtro que tira da seleção uma sessão que virou `runningNow` num tick ambiente).

### Prova visual (capturas reais, janela isolada, fixtures descartáveis)

Processo: `node scripts/build.mjs` em `packages/app` (nunca `--dev`/`npm run app`); `SEEYA_APP_HOME_OVERRIDE` descartável por captura (nunca o `~/.seeya`/`~/.claude` reais); `--user-data-dir` descartável; `daemon-ownership-transition.json` pré-respondido. Os três estados do cartão vieram de dados reais: `neverResumed` com histórico de diretório em DOIS diretórios que existem de verdade no disco (o seletor Resume in mostra ambos); `resumedEarlier` via `resumed.json`; `runningNow` via um processo real e de vida longa (lançado em segundo plano, fora do processo que o spawna — um `child_process.spawn` direto morre junto do comando que o lança neste sandbox, confirmado empiricamente), registrado em `~/.claude/sessions/<pid>.json` com o `procStart` lido do mesmo jeito que `adapters/process/proc-start.ts#captureWindows` usa (`(Get-Process -Id <pid>).StartTime.ToFileTimeUtc()`) — portanto classificado `alive` pela discovery de verdade, nunca simulado. O progresso/resultado de uma retomada usaram um `claude.cmd` inofensivo (um `ping` disfarçado, nunca a CLI real nem uma sessão real) na frente do `PATH` só para aquele processo filho — documentado nos próprios flags novos (`SEEYA_APP_AUTO_OPEN_TODAY_TAB`, `SEEYA_APP_RESUME_RESULT_SCREENSHOT_PATH`, `SEEYA_APP_DEBUG_CONSOLE`, ver `AGENTS.md`).

Cinco capturas (caminhos no scratchpad da sessão, fora do repositório):
1. `v2t66-screenshots/01-today-light-three-states.png` — tema claro, os três cartões + a caixa Resume in.
2. `v2t66-screenshots/02-today-dark-three-states.png` — mesmo estado, tema escuro.
3. `v2t66-screenshots/03-today-empty-state.png` — estado vazio (`EmptyState`, nenhum briefing pendente).
4. `v2t66-screenshots/04-today-resume-progress.png` — "Resuming 1 of 1: ..." numa retomada real em andamento.
5. `v2t66-screenshots/05-today-resume-result.png` — "Resumed" acima do estado vazio (ver defeito 2 abaixo).

Registro do Windows (`HKCU\Software\Classes\seeya`/`seeya-dev`, ambos presentes e intocados) e o hash SHA-256 de `~/.seeya/protocol-handler.json` real (`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`, igual ao já registrado por tarefas anteriores) conferidos depois de toda a sessão de captura — `SEEYA_APP_HOME_OVERRIDE` sempre definido, que por si só (V2-T57) já impede qualquer escrita real nos dois.

### Três defeitos de produção achados pela prova visual (nunca pela suíte)

1. **`EmptyState.tsx` referenciava uma classe CSS ausente** (`description`, nunca definida em `EmptyState.module.css`) — derrubava a janela inteira na abertura (o estado inicial de `useToday`, antes do primeiro `getTodayPanel` resolver, É `noBriefing`). Achado só por `SEEYA_APP_DEBUG_CONSOLE` (novo, encaminha `console.*`/exceção do renderer para o stdout) — nenhum teste pegou porque este projeto nunca configurou `test.css` no `vitest.config.ts` (registrado como Q-103 para o PO).
2. **`Today.tsx` devolvia o estado vazio incondicionalmente antes de checar o resultado** — uma retomada que esgota a única sessão pendente do dia some atrás do "Nothing to resume" sem mostrar a confirmação. Corrigido: `ResumeProgress`/`ResumeResult` renderizam sempre, acima do que quer que venha depois.
3. **`SEEYA_APP_QUIT_AFTER_MS` ausente era lido como "encerre depois de 0ms"** (`Number('')` é `0`, não `NaN`) nas quatro funções de captura — inofensivo para uma captura só, mas fazia a nova captura de duas imagens (progresso/resultado) encerrar o app antes da segunda, porque um registro separado do caminho de captura única disparava em paralelo. Corrigido com `quitAfterConfiguredDelay` compartilhado e o novo caminho de duas capturas unificado no mesmo `if`/`else if` do caminho único — `SEEYA_APP_SETTINGS_CLOSE_AFTER_SCREENSHOT_PATH` (pré-existente) ainda tem a mesma sobreposição latente, fora do escopo desta tarefa tocar.

### Testes

`tests/unit/app/renderer/features/today/` — 8 arquivos novos (`useToday`, `Today`, `PlanHeader`, `SessionCard`, `CwdChangeNotice`, `SelectionFooter`, `ResumeProgress`, `ResumeResult`). `tests/unit/app/state/today-panel.test.ts` ganhou os casos de `displaySessionId`/`capturedAt`/`defaultResumeInCwd`/`resumableSelection`. Os quatro componentes trazidos ao D-052 trocaram o teste antigo (inspeção de vnode) por um renderizado.

`npm run verificar` (dist apagado antes, do zero): verde — 353 arquivos de teste, 3398 testes passando (4 pulados), cobertura 95,71% statements / 95,9% lines (`core/` 99,48%, acima do piso de 95%; `app/src` dentro do piso de 80%).

`GIT_CONFIG_GLOBAL=... GIT_CONFIG_NOSYSTEM=1 npm test` (pedido separadamente): recusado pelo sandbox do harness ("git operations must target its own worktree"). Não contornado.

### Questões em aberto

Q-103 registrada: `vitest` nunca detecta uma classe CSS ausente num `.module.css` (o default do `vitest.config.ts` para `test.css` mocka o import devolvendo o próprio nome da chave) — o defeito 1 acima só apareceu numa captura real. Decisão de ferramental, fora do escopo desta tarefa.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Claude (agent)
created: 2026-10-01 20:31
---
Revisão do PO, segunda rodada, mesma branch (tarefa/V2-T66-aba-today). Dois ajustes:

1. Contador da lateral desatualizado. `packages/app/src/main/main.ts`'s own `CHANNELS.resumeSelected` handler agora empurra `buildFreshTodayPanelData()` pelo mesmo canal `todayUpdate` logo depois que `resumeSessions` resolve, antes de devolver a resposta do invoke — mesmo padrão que `endDayRun` já tinha. A aba e o cartão Today da lateral leem o MESMO push, então os dois atualizam no mesmo instante; `useToday.ts` deixou de fazer o próprio refetch redundante de `getTodayPanel`. Prova: `today-resume-result-sync-{light,dark}.png` — a aba diz "Nothing to resume" e o cartão da lateral diz "Today / Nothing to resume" ao mesmo tempo, na mesma captura.

2. Caminhos longos e absolutos na aba. `sidebar/directory-label.ts` ganhou `collapseHomeDirectory` (abrevia o prefixo do diretório pessoal para `~`, comparação case-insensitive só no Windows, `platformHint` sempre por parâmetro — nunca `process.platform` lido aqui) e `formatDirectoryPathForDisplay` (compõe `collapseHomeDirectory` com o `shortenDirectoryPath` já existente). Testado em Windows e POSIX (`tests/unit/app/sidebar/directory-label.test.ts`). Canal IPC novo `getHomeDir` (`CHANNELS.getHomeDir`/`SeeyaApi#getHomeDir`) devolve `AppContext.homeDir` — nunca um `os.homedir()` cru no preload, que divergiria de `SEEYA_APP_HOME_OVERRIDE` numa verificação. `useToday.ts` busca isso uma vez; `SessionCard`/`CwdChangeNotice` formatam todo `cwd` que mostram (o próprio cartão, a frase do histórico, cada opção do seletor Resume in), sempre com o caminho completo no `title`. `Select` ganhou um `title` opcional por opção para o mesmo fim — o rótulo do seletor fica abreviado, o valor submetido continua o caminho real. Prova: `today-paths-{light,dark}.png`.

Nomes mantidos exatamente como pedido: `collapseHomeDirectory`/`formatDirectoryPathForDisplay` em `sidebar/directory-label.ts`.

Commits: `ca515ce` (fix 1) e `eecbfda` (fix 2), já na branch.

Capturas novas (dois temas, `today-paths-*`/`today-resume-progress-*`/`today-resume-result-sync-*`), reais, via `node scripts/build.mjs` (nunca `--dev`), fixture descartável (`SEEYA_APP_HOME_OVERRIDE`, nunca o `~/.seeya`/`~/.claude` reais), sem registro do Windows nem `protocol-handler.json` tocados (V2-T57 cobre isso sempre que a variável está definida — conferido depois). `dist` apagado duas vezes (antes de cada rodada de `npm run verificar`), as duas rodadas verdes — 353 arquivos de teste, cobertura 95,71% statements / 95,9% lines, inalterada.

Defeito encontrado e corrigido no PRÓPRIO script de captura (fora do código do produto, registrado aqui porque mudou o fixture): um `SEEYA_APP_SCREENSHOT_PATH` relativo resolvia contra o cwd do processo Electron (`packages/app`), não contra o cwd do script de captura — o `ENOENT` dali virava uma promise rejeitada nunca tratada, e a janela nunca chegava a `quitAfterConfiguredDelay`, ficando aberta indefinidamente. Corrigido usando sempre um caminho absoluto.

Nada de `git stash` usado. Nenhuma recusa do sandbox contornada — o guard de termos locais recusou o primeiro commit por um caminho de home com o nome de usuário real desta máquina (maiúsculo e minúsculo) numa fixture de teste, sem eu perceber; corrigido trocando por `<usuario>`/`<USUARIO>`, a convenção já usada em `tests/unit/adapters/autostart/*.test.ts` e outros, não um afrouxamento do guard.
---
author: Claude (agent)
created: 2026-10-01 20:50
---
Revisão do PO, terceira rodada, mesma branch. Quatro itens, todos no item 2 original (o primeiro já estava certo):

1. **`~` provado numa captura.** A fixture anterior tinha o `cwd` corretamente DENTRO do `homeDir` de override, mas os nomes dos segmentos eram longos o bastante para que o caminho `~`-abreviado ainda estourasse até o `maxLength` de 32 da lateral (então era truncado pelo FIM, derrubando o `~` junto) — e, depois do item 3 abaixo subir o teto para 80, ainda estourava por pouco (83 caracteres). Corrigido encurtando os nomes dos diretórios da fixture de captura para algo do tamanho do próprio exemplo do PO (`…\worktrees\abc123def\new-directory`, script de captura, não comitado) — o `~` agora aparece claramente nas quatro superfícies (cartão, caixa de aviso, seletor, bloco Resumed).

2. **Bloco "Resumed" com caminho cru.** `ResumeResult.tsx`'s own `SummarySection` montava a linha `name (cwd)` por interpolação de string direto do `cwd` cru — o único lugar da aba Today que ainda escapava do `formatDirectoryPathForDisplay`. Agora o `cwd` de CADA uma das quatro seções (Resumed/Skipped/Not resumed por resposta inválida/Not resumed ainda não tentado) passa pela mesma função, num `<span title="...">` próprio — o caminho completo continua acessível, só que não mais title-ando a linha inteira (que também tem o nome e a nota). Conferido à parte: `ResumeProgress` nunca mostra `cwd` nenhum (nada a corrigir ali); o texto de fallback/skip (`todaySummaryFallbackNote` etc.) é texto livre, não um campo de `cwd`, fora do escopo deste item. Commit `d6b9db5`.

3. **Limite de 32 caracteres pequeno demais para a aba Today.** `TODAY_TAB_DIRECTORY_MAX_LENGTH = 80`, nomeada e comentada em `sidebar/directory-label.ts`, agora é o default de `formatDirectoryPathForDisplay` — toda chamada de produção dessa função é da aba Today, nunca da lateral (que continua chamando `shortenDirectoryPath` direto, em 32). Commit `f678f38`.

4. **"(0 days ago)" / "(1 day ago)" sem singular.** `formatPlanAge` (`text/messages.ts`, exportada e testada para 0/1/2) agora decide o sufixo de `MESSAGES.todayPlanTitle`: "(today)" para 0, "(1 day ago)" singular, "(N days ago)" do resto. **Não toquei na CLI**: `core/consolidated-plan.ts#renderTitle`/`renderRelativeAge` (o título do `seeya start-day`) é uma função SEPARADA, nunca compartilhada com `todayPlanTitle` — formato totalmente diferente (sufixo com travessão, "— today"/"— 3 weeks ago", e NENHUM sufixo para `daysAgo === 1`, decisão deliberada da Q-026, "yesterday is the ordinary case") — e não tem este defeito, conferido lendo o código, não suposto. Commit `bf4b4e8`.

Capturas novas (dois temas) com os quatro itens visíveis na MESMA captura por tema: `today-paths-{light,dark}.png` (itens 1/3/4) e `today-resume-result-sync-{light,dark}.png` (itens 1/2, mais a sincronia da lateral já confirmada certa na rodada anterior). `dist` apagado, `npm run verificar` verde — 353 arquivos de teste, cobertura 95,71% statements / 95,9% lines, inalterada.

Nada de `git stash`. Nenhuma recusa contornada.
---
<!-- COMMENTS:END -->
