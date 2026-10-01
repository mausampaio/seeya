---
id: TASK-54
title: V2-T64 — Barra de abas nova e popover New tab
status: Review
assignee: []
created_date: '2026-09-30 10:34'
updated_date: '2026-10-01 04:02'
labels: []
milestone: m-2
dependencies:
  - TASK-65
type: feature
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 2 (item 3): ícones por tipo, abas de página, Settings no canto direito e o popover New tab no lugar da barra de comando (diretórios recentes derivados, sem chave nova em disco sem pergunta).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementação (V2-T64)

Branch `tarefa/V2-T64-barra-de-abas`, HEAD `e6077ea`. Seis commits
(`2187927`..`e6077ea`): IPC/plumbing de origem da aba, Popover +
SegmentedControl/TextField trazidos ao padrão, os quatro componentes internos
da barra, a orquestração reativa (useTabStrip/TabStrip) substituindo
tabs-view.ts/page-tab-strip.ts, um ajuste de formatação, e um fix de produção
achado pela própria captura de tela (settings-dialog-view.ts sobrescrevendo o
ícone do Settings com texto).

### `renderer/features/tabs/`

- `TabStrip.tsx` + `.module.css` — raiz da região: toolbar (recebe o botão de
  reabrir a lateral via prop `leading`, já que ele mora fora da lateral),
  `#terminal-host` com os três page panes de Today/Projects/Sessions
  (ids inalterados, região de outra tarefa) e os `TerminalPane` por aba
  terminal aberta, o popover New tab, e um `ResizeObserver` em
  `#terminal-host` (substitui `tabs-view.ts#wireWindowResize`).
- `useTabStrip.ts` — o estado (um array ordenado de `StripTab`, terminal ou
  página, a mesma ordem de abertura que a barra mostra), a assinatura de
  `onTabData`/`onTabExit`/`onResumeTabOpened`/`onProjectsUpdate`, e as ações
  (`openNewTab`, `closeTab`, `selectTab`, `openPopover`/`closePopover`,
  `registerHandle`/`unregisterHandle`/`onTerminalSpawned`, `fitAll`).
- Três componentes internos exigidos pela tarefa: `TabStripItem` (a aba —
  nome escolhido para não colidir com `Tab`, o modelo do glossário;
  `role="tab"`/`aria-selected`, casando com o `role="tablist"` do contêiner),
  `TerminalPane` (monta o `@xterm/xterm` por `ref`, dentro do próprio
  `useEffect` — a exceção sancionada de "montagem imperativa", já que um
  terminal de terceiros não tem binding Preact; chama `CHANNELS.createTab`
  ele mesmo quando `spawnRequest` não é nulo, ou só corrige o tamanho inicial
  80x24 quando a sessão já tem pty, V2-T4), `NewTabButton` (o "+", expõe
  `buttonRef` para o popover ancorar nele).
- `NewTabPopover` — substitui a barra de comando: `SegmentedControl`
  claude/codex/Shell/Other… (ids `new-tab-kind-<kind>`), campo `Other…`
  condicional, campo `Directory` + botão `Browse…` (abre o diálogo nativo via
  `pickDirectory`), até três diretórios recentes como atalho, `Open`/`Cancel`.
- `state/tab-strip.ts` (puro) — `StripTab`/`TabStripEntry`,
  `buildTabStripEntries` (ícone+rótulo+ativo+exited por entrada),
  `nextActiveIdAfterRemoval`, `findOpenPageTab`.
- `state/tab-strip-icon.ts` (puro) — `resolveTerminalTabIcon`
  (`'command'→terminal`, `'project'→folder`, `'session'→balloon`) e
  `resolvePageTabIcon` (today→calendar, projects→folder, sessions→balloon).
- `state/recent-directories.ts` (puro) — `buildRecentNewTabDirectories`: até
  3 diretórios, pela MESMA evidência de `lastActivity` por sessão que a
  lateral ("Recent") e a aba Sessions já usam (`ProjectsPanelData`), nunca uma
  chave nova em disco (D-025).
- `tabs/new-tab-kind.ts` (puro) — `NewTabKind`, `resolveNewTabCommand` (uma
  aba aberta pelo popover é sempre ícone "terminal" genérico, qualquer que
  seja claude/codex/Shell/Other…).
- Três pontes pequenas e módulo-escopo (substituem o pub/sub de
  `tabs-view.ts`/`page-tab-strip.ts`, apagados): `active-tab-registry.ts`
  (`onActiveTabChanged`, consumido por `useSidebar.ts`), `page-tab-bridge.ts`
  (`openOrFocusPageTab`, idem), `focus-bridge.ts` (`focusActiveTabTerminal`,
  consumido por `renderer.tsx` para `dialog-focus-return.ts`), e
  `terminal-theme-registry.ts` (`setActiveTerminalTheme`, consumido por
  `theme-view.ts` — "o terminal segue o tema" ao vivo).

### Ícone por tipo e o campo `kind` novo

`ipc/channels.ts#ResumeTabOpenedEvent` ganhou `kind: 'project' | 'session'`
— não existia forma de distinguir, no renderer, uma aba de `project open`
de uma retomada/adotada (as três passavam pelo mesmo evento). Plumbing:
`resume/tab-session-resumer.ts#TabResumeOpener.openTab` e
`resume/project-tab-launcher.ts` (`ProjectOpenTabLauncher`→`'project'`,
`ProjectAdoptTabLauncher`→`'session'`) ganharam o campo;
`main/main.ts#openResumeTab` repassa `options.kind` ao evento. Testes de
`tab-session-resumer.test.ts`/`project-tab-launcher.test.ts` atualizados.

### Diretório nativo

`CHANNELS.pickDirectory` (novo) — `main/directory-picker-ipc.ts`, um
`dialog.showOpenDialog` só, mesmo padrão de módulo próprio de
`project-ipc.ts`/`session-search-ipc.ts`.

### Settings e Popover

`IconButton` com `SettingsIcon` e `aria-label`, mesmo `id="settings-button"`
— a wiring de clique de `settings-dialog-view.ts` continua intacta por id,
sem mudança (o redesenho do diálogo é V2-T65). **Defeito de produção achado
pela própria captura:** aquele arquivo também fazia
`openButton.textContent = MESSAGES.settingsButton`, sobrescrevendo o ícone
com a palavra "Settings" assim que a janela carregava — só apareceu na
screenshot real, não em teste de unidade (o DOM do `IconButton` isolado
estava correto). Corrigido removendo a linha.

### Design system

Novo: `Popover` (`renderer/components/Popover/`) — `<dialog>` real,
`.showModal()`/`.close()` dirigidos pela prop `open` (nunca
`getElementById` no ponto de uso), ancorado perto de um elemento via
`anchorRef` (mede com `getBoundingClientRect` depois de aberto), fecha com
Esc e devolve foco ao terminal de graça (o mesmo `wireDialogFocusReturn` que
já varre todo `<dialog>` presente no load), e com um clique no
`::backdrop`. `IconButton` ganhou `buttonRef` opcional (sem `forwardRef`,
D-051 não tem `preact/compat`) — é como o Popover ancora no botão "+".
`Button` ganhou `title` opcional (tooltip dos atalhos de diretório recente).

Restilizados ao padrão D-052 (Q-102): `SegmentedControl` e `TextField`
ganharam `.module.css` + testes renderizados (`@testing-library/preact`),
substituindo os testes antigos por inspeção de vnode. Nenhuma mudança visual
— mesmos tokens que os seletores globais antigos (`renderer/legacy/
components.css`) já usavam, agora isolados no componente.

### Legado que saiu

Apagados por inteiro: `renderer/legacy/tabs-view.ts`,
`renderer/legacy/page-tab-strip.ts`. `App.tsx` não carrega mais o markup
estático de toolbar/command-bar/terminal-host — tudo isso é `<TabStrip/>`
agora. `renderer.tsx` não chama mais `setTerminalFontConfig`/
`wireTabIncomingEvents`/`wireWindowResize`/`wireCommandBar` (o hook cuida
disso). `legacy.css` perdeu as regras só usadas por eles (`#toolbar`,
`#tab-strip`, `#command-bar*`, `.tab-button`, `.tab-close`,
`.terminal-pane`) — `#sidebar-toggle-button` e `.page-pane` continuam
(ainda usados por `App.tsx`/pelas três page panes).

### Fonte dos diretórios recentes (D-025)

`state/recent-directories.ts` deriva de `ProjectPanelSessionRow.cwd`/
`lastActivity` em TODA sessão descoberta (projetos + "Other sessions") — a
MESMA evidência que já alimenta a seção "Recent" da lateral e a aba
Sessions, nunca uma leitura nova de disco nem uma chave nova persistida.
Sessão sem `lastActivity` não entra (ausência de dado nunca vira um
diretório "recente" inventado). Até 3, sem repetir diretório, mais recente
primeiro.

### Prova visual (capturas reais, janela isolada, 1280×800)

Três capturas, `SEEYA_APP_HOME_OVERRIDE` descartável,
`daemon-ownership-transition.json` pré-respondido, fixture 100% fictícia (uma
aba shell aberta pelo popover real e depois fechada — vira "· exited" pelo
próprio exit de pty real —, uma aba "project" e uma "session" fabricadas via
`CHANNELS.resumeTabOpened` direto, só para esta prova visual, e a aba de
página Sessions aberta e ativa):

- claro: `v2t64-light-tabs.png`
- escuro: `v2t64-dark-tabs.png`
- popover New tab aberto, "Other…" selecionado, sobre a mesma barra: `v2t64-dark-popover.png`

Caminhos no scratchpad da sessão (fora do repositório). Instrumentação nova
em `main/main.ts`, mesma classe de toda `SEEYA_APP_*` já documentada no
glossário: `SEEYA_APP_AUTO_TAB_STRIP_DEMO`, `SEEYA_APP_AUTO_OPEN_NEW_TAB_POPOVER`,
`SEEYA_APP_WINDOW_WIDTH`/`SEEYA_APP_WINDOW_HEIGHT` (só a janela de
verificação; sem elas, a janela real continua 1200×800). Build usado:
`node scripts/build.mjs` em `packages/app` logo antes de cada rodada de
captura, sem código de diagnóstico (removido antes do commit).

Registro do Windows (`HKCU\Software\Classes\seeya-dev`) e hash SHA-256 do
`protocol-handler.json` real conferidos antes e depois de toda a sessão de
verificação: idênticos
(`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`).

### Desempenho

Esta tarefa não adiciona trabalho em repouso nem no laço de atualização
(nenhum novo polling, nenhuma nova leitura periódica) — `useTabStrip` só
assina canais que já existiam (`onTabData`/`onTabExit`/`onResumeTabOpened`/
`onProjectsUpdate`) e adiciona um `ResizeObserver` local, substituindo
exatamente o que `tabs-view.ts#wireWindowResize` já fazia antes. Não
medido numericamente (a régua de `docs/DESEMPENHO.md` pede custo quando a
tarefa ACRESCENTA trabalho; aqui o equivalente imperativo é substituído
um-para-um pelo reativo, sem ciclo novo) — registrado aqui como decisão, não
como lacuna silenciosa.

### Testes e portão

`npm run verificar` (com `packages/*/dist` apagados antes, do zero): verde —
tipos (três tsconfigs), lint, `dependency-cruiser` (646 módulos, 1807
dependências, zero violação), build, cobertura. 331 arquivos de teste, 3195
testes passando (4 pulados), cobertura total 95,71% statements / 95,94%
lines / 91,61% branches / 94,77% functions (piso de `packages/app/src/**`:
80%, todos acima).

Testes novos desta tarefa: `tab-strip.test.ts`, `tab-strip-icon.test.ts`,
`recent-directories.test.ts`, `new-tab-kind.test.ts` (puros, state/tabs),
`TabStripItem.test.tsx`, `TerminalPane.test.tsx`, `TabStrip.test.tsx`,
`useTabStrip.test.tsx`, `NewTabPopover.test.tsx` (render-based,
`@testing-library/preact`+`happy-dom`), `Popover.test.tsx`,
`SegmentedControl.test.tsx`, `TextField.test.tsx` (substituem os antigos
`.test.ts` por inspeção de vnode), mais o `buttonRef` novo testado em
`IconButton.test.tsx`. **Achado ao testar:** o cleanup de `useEffect` do
Preact roda num tick DEFERIDO, nunca sincronamente dentro de `unmount()` —
todo teste que verifica um `onUnregister`/similar no desmonte usa `waitFor`
para isso (documentado nos próprios testes).

`GIT_CONFIG_GLOBAL=... GIT_CONFIG_NOSYSTEM=1 npm test` (pedido
separadamente): recusado pelo sandbox do harness ("worktree-isolated agent's
git operations must target its own worktree"). Não contornado.

### Recusas

Nenhuma além da acima (`npm test` com `GIT_CONFIG_GLOBAL`). Nenhum
`npm run app`/`build.mjs --dev` rodado — só `node scripts/build.mjs`
(bundle puro, sem lançar janela) antes de cada rodada de captura, via um
script descartável fora do repositório, chamando o Electron já instalado
como dependência de desenvolvimento do próprio pacote.

### Questões em aberto

Nenhuma nova.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: agente
created: 2026-10-01 04:02
---
Correção pós-revisão do PO (4 itens), mesma branch, commit 4a43b2a:

1. Botões "«"/"+" da barra eram glifo de texto/ícone pequeno demais — agora ChevronLeftIcon/ChevronRightIcon (novo) e PlusIcon a 24px, IconButton size="sm", igual ao "+" de Favorites. Removida a regra de legacy.css que sobrescrevia o tamanho por id-selector (mesma classe de bug que #new-tab-button/#settings-button já tinham).

2. Ícone de Settings pequeno/apagado — agora 20px dentro de IconButton size="md". Confirmado por dump real de DOM/getComputedStyle (svg 20x20, cor = --seeya-text-secondary nos dois temas), não só por pixel de screenshot.

3. SegmentedControl do popover sobrava vão à direita (inline-flex, shrink-to-content) — agora flex 100% largura, cada opção flex:1, alinhado com os campos de largura total abaixo.

4. Rótulo de aba exited concatenava "shell exited (code 1)" — TabStripEntry agora carrega exitedText separado do label ("exited (1)", sem a palavra "code"), renderizado por TabStripItem em span próprio com --seeya-text-tertiary; a opacidade de "exited" não cobre mais o sufixo nem o botão de fechar.

Duas capturas novas (claro com a barra, escuro com o popover), caminhos no scratchpad da sessão. Registro/protocol-handler.json reais conferidos idênticos antes e depois. npm run verificar (packages/*/dist apagados antes) verde. Segue em Review.
---
<!-- COMMENTS:END -->
