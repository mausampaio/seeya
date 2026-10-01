---
id: TASK-64
title: V2-T74 — Janela sem a barra de menu do Electron
status: Review
assignee: []
created_date: '2026-09-30 18:38'
updated_date: '2026-10-01 20:30'
labels: []
milestone: m-2
dependencies: []
type: feature
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T74 — Janela sem a barra de menu do Electron.** Pedido do mantenedor em 2026-09-30, ao ver o
build da V2-T63: a janela mostra a barra de menu padrão do Electron ("File Edit View Window"), que
o app não usa. `docs/INTERFACE.md` § "Estrutura da janela", parágrafo "Moldura da janela".

**O que entra:**

1. **Windows e Linux:** sem barra de menu. A barra de título do sistema continua, com minimizar,
   maximizar e fechar do próprio SO (nada de moldura desenhada pelo app).
2. **macOS:** menu mínimo do app com o menu Edit — sem ele, copiar e colar deixam de funcionar nos
   campos de texto. Medir/confirmar pela documentação do Electron e citar.
3. **Atalhos que o menu padrão dava de graça:** listar quais existiam (recarregar, ferramentas de
   desenvolvedor, zoom, tela cheia…) e dizer quais somem. Copiar/colar no terminal e nos campos
   continuam funcionando (provar). As ferramentas de desenvolvedor não precisam existir no app
   instalado; se fizer falta no desenvolvimento, só no `npm run app`.

**Aceite do mantenedor:** o app instalado abre sem a barra de menu, com os três botões da janela, e
copiar/colar segue funcionando no terminal e nos campos.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Entrega.** Branch `tarefa/V2-T74-sem-barra-de-menu` a partir de `main` `a3a8c97`, commit
`e4cc0ea211b523de366fd5dd479d2789cbdb5644`. `npm ci` rodado na worktree antes de qualquer
verificação.

**Item 1/2 — a decisão.** `packages/app/src/composition/menu-policy.ts#resolveApplicationMenuPolicy(platform, appName)`
(pura, testada em `tests/unit/app/composition/menu-policy.test.ts`, 7 casos) — `{ kind: 'none' }`
para `win32`/`linux`, `{ kind: 'minimalWithEdit', template }` só para `darwin`. O módulo NUNCA
importa `electron` (nem como tipo): `eslint.config.js`'s own `no-restricted-imports` (D-052)
confina `electron` a `packages/app/src/main/**`, então o template usa um tipo estrutural próprio
(`MenuEntry`/`MenuSection`, discriminado por `kind: 'role' | 'separator'`, D-024) — `main/main.ts
#toElectronMenuTemplate`/`toElectronMenuItem` é o único ponto que mapeia isso para
`Electron.MenuItemConstructorOptions`.

**A fiação.** `main/main.ts#applyApplicationMenuPolicy` chama `Menu.setApplicationMenu(null)`
(Windows/Linux — remove a barra inteira, não só esconde atrás de Alt como `autoHideMenuBar`
faria) ou `Menu.setApplicationMenu(Menu.buildFromTemplate(...))` (macOS). Chamada uma vez, em
`app.whenReady()`, antes de qualquer `BrowserWindow` existir (o menu é global do processo, não
por janela).

**Item 2 — macOS, citando a documentação do Electron.** A doc do `Menu`
(`https://www.electronjs.org/docs/latest/api/menu`, seção "Standard Menus (macOS)", role
`editMenu`) diz que o menu Edit "is required to get full functionality for standard keyboard
shortcuts on macOS, including the use of the Cut, Copy, Paste, and Select All menu items" — no
macOS, Cmd+C/Cmd+V são resolvidos pelo keyEquivalent do próprio menu da aplicação (o sistema de
menu/responder chain do Cocoa); sem um menu com o role correspondente, o atalho nunca chega ao
conteúdo web focado, nem num campo de texto comum nem no textarea escondido do `@xterm/xterm`. Por
isso o menu mínimo do macOS carrega o menu do app (About/Quit) mais Edit (Undo/Redo/Cut/Copy/
Paste/Select All) — nunca "none" nesta plataforma. Não há máquina mac disponível para rodar a
janela de verdade nesta tarefa; a prova aqui é a decisão pura testada mais a citação da doc.

**Item 3 — atalhos que o menu padrão dava de graça e que somem (Windows/Linux, sem menu nenhum):**
Reload (Ctrl+R), Force Reload (Ctrl+Shift+R), Toggle Developer Tools (Ctrl+Shift+I/F12 pelo menu),
Reset Zoom (Ctrl+0), Zoom In (Ctrl+Plus), Zoom Out (Ctrl+-), Toggle Full Screen (F11), Minimize
(Ctrl+M), Close Window (Ctrl+W), e os de edição — Undo/Redo/Cut/Copy/Paste/Select All
(Ctrl+Z/Shift+Z/X/C/V/A) — que no Windows/Linux o Chromium já resolve nativamente em qualquer
elemento editável (incluindo o textarea do xterm), independente de menu algum; por isso eles não
desaparecem de fato nessas duas plataformas, só o item de menu que os listava. O único que de fato
some e não tem substituto nativo é Toggle Developer Tools — restaurado só fora do app empacotado
(`!app.isPackaged`, `main/main.ts#wireDevToolsShortcut`, F12/Ctrl+Shift+I via `before-input-event`
mais `webContents.toggleDevTools()`), nunca no app instalado.

**Copiar/colar — provado, não só por documentação (Windows, a máquina disponível).** Instrumentação
só de verificação, `SEEYA_APP_VERIFY_MENU_AND_CLIPBOARD_PATH` (`main/main.ts#verifyMenuAndClipboard`),
registrada no glossário do `AGENTS.md`. Lido o código-fonte do `@xterm/xterm` instalado
(`node_modules/@xterm/xterm/lib/xterm.js`) antes de escrever a prova: a biblioteca registra seus
próprios listeners de copy/paste no textarea e no elemento do terminal (`copyHandler`/
`handlePasteEvent`) — os mesmos eventos DOM padrão que `webContents.copy()`/`.paste()` disparam,
independente de existir `Menu` ou não. A instrumentação roda `webContents.copy()`/`.paste()` (a
mesma chamada que um role de menu dispara) contra um campo de texto real (`#new-project-id-input`)
e contra o terminal embutido real (pty de verdade, aberto por `SEEYA_APP_AUTO_OPEN_SHELL_TAB=1`).
Resultado de uma execução real (janela offscreen, `SEEYA_APP_HOME_OVERRIDE` descartável):

menuState: platform win32, applicationMenuIsNull true, menuItemLabels null, isMenuBarVisible
false. clipboard.textField: copiedText e pastedBack ambos "seeya-v2t74-field-marker" (o marcador
circulou pelo clipboard real e voltou pro campo). clipboard.terminal: markerVisibleInTerminal
true, helperTextareaFound true, activeElementDebug "TEXTAREA.xterm-helper-textarea".

**Confirma:** nenhum menu aplicado (`applicationMenuIsNull: true`), `isMenuBarVisible()` falso, e
o texto copiado/colado sobrevive tanto no campo quanto no terminal real.

**Prova visual.** `webContents.capturePage()` só captura o conteúdo web, nunca a moldura nativa do
SO (barra de menu incluída) — confirmado com a própria captura: mesma sem menu algum, a imagem
nunca mostraria diferença nenhuma com ou sem a política aplicada. A captura real (offscreen, mesma
execução acima) mostra a janela renderizando normalmente (lateral, aba de shell com sessão real do
PowerShell/cmd rodando) — prova que a janela segue funcionando, não que a barra sumiu; quem prova
isso é o resultado JSON acima. Evidências preservadas fora do repo, no scratchpad do agente:
menu-and-clipboard-verification.json, window-screenshot.png, npm-run-verificar-output.log.

**Técnica de verificação (D-052/FLUXO-DE-AGENTES.md):** `node scripts/build.mjs` (sem `--dev`) em
`packages/app`, depois o binário do Electron lançado direto (nunca `npm run app`/
`build.mjs --dev`) com `--user-data-dir` descartável e `SEEYA_APP_HOME_OVERRIDE` apontando para um
home descartável, com `daemon-ownership-transition.json` pré-gravado (resposta "declined") para
nunca disparar o diálogo de transição de posse do daemon. Conferido antes e depois das três
execuções de verificação (só leitura): `HKCU\Software\Classes\seeya`/`seeya-dev` inalterados
(mesma estrutura, 2 valores cada) e o hash SHA-256 de `~/.seeya/protocol-handler.json` real
idêntico antes/depois — `SEEYA_APP_HOME_OVERRIDE` faz `shouldRegisterProtocolScheme` pular os dois
(V2-T57), confirmado na prática.

**`npm run verificar` — verde, com uma ressalva documentada.** Rodado do zero (dist apagado) 4
vezes ao longo da tarefa. Uma execução saiu 100% limpa: 346 arquivos de teste, 3320 testes
passando mais 4 pulados, cobertura 95.45%/91.16%/94.41%/95.64% (statements/branches/functions/
lines — acima dos pisos de nucleo/demais diretórios). As outras três execuções tiveram 1, 3 e 5
falhas, sempre no mesmo arquivo (`tests/integration/guards/eslint-restrictions.test.ts`, uma vez
também `app-eslint-restrictions.test.ts`), sempre com a mesma mensagem — "guard child process
exceeded its own 30000ms budget (CHILD_PROCESS_BUDGET_MS) and was killed (SIGTERM)" — nunca uma
asserção de conteúdo errada. Confirmado por uma consulta de processos do Windows durante a
primeira execução: outra sessão de agente, noutra worktree, rodava sua própria suíte vitest/eslint
em paralelo na mesma máquina. Reexecutado o(s) arquivo(s) afetado(s) sozinho(s), sem nada mais
rodando, nas duas ocasiões em que isso foi feito: 21 de 21 e depois 14 de 14 testes passando.
Nenhum arquivo tocado por esta tarefa (`composition/menu-policy.ts`, `main/main.ts`, o teste novo,
`AGENTS.md`) tem relação com `core/`, a config do eslint ou os fixtures do guard — é contenção de
CPU na máquina compartilhada, não regressão desta tarefa.

**`npm run dependencias`:** sem violação (681 módulos, 1929 dependências). **`npm run lint`,
`format:check`, os três `tsc -p ... --noEmit`, `npm run build`:** verdes em toda execução.

**`GIT_CONFIG_GLOBAL=<vazio> GIT_CONFIG_NOSYSTEM=1 npm test`:** recusado pela proteção da worktree
("a worktree-isolated agent's git operations must target its own worktree... Refusing to run it")
— não contornei; reportando como pedido pelo despacho.

**Regras invioláveis — confirmado:** `~/.seeya`/`~/.claude`/espaço de trabalho reais, registro do
Windows, daemon, app instalado e autostart do mantenedor nunca tocados (só leitura, conferida
antes/depois). Nenhum `npm run app`/`build.mjs --dev` rodado. Nenhuma dependência nova. Nenhum
`git stash`/`--no-verify`.
<!-- SECTION:NOTES:END -->
