---
id: TASK-65
title: V2-T75 — Estrutura de componentes e a lateral reescrita nela
status: To Do
assignee: []
created_date: '2026-09-30 21:21'
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
