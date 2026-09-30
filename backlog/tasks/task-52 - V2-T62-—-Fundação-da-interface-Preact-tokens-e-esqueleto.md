---
id: TASK-52
title: 'V2-T62 — Fundação da interface: Preact, tokens e esqueleto'
status: Review
assignee: []
created_date: '2026-09-30 10:33'
updated_date: '2026-09-30 12:13'
labels: []
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T62 — Fundação da interface: Preact, tokens e esqueleto da janela.** Primeira entrega de
`docs/INTERFACE.md` (ordem de entrega, item 1), sob a **D-051**. Absorve a V2-T51.

**O que entra:**

1. **Preact** em `@seeya-ai/app`, JSX pelo `esbuild` já usado (sem `preact/compat`). Nenhuma outra
   dependência nova sem pergunta — inclusive biblioteca de teste de componente: se precisar de uma,
   abra questão com a alternativa sem dependência que você mediu.
2. **Tokens** dos dois temas de `design/IDENTIDADE_VISUAL.md` (seção 5.4, valores exatos) como
   variáveis CSS, mais espaçamento, raios, sombras e movimento (seção 6), com
   `prefers-reduced-motion` respeitado.
3. **Fontes Geist e Geist Mono empacotadas** no app (arquivos da fonte + a licença OFL junto),
   nunca da rede. O terminal mantém `terminalFontFamily` (identidade, 4.2).
4. **Tema:** chave `theme` no `config.json` (`system`/`light`/`dark`, padrão `system`; nome no
   glossário do `AGENTS.md` antes do código, com o schema e o teste de migração que a config já
   usa). `system` segue o sistema operacional e troca ao vivo quando ele troca. O terminal (xterm)
   segue o tema. O controle na tela é da tarefa de Settings; aqui entra o mecanismo.
5. **Componentes base** (testados por unidade): botão (primário, secundário, fantasma, só ícone
   com `aria-label`), campo, seleção, caixa de marcar, interruptor, controle segmentado, diálogo
   (com a devolução de foco que já existe), pílula de estado, linha de tabela, caixa informativa,
   estado vazio.
6. **Esqueleto da janela** em Preact: lateral (recolher, redimensionar, preferências já
   existentes preservadas) e barra de abas com os terminais de hoje funcionando igual. O conteúdo
   atual da lateral pode ser montado temporariamente dentro do esqueleto, sem redesenho — o
   redesenho é da próxima tarefa. `renderer.ts` deixa de ser o arquivo único (o que a V2-T51 pedia).
7. **Medição (D-051):** memória em repouso, tempo até a lista e tamanho em disco, antes e depois,
   pelos métodos de `docs/DESEMPENHO.md`, registrados lá. Piora fora da faixa de ruído já medida
   vira questão antes de seguir.

**Cuidados:** comportamento da janela igual ao de hoje (só a camada muda, mais o tema); nada no
`~/.seeya` real, sem `npm run app` nem `build.mjs --dev` (janela de verificação só com
`SEEYA_APP_HOME_OVERRIDE`, que desde a V2-T57 não toca no protocolo); recusa de permissão não se
contorna.

**Aceite do mantenedor:** abrir o app instalado com o build novo, ver a janela com a identidade
visual nos dois temas (trocando o tema do sistema), e tudo que já funcionava continuar funcionando.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Entrega.** Itens 1–7 da tarefa, na branch `tarefa/V2-T62-fundacao-interface` (5 commits sobre
`main` a8fb0e0). `npm run verificar` verde (exit 0), medido duas vezes.

**1. Preact.** Única dependência nova (`preact@^11.0.0`, instalada `11.0.0`). JSX pelo
`esbuild` (renderer bundle) via `jsx: 'automatic'`/`jsxImportSource: 'preact'` — `preact/jsx-runtime`,
nunca `preact/compat`. `packages/app/tsconfig.json` ganhou as mesmas duas opções para `tsc -b`.
Achado medido durante a tarefa: o TypeScript "exclude" só filtra o CONJUNTO INICIAL de arquivos-raiz
de um programa — não impede um arquivo excluído de entrar de volta por import transitivo. Como
`src/ui/**` (Preact, precisa de DOM) tem testes em `tests/unit/app/ui/**`, e esses testes SÃO
incluídos no `tsconfig.json` raiz (que não tem DOM de propósito, para não vazar globals de browser
em `engine`/`cli`), os dois pares (`src/ui`/root e `tests/unit/app/ui`/root) ficaram cada um com o
próprio `tsconfig.json` (nome exato — é o que o `projectService` do typescript-eslint procura
subindo o diretório; um nome diferente, testado, ficou "invisível" para o ESLint). `npm run
verificar` ganhou dois passos de `tsc` a mais para eles. Vitest: Vite 8 usa `oxc`, não `esbuild`,
por padrão — `esbuild: {...}` no `vitest.config.ts` é ignorado (medido, removido); o JSX funciona
porque o `oxc` lê o `tsconfig.json` mais próximo de cada arquivo sozinho.

**2. Tokens.** `packages/app/src/electron/tokens.css` — os valores exatos de
`design/IDENTIDADE_VISUAL.md` § 5.4 (`:root`/`[data-theme='dark']`), mais `--seeya-space-*`
(grade de 4px, § 6.1), `--seeya-radius-*` (§ 6.2), `--seeya-shadow-*` (§ 6.3),
`--seeya-motion-*` (§ 6.5) e um bloco `@media (prefers-reduced-motion: reduce)` que zera toda
duração de transição/animação globalmente. `index.css` teve TODO hex/rgb hardcoded trocado pela
variável correspondente (confirmado por grep, zero cor solta sobrando); os quatro `<dialog>` que
tinham border/background/padding/backdrop duplicados nos ids passaram a herdar de
`.seeya-dialog` (`components.css`), com o id mantendo só o tamanho. Nenhuma região foi
redesenhada — mesma estrutura, mesmos ids/classes, só a cor/raio/sombra por trás mudou.

**3. Fontes.** Geist Sans (400/500/600/700) e Geist Mono (400), `packages/app/assets/fonts/geist/`,
com `OFL.txt` — baixadas de `github.com/vercel/geist-font` (não é pacote npm; verificado magic
byte `wOF2` nos cinco arquivos). `terminalFontFamily` intocado. `scripts/build.mjs` já copiava
`assets/fonts/` inteiro (recursivo) para `dist/electron/fonts/` — nenhuma mudança nele além de
somar `components.css`/`tokens.css` à lista de arquivos copiados/bundlados.

**4. Tema.** `Config.theme: 'system' | 'light' | 'dark'` (`core/types.ts#ThemePreference`),
default `'system'`, glossário no `AGENTS.md` ANTES do código, schema zod +
`EDITABLE_CONFIG_KEYS`/`seeya config get|set theme` + testes de migração (documento sem o campo
resolve para `'system'`, documento com valor inválido lança). Mecanismo:
`theme/resolve-theme.ts#resolveEffectiveTheme(preference, systemPrefersDark)` (pura, testada) —
`main.ts` assina `nativeTheme.on('updated', ...)`, lê `Config.theme` fresco (nunca cacheado em
`AppContext`, mesma disciplina pós-V2-T16) e empurra `CHANNELS.themeUpdate` só quando o tema
EFETIVO muda; `CHANNELS.getEffectiveTheme` cobre a primeira pintura. `theme-view.ts` aplica
`data-theme` no `<html>` e chama `tabs-view.ts#setActiveTerminalTheme`, que atualiza
`terminal.options.theme` (mutável no xterm 6, confirmado nos typings) de toda aba já aberta E da
próxima a abrir — "o terminal segue o tema" vale ao vivo, não só no relançamento.
`state/terminal-theme.ts` ganhou `TERMINAL_THEME_LIGHT` ao lado do `TERMINAL_THEME_DARK` (renomeado
de `TERMINAL_THEME`) e `resolveTerminalTheme`. Controle na tela: fora de escopo (V2-T65).

**5. Componentes base.** Onze, `packages/app/src/ui/*.tsx` (button, text-field, select, checkbox,
switch, segmented-control, dialog, status-pill, table-row, info-box, empty-state). Testados
chamando a função do componente direto e inspecionando o vnode devolvido — sem `jsdom`/
`happy-dom`/biblioteca de teste de componente nova: a alternativa sem dependência que a tarefa
pedia para medir antes de perguntar. `Button`'s own forma só-ícone exige `aria-label` por união
discriminada (D-024) — `Button({ iconOnly: true })` sem o rótulo não compila. 39 testes novos
(11 arquivos + `_vnode.ts`, helper compartilhado para não repetir o `as` que o `.props: any` do
Preact força).

**6. Esqueleto.** `app-shell.tsx`/`dialogs-shell.tsx` reproduzem a árvore INTEIRA que
`index.html` tinha (mesmos ids, mesmas classes, mesma ordem — conferido por grep de todo
`getElementById`/`querySelector` em `electron/*.ts` contra a árvore nova) — montada uma vez por
`render()` em `renderer.ts#main`, antes de qualquer `wire*`; como não há segunda chamada a
`render()` nesta tarefa, o Preact nunca revisita essa árvore, e todo código imperativo existente
continua funcionando sem mudança nenhuma. `renderer.ts` (1407 linhas) virou um bootstrap de 74
linhas; o resto foi para dez módulos por região (`tabs-view.ts`, `fallback-dialog-view.ts`,
`end-day-dialog-view.ts`, `schedule-strip-view.ts`, `daemon-control-view.ts`,
`autostart-control-view.ts`, `daemon-ownership-transition-view.ts`, `settings-dialog-view.ts`,
`today-panel-view.ts`, `status-panel-view.ts`), todos abaixo de 400 linhas. **`main.ts` (1346
linhas) NÃO foi dividido** — V2-T51 pedia os dois arquivos, mas o despacho desta tarefa e a
própria descrição da V2-T62 só absorvem `renderer.ts` ("`renderer.ts` deixa de ser o arquivo
único"); dividir `main.ts` fica pendente, registrado no comentário do V2-T51 (TASK-41) para o
PO decidir se abre tarefa nova. Um subconjunto de botões do esqueleto usa `<Button>` de verdade
(toolbar, recolher lateral, end-day/daemon/autostart/settings) — prova de uso real, não só
biblioteca parada.

**7. Medição.** `measure-startup.mjs`/`measure-idle.mjs`, isolados (`SEEYA_APP_HOME_OVERRIDE` +
`SEEYA_APP_OFFSCREEN`, nunca `npm run app`/`build.mjs --dev`) — registro completo com números em
`docs/DESEMPENHO.md` § "V2-T62 — antes/depois". (a) tempo até a lista e (c) CPU parado ficaram
dentro da faixa já registrada; (b) memória em repouso leu 364,5–397,6 MiB contra 335,6–338,0 MiB
da linha de base de 2026-09-20 — 30–60 MiB a mais. Pela lição da Q-096 ("piora só se afirma com
A/B na mesma sessão"), não decidi sozinho se é regressão real ou ruído de comparar dias
diferentes: registrado como `docs/QUESTOES.md` Q-099, pedindo o A/B de verdade (`main` vs. esta
branch, mesma sessão) antes de qualquer conclusão. (d) tamanho em disco NÃO foi medido —
`npm run dist:windows` foi recusado pelo classificador automático de permissão do harness
("Production Deploy") nesta sessão; não contornei, registrei e segui, como as regras invioláveis
pedem.

**Verificação visual (fora do pedido formal, feita para conferir com os próprios olhos antes de
entregar).** Duas capturas reais (`SEEYA_APP_HOME_OVERRIDE` num diretório descartável com
`config.json` fixando `theme: 'light'`/`'dark'`, offscreen, `webContents.capturePage()`) confirmam
os dois temas aplicados — fundo/texto/bordas trocam, a cor do símbolo/marca permanece igual nos
dois (identidade § 2.9), e o diálogo de transição de posse do daemon (que antes não tinha estilo
nenhum) agora sai com aparência de diálogo de verdade via `.seeya-dialog`. Achado cosmético, não
investigado a fundo: nas duas capturas o botão de recolher a lateral aparece com o anel de foco
(`:focus-visible`, novo nesta tarefa) visível, sugerindo que ele recebe foco automático ao
carregar a página — comportamento que pode já existir hoje (era o primeiro elemento focável antes
também) e só ficou visível agora porque a regra de foco global é nova; não investigado, registrado
aqui para quem revisar decidir se importa.

**Registro/`~/.seeya` reais:** confirmados intocados antes e depois de toda a sessão (chave
`HKCU\Software\Classes\seeya-dev` e hash de `protocol-handler.json` idênticos nos dois
momentos) — já esperado, já que toda janela de verificação usou `SEEYA_APP_HOME_OVERRIDE`
(V2-T57 pula os dois nesse caso).

**Recusas registradas, não contornadas:** `npm run dist:windows` (classificador de permissão,
"Production Deploy" — item 7 acima); `GIT_CONFIG_GLOBAL=... npm test` (guarda de worktree,
"git operations must target its own worktree" — pedido explícito do despacho).

**Testes:** 293 arquivos, 2918 passando + 4 puladas (pré-existentes, não desta tarefa) na suíte
`unit+integration+integration-process+guards`; cobertura agregada 96,25% statements / 92,06%
branches / 95,26% functions / 96,5% lines — todos os pisos por diretório (incluindo o novo
`packages/app/src/ui`) dentro do piso de 80%.

**Pendências para tarefas seguintes:** `main.ts` continua com 1346 linhas (V2-T51 não fechada por
completo — ver comentário no TASK-41); Q-099 (memória) sem resolução; (d) tamanho em disco não
medido.
<!-- SECTION:NOTES:END -->
