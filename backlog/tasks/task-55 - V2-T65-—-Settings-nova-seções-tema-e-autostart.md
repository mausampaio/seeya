---
id: TASK-55
title: 'V2-T65 — Settings nova: seções, tema e autostart'
status: Review
assignee: []
created_date: '2026-09-30 10:34'
updated_date: '2026-10-01 16:02'
labels: []
milestone: m-2
dependencies:
  - TASK-65
type: feature
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementa `docs/INTERFACE.md` seção 8 (item 4): navegação por seção, salvar ao sair do campo, erro na linha, etiqueta custom/default, controle de tema e o autostart como interruptor (sai o botão da lateral).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementação (V2-T65)

Branch `tarefa/V2-T65-settings` a partir do `main` (`7711626`), HEAD `a317cd4`. Cinco commits
(`ca1ad28`..`a317cd4`): design system trazido ao padrão, `settings-panel.ts` dividido (achado de
produção), IPC/tema ao vivo, a feature Settings em si, glossário.

### `renderer/features/settings/` (nova)

```
settings/
  index.ts                  — exporta SettingsDialog
  SettingsDialog.tsx         — raiz: Dialog (open/onClose) + nav + conteúdo + rodapé
  SettingsDialog.module.css  — largura/layout de duas colunas, por cima do .seeya-dialog global
  useSettings.ts             — hook: fetch no mount (nunca vazio) + refetch a cada abertura
  SettingsNav/                — seis NavItem (General…Projects); ícones instanciados no .map()
  GeneralSection/              — Theme (SegmentedControl) + autostart (Switch) + versão
  FieldsSection/                — Schedule/Capture/Discovery/Terminal, genérico
  SettingsField/                — um campo: TextField + Chip custom/default + descrição
  ProjectsSection/              — política, só leitura, inalterada
```

Substitui `renderer/legacy/settings-dialog-view.ts` inteiro (apagado). `#settings-button`
(TabStrip) ganhou `onClick` reativo (`onOpenSettings`); `App.tsx` guarda o `open` e monta
`<SettingsDialog/>` para a vida da janela — nunca vazio ao abrir, nunca `showModal()` por id.

### Trazidos ao padrão D-052 (Q-102)

`Dialog` (open/onClose reativo, igual ao `Popover`; título via `Text`), `Switch` (CSS module real,
trilha/polegar, `Text`, `disabledReason`), `TextField` (`onBlur`, `trailing`, label/hint/erro via
`Text` — o `trailing` fica FORA do `<label>` de propósito: um `Chip` dentro dele poluía o nome
acessível do campo), `SegmentedControl` (rótulo via `Text`). Dois ícones novos (`SlidersIcon`,
`CompassIcon`). `Select`/`Checkbox`/`TableRow`/`InfoBox`/`EmptyState` continuam pendentes
(Q-102 — nenhum necessário para Settings).

### Autostart sai do rodapé

`SidebarFooter` não renderiza mais `#autostart-control-button`/`#autostart-control-result`
(`renderer/legacy/autostart-control-view.ts` apagado) — o interruptor mora em Settings → General,
reusando o mesmo `reduceAutostartControl`. De caminho, corrigi um defeito latente: o texto de
resultado do daemon no rodapé (`daemon.resultText`) já era um filho real do Preact, mas ainda
usava `font-size: 12px` cru em vez de `Text` — migrado para `variant="caption"`.

### Tema ao vivo (achado do PO, 2026-10-01)

Antes, salvar `theme` em Settings só valia depois de fechar e reabrir o app —
`saveSetting` nunca reempurrava `themeUpdate`, só o listener de `nativeTheme` (mudança do SO)
fazia isso. Corrigido chamando a mesma `resolveAndSendEffectiveTheme()` logo após `saveConfig`;
`renderer/legacy/theme-view.ts#wireTheme` (inalterado) repinta `data-theme`/terminal a partir
desse push. Prova: `01-general-light-before.png`/`02-general-dark-after.png`, a mesma janela, sem
reiniciar.

### Defeito de produção achado só pela janela real: `process is not defined`

`state/settings-panel.ts` importa `DEFAULT_CONFIG`/`EDITABLE_CONFIG_KEYS`/`formatConfigValue` de
`@seeya-ai/engine/adapters/storage/config-schema.js` em tempo de execução — seguro em
`main/main.ts` (contexto Node), mas esse módulo de adaptador lê `process.platform` no próprio
topo. No momento em que `useSettings.ts` (renderer) importou um VALOR dali
(`groupSettingsRowsBySection`/`findSettingsRow`), o esbuild empacotou a cadeia inteira no bundle
do navegador — módulos ES rodam o próprio topo inteiro ao serem importados, não só os exports
usados — e a janela quebrava no carregamento (`Uncaught ReferenceError: process is not defined`),
derrubando a árvore `<AppShell/>` inteira. Nenhum teste unitário (happy-dom, API mockada) pegou
isso — só a janela real empacotada. Corrigido extraindo `settings-fields.ts` (sem import de
valor do motor) para o que o renderer precisa; `settings-panel.ts` reexporta tudo, inalterado
para `main.ts`/`ipc/channels.ts`.

### Defeito de instrumentação: vnode de ícone compartilhado entre montagens

`SettingsNav`'s own `SECTIONS` guardava `<SettingsIcon/>` etc. como constante de módulo — o MESMO
objeto vnode reusado a cada montagem de `SettingsNav`. Preact grava estado interno (`_dom`) num
vnode já montado; uma segunda montagem independente reusando o mesmo objeto corrompia
silenciosamente — confirmado por um teste real (`SettingsDialog.test.tsx`): a segunda montagem na
suíte renderizava só o título do diálogo e nada mais. Corrigido guardando o COMPONENTE (referência
de função), instanciado fresco dentro do `.map()`.

### Verificação visual (capturas reais, `SEEYA_APP_OFFSCREEN`+`SEEYA_APP_HOME_OVERRIDE` descartável
+ `--user-data-dir` descartável, `daemon-ownership-transition.json` pré-gravado `declined`)

`node scripts/build.mjs` em `packages/app` antes de cada rodada (nunca `--dev`). Seis capturas:

1. `01-general-light-before.png` — General, tema claro, versão `seeya 44.3.0` (Electron não
   empacotado devolve a própria versão do runtime, não a de `package.json`; um instalado real
   mostraria a versão do app — comportamento do Electron, não desta tarefa), interruptor
   "Start with the system" ligado (`notApplicable`/`ownerKind: 'cli'` nesta máquina de
   verificação, mas o fixture usa `DEFAULT_CONFIG` então o estado inicial do switch reflete o
   availability mock).
2. `02-general-dark-after.png` — MESMA janela, clique real em "Dark" no controle segmentado,
   tema aplicado ao vivo (sidebar, diálogo, terminal — sem reiniciar).
3. `03-schedule-error-light.png` / 4. `04-schedule-error-dark.png` — Schedule, `endOfDayTime`
   com `"not-a-time"`, erro vermelho na própria linha: `invalid value "not-a-time" for
   "endOfDayTime": expected 24h local time "HH:MM" (e.g. "09:30" or "9:30")`.
5. `05-terminal-light.png` / 6. `06-terminal-dark.png` — aba shell real, terminal seguindo o tema
   (reusa `SEEYA_APP_AUTO_OPEN_SHELL_TAB`, já existente).

Caminhos no scratchpad da sessão (não fazem parte do repositório). Registro do Windows
(`HKCU\Software\Classes\seeya`/`seeya-dev`) e hash SHA-256 do `protocol-handler.json` real
conferidos idênticos antes e depois de toda a sessão de captura
(`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`).

**Achado de instrumentação, documentado em `main.ts`/`AGENTS.md`:** `.blur()` programático não
dispara o evento `'blur'`/`'focusout'` numa janela `SEEYA_APP_OFFSCREEN` (ela nunca tem foco real
de página) — `dispatchEvent(new FocusEvent('blur'))` sim. `SEEYA_APP_AUTO_EDIT_SETTINGS` reescrito
para a tela nova (navega até Schedule, usa o id da chave como id do campo) e ganhou um
`clock.sleep(2000)` final para o round-trip de `saveSetting` assentar antes da captura. Nova
variável `SEEYA_APP_THEME_TOGGLE_AFTER_SCREENSHOT_PATH` (junto de `SEEYA_APP_SCREENSHOT_PATH`)
troca a captura única por `captureLiveThemeToggleVerification` — a única instrumentação com DOIS
arquivos de captura, porque o aceite pede a troca ao vivo DENTRO da mesma janela, nunca duas
janelas concordando.

### Testes e portão

`npm run verificar` do zero (dist apagado antes): verde — tipos, lint, `dependency-cruiser`
(676 módulos, 1920 dependências, zero violações), build, cobertura 95,42% statements / 91,06%
branches / 94,38% funcs / 95,62% lines (piso de 80% fora de `core/`, 95% dentro — ambos acima).
343 arquivos de teste, 3280 passando, 4 pulados (pré-existentes, não desta tarefa). Testes novos:
`SettingsDialog.test.tsx` (6), `SettingsField.test.tsx` (5), `GeneralSection.test.tsx` (7),
`SettingsNav.test.tsx` (3), `FieldsSection.test.tsx` (2), `ProjectsSection.test.tsx` (2),
`Dialog.test.tsx`/`Switch.test.tsx` (reescritos, renderizados), mais os ajustes em
`settings-panel.test.ts`, `autostart-control-panel.test.ts`, `Sidebar.test.tsx`,
`SidebarFooter.test.tsx`, `TextField.test.tsx`.

`GIT_CONFIG_GLOBAL=<vazio> GIT_CONFIG_NOSYSTEM=1 npm test`: recusado pelo sandbox do worktree
("git operations must target its own worktree") — não contornado, mesma recusa que a V2-T75 já
registrou. `npm run verificar` já roda a suíte de integração/guards completa sob a configuração
de git deste sandbox.

### Fora do escopo desta tarefa, registrado

- `Select`/`Checkbox`/`TableRow`/`InfoBox`/`EmptyState` seguem pendentes de CSS module/teste
  renderizado (Q-102) — nenhum chamado por Settings.
- `ipc/channels.ts` já estava acima de 500 linhas antes desta tarefa (D-052's own limite) —
  cresceu mais ~30 linhas com os dois canais novos; não é regressão desta tarefa, mas registro
  para quem pegar a divisão desse arquivo depois.

### Questões em aberto

Nenhuma nova.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-30 18:38
---
2026-09-30, pedido do mantenedor: a seção General de Settings mostra, no fim, a versão instalada (seeya 0.1.0), em texto terciário selecionável — já em docs/INTERFACE.md seção 8.
---

author: PO
created: 2026-10-01 13:37
---
2026-10-01, aceite do mantenedor: hoje a troca de tema só vale depois de fechar e abrir o app. A V2-T65 aplica a troca ao vivo — o controle de tema em Settings e o modo System acompanhando o SO — na janela inteira e no terminal, sem reiniciar.
---

author: Claude Sonnet 5
created: 2026-10-01 15:54
---
PO review of the v2t65-screens/* captures: structure, navigation, inline error, and live theme were correct. Four fixes applied on this same branch, all re-verified with new screenshots: (1) version — General used to show Electron's own runtime version (44.3.0) whenever unpackaged, which is every npm run app launch; now baked at build time from @seeya-ai/app's own package.json via esbuild define (__SEEYA_APP_VERSION__), never app.getVersion() — confirmed in new captures showing seeya 0.1.0; (2) label size — Switch's label rendered at body-md (16px), visibly larger than the standalone Theme label (14px); brought to the same body-sm/weight-500/tone-secondary triple as every other field label; (3) autostart text — corrected to Starts the daemon at login, so end day happens even with this window closed., since the window itself never launches at login, only the daemon does; (4) icon — Capture's nav icon used to reuse SettingsIcon's own path with only coordinates nudged, reading as the same icon as General right above it; replaced with a genuinely distinct CameraIcon. Re-verified: Windows registry (HKCU\Software\Classes\seeya and seeya-dev) and protocol-handler.json SHA-256 hash unchanged before/after this capture round (same hash as the prior round). dist erased and npm run verificar run clean: all green, 343 test files, 3280 tests passing, 4 pre-existing skips, coverage identical to the previous round (95.42/91.06/94.38/95.62 stmts/branches/funcs/lines). Committed on tarefa/V2-T65-settings. Status stays Review.
---

author: PO
created: 2026-10-01 16:02
---
Revisão do PO em 2026-10-01: duas rodadas de captura conferidas. Rodada 1: Settings como feature (seções, campos com rótulo legível, salvar ao sair, erro na linha, custom/default), tema ao vivo (o saveSetting não empurrava o tema — corrigido), autostart como interruptor (saiu do rodapé), Dialog/Switch/TextField/SegmentedControl trazidos ao padrão; dois defeitos achados pela janela real (process is not defined no renderer; vnode de ícone compartilhado). Rodada 2: versão vinda do package.json (dev mostrava a do Electron), rótulos no mesmo tamanho, texto do autostart correto, ícone próprio para Capture. Mesclado junto da linha de projeto, portão do zero verde (3288 testes), também sem identidade global do git. Falta o aceite do mantenedor com o instalador.
---
<!-- COMMENTS:END -->
