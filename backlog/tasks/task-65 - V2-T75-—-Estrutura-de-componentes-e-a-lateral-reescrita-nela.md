---
id: TASK-65
title: V2-T75 — Estrutura de componentes e a lateral reescrita nela
status: Review
assignee: []
created_date: '2026-09-30 21:21'
updated_date: '2026-10-01 10:27'
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

## Comments

<!-- COMMENTS:BEGIN -->
author: agente
created: 2026-10-01 00:48
---
Correção pós-revisão do PO (4 itens), mesma branch, commits c5bd32b/6135209/9b60c95:

1. Rodapé sem padding horizontal — Sidebar.tsx/SidebarFooter envolvido em Surface(padding=sm)+Stack(gap=sm) em vez de CSS avulso; mesmo token --seeya-space-2 que o conteudo ja usava.

2. Contraste dos icones fantasmas — a cor ja estava certa (text-secondary, ~7:1 de contraste matematico nos dois temas); o defeito real era strokeWidth fixo em unidades do viewBox, que encolhe junto com o size (2 de 24 unidades a size=16 rende so ~1.33px, abaixo do piso 1.5-2px da identidade secao 6.4). Corrigido para manter o traco RENDERIZADO constante independente do size; os dois icones tambem subiram para o grid preferencial de 24px. Confirmado por dump real do DOM (width/height/strokeWidth) de um processo Electron vivo, nao so por pixel de screenshot — a captura offscreen deste sandbox mostrou-se pouco sensivel a mudancas de tamanho/traco na comparacao visual, mas o DOM entregue a um usuario real esta correto. Teste de regressao adicionado.
---

author: agente
created: 2026-10-01 00:48
---
3. Captura do tema claro tampada pelo dialogo — fixtures agora gravam daemon-ownership-transition.json pre-respondido (como a V2-T63 fez), eliminando o dialogo nas quatro capturas novas.

4. Medicao da subida — confirmado que o instante medido continua sendo o sessionsUpdate com a lista REAL descoberta: a relocacao de main.ts para main/ foi renomeacao pura (0 insercoes/delecoes, git show 9e9231e), e writeStartupTiming roda depois de buildSidebarRows(discovery)+o envio real. Remedido com o cache do binario de dev limpo: 668-747ms, mesma faixa — a diferenca contra a linha de base de 5,6-6,0s nao e explicada por este cache de verificacao nem por mudanca de codigo desta tarefa; registrado em docs/DESEMPENHO.md como medido, nao como melhoria.

npm run verificar verde apos as quatro correcoes. Quatro capturas novas (claro/escuro/recolhida/parado) confirmadas visualmente, caminhos no scratchpad da sessao. Registro/protocol-handler.json reais conferidos identicos antes e depois. Segue em Review.
---

author: agente
created: 2026-10-01 01:03
---
Correcao do item 2 (contraste dos icones fantasmas), commit 8ca39de. Causa real achada com getComputedStyle num processo Electron de verdade (nao so pixel de screenshot): o <svg> de #sidebar-collapse-toggle/#new-project-button media width computado 10px contra o atributo HTML width=24, com ZERO regras de CSS batendo (percorri todas as 5 folhas de estilo carregadas com element.matches()) — e o mesmo 10px nos dois icones, apesar de geometrias de traco totalmente diferentes (chevron diagonal vs cruz simetrica), o que descarta explicacao por bounding-box de conteudo.

Explicacao: width/height em <svg> sao presentational hints do UA stylesheet, nao CSS — a resolucao de flex-basis:auto do Chromium nao trata esses atributos como 'tamanho especificado' do jeito que trata num <img>, entao o item flex encolhe para bem menos que o quadrado pedido. CSS explicito (style inline width/height) sempre vence o atributo presentational e e respeitado por flex-basis:auto.

Apliquei em outlineIcon, filledIcon e StarIcon (os tres construtores de svg em Icon.tsx), nao so nos dois call sites — confirmado de novo com getComputedStyle (width/height computados agora batem com o pedido) e com uma captura real onde '+' e '<' aparecem com o mesmo peso visual do icone de pasta/estrela nas linhas ao lado.

Tambem corrigi o comentario desatualizado (falava em 20px, o codigo sempre usou 24px desde a primeira tentativa deste defeito).

Bundle usado na captura final: packages/app/dist/electron/{main,renderer}.js de 2026-09-30 21:57 (recompilado com node scripts/build.mjs em packages/app logo antes da captura, sem nenhum codigo de diagnostico). npm run verificar verde. Caminho da captura: v2t75-icons-fixed-final.png (scratchpad da sessao, nao no repositorio). Registro/protocol-handler.json reais conferidos identicos antes e depois. Segue em Review.
---

author: PO
created: 2026-10-01 01:12
---
Revisão do PO em 2026-09-30: três rodadas de captura conferidas pelo PO. Rodada 1 trouxe a estrutura da D-052, o design system inicial e a lateral reescrita, mas com o rodapé sem padding, botões de ícone apagados e a captura clara tampada pelo diálogo de posse. Rodada 2 corrigiu rodapé (primitivas) e captura. Rodada 3 achou a causa real dos ícones minúsculos: o SVG flex encolhia para 10 px porque width/height de atributo não contam como tamanho; agora tamanho explícito em todos os ícones. Subida medida 0,7 s (contra 5,8 s histórico) confirmada como o mesmo instante medido, sem explicação nesta tarefa — registrado como medido, não como ganho. Mesclado, portão verde (3128 testes), também sem identidade global do git. Falta o aceite do mantenedor com o instalador.
---

author: agente
created: 2026-10-01 10:26
---
CorreÃ§Ã£o do aceite do mantenedor sobre a lateral reescrita (branch `tarefa/V2-T75-agenda-e-terminal`), entregue em seis rodadas de mensagens do coordenador. `npm run verificar` verde (3223 testes, 0 violaÃ§Ãµes de dependÃªncia) na ponta do branch (commit 2261a97).

**Rodada 1 â€” agenda e tema do terminal:**
- Snooze virou `Button` + `ChevronDownIcon` abrindo um `Menu` novo (`renderer/components/Menu/`, construÃ­do sobre `Popover`) com +15m/+30m/+1h, setas/Enter/Esc e foco devolvido â€” nunca mais o `<select>` nativo sem estilo.
- Snooze/Skip lado a lado com largura igual via `Grid`+`GridItem` (nunca `flex` avulso).
- A linha da agenda virou Ã­cone de relÃ³gio + texto primÃ¡rio (peso 500) + texto secundÃ¡rio (terciÃ¡rio), para os seis estados de `ScheduleDecision` (`state/schedule-strip.ts` agora devolve `primary`/`secondary`, nÃ£o mais um `text` achatado).
- O terminal (xterm) passou a derivar fundo/texto/seleÃ§Ã£o dos tokens do tema ativo em tempo real (`state/terminal-theme.ts#buildTerminalThemeFromTokens`), trocando ao vivo com o tema.

**Rodada 2 â€” um botÃ£o de recolher por vez:** sÃ³ o botÃ£o do cabeÃ§alho (lateral aberta) ou o da barra de abas (recolhida) existe no DOM por vez; `Ctrl+B` continua funcionando; foco migra para o botÃ£o que aparece quando o que tinha foco some.

**Rodada 3 â€” margem do terminal, hover da aba, transiÃ§Ã£o e sombra:**
- Margem interna do terminal (16px laterais, 12px cima/baixo) via um wrapper externo com padding e uma superfÃ­cie interna sem padding, para o `fit` descontar a margem de verdade.
- Hover distinto: aba inteira realÃ§a no hover da aba; `:hover` do `Ã—` suprime o realce da aba via `:not(:has(.close:hover))`, realÃ§ando sÃ³ o `Ã—`.
- TransiÃ§Ã£o de largura da lateral (180-240ms, tokens de movimento); `ResizeObserver` do terminal debounced por `requestAnimationFrame` para reajustar sÃ³ ao fim da transiÃ§Ã£o, nunca a cada quadro.
- Sombra na borda direita da lateral (token novo `--seeya-shadow-sidebar`), menor + borda reforÃ§ada no tema escuro.

**Rodada 4 â€” tipografia, projeto ativo e truncamento:**
- `Text` (`renderer/components/Text/`) e o unico lugar que decide tamanho/altura de linha/peso - variantes da escala da identidade (display...code). Migrado para dentro de `Section`, `NavItem`, `TodayCard`, `Chip`, `Button`, alem da lateral inteira. Lista completa de todo `font-size` que existia e para qual variante foi, abaixo.
- Projeto aberto nesta janela ganha fundo `surface-subtle`; suas sessoes viram linha estruturada (ponto de estado colorido por tom, nome, id curto em mono) - nunca mais `nome [id] (estado)` entre colchetes/parenteses.
- Toda linha da lateral tem `min-width: 0` nos filhos flex e trunca com reticencias; a lateral nunca rola na horizontal (`#sidebar .content`'s own `overflow-x: hidden`, preservado).

**Rodada 5 - Recent e Favorites, mesmo componente:** extraido `ProjectRow` (`renderer/features/sidebar/ProjectRow/`), compartilhado por `FavoritesSection`/`RecentSection` - antes, Recent mostrava so pasta+nome, sem destaque/lock/sessoes mesmo para o projeto aberto nesta janela. `state/sidebar-summary.ts#RecentProjectRow` agora carrega o mesmo `badge`/`sessions` que `FavoriteProjectRow` ja tinha.

**Rodada 6 - icones alinhados e separador:** `ProjectRow`/`NavItem` compartilham o mesmo padding/gap (`var(--seeya-space-2)` nos dois), corrigindo a coluna de icones que antes variava entre Recent (sem padding), Favorites (gap menor) e NavItem. Novo componente `Divider` (`renderer/components/Divider/`) separa o bloco Today/Favorites/Recent de All projects/Sessions.

**Lista de `font-size` migrados (item da rodada 4):**
- `FavoritesSection`/`RecentSection` (12/11px nomes e vazio) -> `ProjectRow`'s own `body-sm` (nomes) / `caption` (vazio, ids mono).
- `NavItem` (13px) -> `body-sm`, peso 500 so quando `active`.
- `Section` (12px, peso 500) -> `caption`, tom terciario.
- `TodayCard` titulo (12px, peso 500) -> `body-sm` peso 500 (tratamento de item de navegacao); subtitulo (11px) -> `caption`, tom secundario.
- `Chip` (11/12/13px por tamanho) -> `body-sm` peso 500, uniforme - os tres tamanhos agora variam so no padding.
- `Button` (13/14/16px por tamanho) -> `body-sm`/`body-md`/`body-lg`, mapeados pela identidade.
- `SidebarFooter` (11px na agenda/resultado do daemon/autostart) -> agenda em `caption`; resultado do daemon/autostart em 12/16px cru (excecao documentada: conteudo escrito por `textContent` do codigo legado, nunca um filho do Preact).
- `NavList` (12px no cabecalho/lista de Ignored projects) -> mesma excecao documentada (conteudo 100% do `renderer/legacy/projects-list-view.tsx`), ajustado para bater exatamente com `caption` (12/16, antes faltava o `line-height`).

**Limitacao encontrada nesta sessao - capturas de tela nao feitas.** Preparei uma fixture descartavel (`SEEYA_APP_HOME_OVERRIDE`, tres projetos, favoritos, lock simulado, `estado.json`/`config.json` para os seis estados da agenda) e dois flags novos de instrumentacao (`SEEYA_APP_AUTO_NARROW_SIDEBAR`, `SEEYA_APP_AUTO_OPEN_SNOOZE_MENU`, documentados no `AGENTS.md` e no proprio `main.ts`), mas descobri no meio da verificacao que esta propria maquina ja tinha uma instancia real do `seeya` (`npm run app`, checkout principal, nao este worktree) rodando ha mais de uma hora - toda tentativa de abrir uma segunda janela para a captura perdia a corrida do `app.requestSingleInstanceLock()` do Electron e saia em silencio (`exit 0`, nenhum log). Nao encerrei nem contornei essa instancia real (nao e minha para mexer), entao nao ha capturas desta rodada. Cada defeito listado acima tem teste de unidade/integracao cobrindo o comportamento renderizado (classes, texto, badge, truncamento) - a prova visual fica pendente de uma sessao sem esse conflito.

Segue em Review.
---

author: agente
created: 2026-10-01 10:27
---
Nota: o comentario anterior (#5) saiu com erro de codificacao de caracteres ao ser postado — desconsidere-o, o texto correto (mesmo conteudo, sem acentos para evitar o mesmo problema) esta no proximo comentario.
---

author: agente
created: 2026-10-01 10:27
---
Correção do aceite do mantenedor sobre a lateral reescrita (branch `tarefa/V2-T75-agenda-e-terminal`), entregue em seis rodadas de mensagens do coordenador. `npm run verificar` verde (3223 testes, 0 violações de dependência) na ponta do branch (commit 2261a97).

**Rodada 1 — agenda e tema do terminal:**
- Snooze virou `Button` + `ChevronDownIcon` abrindo um `Menu` novo (`renderer/components/Menu/`, construído sobre `Popover`) com +15m/+30m/+1h, setas/Enter/Esc e foco devolvido — nunca mais o `<select>` nativo sem estilo.
- Snooze/Skip lado a lado com largura igual via `Grid`+`GridItem` (nunca `flex` avulso).
- A linha da agenda virou ícone de relógio + texto primário (peso 500) + texto secundário (terciário), para os seis estados de `ScheduleDecision` (`state/schedule-strip.ts` agora devolve `primary`/`secondary`, não mais um `text` achatado).
- O terminal (xterm) passou a derivar fundo/texto/seleção dos tokens do tema ativo em tempo real (`state/terminal-theme.ts#buildTerminalThemeFromTokens`), trocando ao vivo com o tema.

**Rodada 2 — um botão de recolher por vez:** só o botão do cabeçalho (lateral aberta) ou o da barra de abas (recolhida) existe no DOM por vez; `Ctrl+B` continua funcionando; foco migra para o botão que aparece quando o que tinha foco some.

**Rodada 3 — margem do terminal, hover da aba, transição e sombra:**
- Margem interna do terminal (16px laterais, 12px cima/baixo) via um wrapper externo com padding e uma superfície interna sem padding, para o `fit` descontar a margem de verdade.
- Hover distinto: aba inteira realça no hover da aba; `:hover` do `×` suprime o realce da aba via `:not(:has(.close:hover))`, realçando só o `×`.
- Transição de largura da lateral (180-240ms, tokens de movimento); `ResizeObserver` do terminal debounced por `requestAnimationFrame` para reajustar só ao fim da transição, nunca a cada quadro.
- Sombra na borda direita da lateral (token novo `--seeya-shadow-sidebar`), menor + borda reforçada no tema escuro.

**Rodada 4 — tipografia, projeto ativo e truncamento:**
- `Text` (`renderer/components/Text/`) e o unico lugar que decide tamanho/altura de linha/peso - variantes da escala da identidade (display...code). Migrado para dentro de `Section`, `NavItem`, `TodayCard`, `Chip`, `Button`, alem da lateral inteira. Lista completa de todo `font-size` que existia e para qual variante foi, abaixo.
- Projeto aberto nesta janela ganha fundo `surface-subtle`; suas sessoes viram linha estruturada (ponto de estado colorido por tom, nome, id curto em mono) - nunca mais `nome [id] (estado)` entre colchetes/parenteses.
- Toda linha da lateral tem `min-width: 0` nos filhos flex e trunca com reticencias; a lateral nunca rola na horizontal (`#sidebar .content`'s own `overflow-x: hidden`, preservado).

**Rodada 5 - Recent e Favorites, mesmo componente:** extraido `ProjectRow` (`renderer/features/sidebar/ProjectRow/`), compartilhado por `FavoritesSection`/`RecentSection` - antes, Recent mostrava so pasta+nome, sem destaque/lock/sessoes mesmo para o projeto aberto nesta janela. `state/sidebar-summary.ts#RecentProjectRow` agora carrega o mesmo `badge`/`sessions` que `FavoriteProjectRow` ja tinha.

**Rodada 6 - icones alinhados e separador:** `ProjectRow`/`NavItem` compartilham o mesmo padding/gap (`var(--seeya-space-2)` nos dois), corrigindo a coluna de icones que antes variava entre Recent (sem padding), Favorites (gap menor) e NavItem. Novo componente `Divider` (`renderer/components/Divider/`) separa o bloco Today/Favorites/Recent de All projects/Sessions.

**Lista de `font-size` migrados (item da rodada 4):**
- `FavoritesSection`/`RecentSection` (12/11px nomes e vazio) -> `ProjectRow`'s own `body-sm` (nomes) / `caption` (vazio, ids mono).
- `NavItem` (13px) -> `body-sm`, peso 500 so quando `active`.
- `Section` (12px, peso 500) -> `caption`, tom terciario.
- `TodayCard` titulo (12px, peso 500) -> `body-sm` peso 500 (tratamento de item de navegacao); subtitulo (11px) -> `caption`, tom secundario.
- `Chip` (11/12/13px por tamanho) -> `body-sm` peso 500, uniforme - os tres tamanhos agora variam so no padding.
- `Button` (13/14/16px por tamanho) -> `body-sm`/`body-md`/`body-lg`, mapeados pela identidade.
- `SidebarFooter` (11px na agenda/resultado do daemon/autostart) -> agenda em `caption`; resultado do daemon/autostart em 12/16px cru (excecao documentada: conteudo escrito por `textContent` do codigo legado, nunca um filho do Preact).
- `NavList` (12px no cabecalho/lista de Ignored projects) -> mesma excecao documentada (conteudo 100% do `renderer/legacy/projects-list-view.tsx`), ajustado para bater exatamente com `caption` (12/16, antes faltava o `line-height`).

**Limitacao encontrada nesta sessao - capturas de tela nao feitas.** Preparei uma fixture descartavel (`SEEYA_APP_HOME_OVERRIDE`, tres projetos, favoritos, lock simulado, `estado.json`/`config.json` para os seis estados da agenda) e dois flags novos de instrumentacao (`SEEYA_APP_AUTO_NARROW_SIDEBAR`, `SEEYA_APP_AUTO_OPEN_SNOOZE_MENU`, documentados no `AGENTS.md` e no proprio `main.ts`), mas descobri no meio da verificacao que esta propria maquina ja tinha uma instancia real do `seeya` (`npm run app`, checkout principal, nao este worktree) rodando ha mais de uma hora - toda tentativa de abrir uma segunda janela para a captura perdia a corrida do `app.requestSingleInstanceLock()` do Electron e saia em silencio (`exit 0`, nenhum log). Nao encerrei nem contornei essa instancia real (nao e minha para mexer), entao nao ha capturas desta rodada. Cada defeito listado acima tem teste de unidade/integracao cobrindo o comportamento renderizado (classes, texto, badge, truncamento) - a prova visual fica pendente de uma sessao sem esse conflito.

Segue em Review.
---
<!-- COMMENTS:END -->
