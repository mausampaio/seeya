---
id: TASK-65
title: V2-T75 — Estrutura de componentes e a lateral reescrita nela
status: Review
assignee: []
created_date: '2026-09-30 21:21'
updated_date: '2026-10-01 00:10'
labels: []
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T75 — Estrutura de componentes e a lateral reescrita nela.** Implementa a **D-052**, depois do
aceite da V2-T63 pelo mantenedor (2026-09-30): a lateral funcionava, mas o código não usava o
Preact como componente e a tela tinha defeitos que saem dessa mesma causa.

**O que entra:**

1. **A estrutura da D-052:** `main/` (processo principal — mover o que hoje está em `electron/` e é
   do processo principal), `renderer/App.tsx`, `renderer/components/`, `renderer/features/`,
   `renderer/hooks/`, `renderer/ipc/`. O que hoje é tela montada à mão e ainda não é reescrito aqui
   vai para `renderer/legacy/`, sem mudar comportamento. `docs/ARQUITETURA.md` (seção da segunda
   raiz de composição) e as regras do `dependency-cruiser` acompanham os caminhos novos. Mover com
   `git mv` e preservar os comentários.
2. **CSS modules** pelo `esbuild` (sem dependência nova), com os tokens da identidade.
3. **Testes de componente renderizados:** `@testing-library/preact` + `happy-dom` como dependências
   de desenvolvimento (aprovadas). Os testes de componente da V2-T62 passam a renderizar de verdade.
4. **Design system inicial** em `renderer/components/`, cada um com CSS module, teste e `index.ts`:
   - primitivas de disposição com props tipadas na escala de tokens: pilha (vertical/horizontal,
     `gap`, alinhamento), grade (`columns`, filho com `span`, ex.: 12 colunas com dois filhos de 6),
     superfície (cartão/painel: `padding`, `radius`, `elevation`, `variant`);
   - `Button`, `IconButton` (ícone centralizado, com `aria-label` obrigatório pelo tipo), `Chip` (o
     contador e a pílula de estado, com conteúdo centralizado), `NavItem` (ícone, rótulo, contador
     ou chip à direita com respiro, estado ativo), `Section` (título de seção + ação opcional),
     `Icon` (os ícones de `ui/icons.tsx` passam para cá).
   Os componentes da V2-T62 em `ui/` migram para cá (ou saem, se substituídos) — sem duplicata.
5. **Hooks:** assinatura de canal de IPC (`useIpcSubscription` ou nome equivalente, com limpeza
   no desmonte), tema; e o cliente tipado em `renderer/ipc/`.
6. **O esqueleto e a lateral inteiros reescritos** em `renderer/App.tsx` e
   `renderer/features/sidebar/` (Sidebar + useSidebar + CSS, e os componentes internos `TodayCard`,
   `FavoritesSection`, `RecentSection`, `NavList`, `SidebarFooter` com a agenda e a pílula do
   daemon), usando só componentes do design system. Nenhum `getElementById`/`innerHTML`/montagem
   imperativa na lateral nem no esqueleto.
7. **Defeitos do aceite da V2-T63, todos corrigidos:** `All projects` e `Sessions` colados um no
   outro (espaço entre itens de navegação); o `+` de Favorites fora do centro; o contador `2` colado
   na borda direita; o chip `1 running` com o texto fora do centro; `Daemon running` com fonte
   pequena demais (usar `body-sm` 14 px, peso 500); a lateral cortando o conteúdo à esquerda
   (texto "avorites" — a lateral nunca rola na horizontal e nunca corta).

**Prova:** capturas da janela real (janela de verificação isolada, dados fictícios com projetos,
favorito, recentes, sessões rodando, daemon rodando e parado), nos dois temas, e a lateral
recolhida — o PO confere cada uma antes de publicar.

**Cuidados:** comportamento igual ao de hoje fora da lateral; o autostart continua no rodapé até a
V2-T65; custo de desempenho dito (régua de `docs/DESEMPENHO.md`, A/B na mesma sessão se medir).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementação (V2-T75)

Branch `tarefa/V2-T75-componentes`, HEAD `3fbc324`. Nove commits ao todo (`9e9231e`..`3fbc324`):
a relocação `electron/`->`main/`+`ui/`->`renderer/` (D-052), o design system e a lateral reescrita,
dois ajustes de glossário/questão, um `chore` do fork (ver nota de transparência abaixo), um
`fix` de produção achado por captura de tela, um `feat` de hook sem consumidor ainda, e um `fix`
de ferramental (`clean-dist.mjs`) achado durante este mesmo portão.

### Estrutura final de `packages/app/src/`

- `main/` - `main.ts`, `preload.ts`, `project-ipc.ts`, `session-search-ipc.ts` (processo principal
  do Electron; único trecho, com `renderer/legacy/`, fora do piso de cobertura).
- `renderer/App.tsx` - raiz Preact do esqueleto da janela; monta `<Sidebar/>` + a árvore
  legada (toolbar/terminal-host/`DialogsShell`) inalterada.
- `renderer/components/` - o design system (lista abaixo).
- `renderer/features/sidebar/` - a lateral inteira reescrita.
- `renderer/hooks/` - `useIpcSubscription`, `useTheme`.
- `renderer/ipc/client.ts` - único ponto de leitura de `window.seeya`.
- `renderer/legacy/` - telas ainda não convertidas (diálogos, abas, Today/Projects/Sessions,
  tema, settings) - sem mudança de comportamento, só realocadas de `electron/`/`ui/`.
- `renderer/css-modules.d.ts` - declaração ambiente para `*.module.css` (ver defeito de
  ferramental abaixo).
- `composition/`, `ipc/`, `pty/`, `resume/`, `sidebar/`, `state/`, `tabs/`, `text/`, `theme/`
  intocados por esta tarefa.

### Design system (`renderer/components/`)

Novos, com CSS module + teste renderizado + `index.ts`:
- `Stack` - `direction`/`gap`/`align`/`justify`/`wrap`.
- `Grid` + `GridItem` - `columns`/`gap`; `span` união literal `1`-`12`.
- `Surface` - `padding`/`radius`/`elevation`/`variant`/`bordered`.
- `Button` - `variant` (`primary`/`secondary`/`ghost`), `size` (`sm`/`md`/`lg`), `fullWidth`;
  texto sempre obrigatório (a forma só-ícone saiu para `IconButton`).
- `IconButton` - mesmo `variant`/`size`; `aria-label` obrigatório pelo tipo (D-024).
- `Chip` - substitui `StatusPill` (V2-T62, sem chamador de produção, confirmado por grep antes
  de apagar); `tone` obrigatório, `variant` (`solid`/`soft`/`outline`), `size`.
- `NavItem` - ícone + rótulo + `trailing?` (contador/chip) + `active?`.
- `Section` - título + ação opcional.
- `Icon` - migrado de `ui/icons.tsx`, mesma API; `mountIcon` preservado para `renderer/legacy/`.

Migrados de lugar sem reescrita de CSS/teste (Q-102 - nenhum tinha chamador de produção ainda):
`Checkbox`, `Dialog`, `EmptyState`, `InfoBox`, `SegmentedControl`, `Select`, `Switch`, `TableRow`,
`TextField`. Pendência registrada, não lacuna silenciosa.

Props compartilhadas (`tone`/`size`/`variant`/`active`/`disabled`/`fullWidth`) registradas no
glossário de `AGENTS.md`, por pedido do mantenedor a meio da tarefa.

### A lateral (`renderer/features/sidebar/`)

`Sidebar.tsx` (raiz: logo, cabeçalho com recolher, alça de redimensionar via `useSidebarResize`),
`useSidebar.ts` (dados de Projects/Today, favoritos/recentes/contadores via
`state/sidebar-summary.ts`, aba ativa via `renderer/legacy/tabs-view.ts`), `TodayCard`,
`FavoritesSection`, `RecentSection`, `NavList` (apresentacionais), `SidebarFooter` +
`useSidebarFooter.ts` (faixa de horário e pílula do daemon reativas), `useSidebarCollapse.ts`/
`useSidebarResize.ts`. Substitui inteiramente `sidebar-favorites-view.tsx`/
`sidebar-collapse-view.ts`/`sidebar-resize-view.ts`/`schedule-strip-view.ts`/
`daemon-control-view.tsx` (apagados). Nenhum `getElementById`/`innerHTML`/montagem imperativa
nesta região - só os dois anchors estáticos que `new-project-dialog-view.ts`/
`end-day-dialog-view.ts`/`autostart-control-view.ts` (legados) ainda preenchem por fora, como o
item "Cuidados" da tarefa previu.

### Os 6 defeitos da V2-T63, corrigidos e confirmados por captura real

Todos os seis confirmados visualmente nas quatro capturas (ver abaixo): espaço entre "All
projects"/"Sessions"; `+` de Favorites centralizado; contador com respiro da borda; texto do chip
"N running" centralizado; "Daemon running"/"Daemon stopped" em `body-sm` 14px peso 500; lateral
nunca corta texto nem rola na horizontal, em nenhum dos quatro estados capturados (incluindo
recolhida).

### Defeito de produção achado por captura de tela real (`a2cdb18`)

`renderer.tsx` montava `AppShell()` como chamada de função simples, não `<AppShell/>` - quebrava
TODO hook (`useSidebarCollapse`) com `Cannot read properties of undefined (reading '__H')` assim
que a janela real carregava. Só apareceu ao lançar o app de verdade e ler o console - exatamente
o que a exigência de prova visual deste documento pede. Corrigido, comentário cita D-052.

### Defeito de ferramental achado pelo próprio portão (`34ed5b9`)

A varredura de resíduo de teste interrompido em `scripts/clean-dist.mjs` deletava QUALQUER
`.js`/`.d.ts` dentro de `packages/*/src/`, na premissa (verdadeira até esta tarefa) de que nenhum
pacote tinha um `.d.ts` escrito à mão. Esta tarefa introduziu o primeiro
(`renderer/css-modules.d.ts`), e a varredura o apagava do disco a cada `npm run build`,
derrubando o próprio portão que deveria confirmar a tarefa. Corrigido para só tratar um
`.js`/`.d.ts` como resíduo quando existe um `.ts`/`.tsx` irmão de mesmo nome base (o jeito real
como o `tsc` emite) - testado manualmente nos dois sentidos (arquivo `_guard-*` continua sendo
apagado por inteiro; um `.d.ts` autônomo sobrevive) antes de confiar na correção.

### Prova visual (capturas reais, janela isolada, `SEEYA_APP_HOME_OVERRIDE` descartável)

Quatro capturas, dados fictícios (3 projetos, 2 favoritos, 1 recente, 1 sessão "alive" real,
daemon ligado/desligado), conferidas pessoalmente antes deste relatório:
- claro, dados completos: `v2t75-light-final2.png`
- escuro, dados completos: `v2t75-dark-final2.png`
- lateral recolhida: `v2t75-collapsed-final3.png`
- daemon parado: `v2t75-stopped-final2.png`

Caminhos no scratchpad da sessão (não fazem parte do repositório). O registro do Windows
(`HKCU\Software\Classes\seeya-dev`) e o hash SHA-256 do `protocol-handler.json` real
(`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`) foram conferidos antes e
depois de toda a sessão de captura - idênticos.

### Desempenho (`docs/DESEMPENHO.md`, V2-T75)

(b) memória em repouso: 372,0-404,9 MiB, dentro da faixa já registrada. (a)/(c) saíram muito
abaixo de toda entrada anterior (689-693 ms; 0,08%-0,16% de CPU) - registrado como medido, não
reivindicado como melhoria desta tarefa, já que nada aqui toca descoberta de sessão ou o laço de
atualização; o próprio comentário pré-existente de `measure-startup.mjs` já esperava "~1s". (d)
não medido - mesma recusa do classificador de permissão ("Production Deploy") que a V2-T63 já
registrou.

### Testes e portão

`npm run verificar`: verde (tipos, lint, `dependency-cruiser`, build, cobertura) - 321 arquivos de
teste, 3127 testes passando (4 pulados), cobertura total 95,85% statements / 96,07% lines
(`core/` 99,48%, acima do piso de 95%; demais diretórios acima de 80%).

`GIT_CONFIG_GLOBAL=... GIT_CONFIG_NOSYSTEM=1 npm test` (pedido separadamente): recusado pelo
sandbox do harness ("isolamento de worktree... git operations must target its own worktree").
Não contornado - `npm run verificar` já roda a suíte de integração/guards completa (inclusive os
testes que fazem `git commit` de verdade) sob a configuração de git deste sandbox.

### Transparência sobre um fork anterior

Durante esta tarefa, um fork despachado para construir fixtures/capturar telas saiu do escopo
combinado (instruído a nunca editar `packages/*/src`) e, antes de eu poder revisar, commitou
sozinho (`df682fd`) duas correções reais: o guard de `maxBuffer` em
`tests/integration/guards/_support.ts` (1MB padrão excedido por 4,6KB, truncando stdout) e os
`index.ts` que faltavam nos componentes migrados de `ui/`. Revisei o diff, considerei correto e
consistente com o resto da tarefa, e mantive - registrado aqui para constar, não escondido.

### Questões em aberto

Nenhuma nova além da Q-102 (já registrada em `docs/QUESTOES.md`, pendência dos 9 componentes
migrados sem CSS/teste reescritos).
<!-- SECTION:NOTES:END -->
