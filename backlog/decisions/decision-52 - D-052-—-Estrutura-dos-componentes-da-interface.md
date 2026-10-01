---
id: decision-52
title: D-052 — Estrutura dos componentes da interface
date: '2026-09-30 21:20'
status: accepted
---
## Contexto

A D-051 escolheu Preact, mas não disse como organizar os componentes. As primeiras entregas
(V2-T62, V2-T63) usaram o Preact só para gerar a marcação inicial e continuaram montando a tela à
mão (`getElementById`, montagem imperativa de ícones): um arquivo montava a lateral inteira, não
havia componente de chip nem de linha de navegação, e cada peça era estilizada solta. O resultado
apareceu no uso real — itens colados, contadores sem respiro, chip fora do centro, texto cortado —
e na leitura do código pelo mantenedor em 2026-09-30: "não existe separação por componente".

## Decisão

**A interface é organizada em componentes de verdade, reativos, cada um com a sua estrutura.**

1. **Pastas** em `packages/app/src/`:
   - `main/` — processo principal do Electron (janela, IPC, preload). Nada de interface aqui.
   - `renderer/App.tsx` — a raiz.
   - `renderer/components/` — o design system: um componente por pasta
     (`Chip/Chip.tsx`, `Chip.module.css`, `Chip.test.tsx`, `index.ts`).
   - `renderer/features/<região>/` — uma pasta por região da janela (`sidebar`, `tabs`, `today`,
     `projects`, `sessions`, `settings`, `dialogs`), com o componente da região, o hook que guarda a
     lógica dela (`useSidebar.ts`), o CSS dela, e subpastas para os componentes internos
     (`TodayCard/`, `FavoritesSection/`…), cada um com a mesma estrutura.
   - `renderer/hooks/` — hooks compartilhados (assinar um canal de IPC, tema).
   - `renderer/ipc/` — o cliente tipado da ponte com o processo principal.
   - `state/` continua: lógica pura e testada, consumida pelos hooks.
2. **Componente não toca o DOM à mão.** Nada de `getElementById`, `innerHTML`, `appendChild` ou
   montagem imperativa. Estado em hooks (`useState`/`useReducer` sobre os reducers de `state/`);
   o que chega do processo principal entra por um hook de assinatura.
3. **Um componente por arquivo, nome em PascalCase; hook em `useAlgo.ts`.**
4. **CSS modules** (`*.module.css`, suportados pelo `esbuild` já em uso — sem dependência nova):
   o estilo pertence ao componente e não vaza. Valores só pelos tokens da identidade.
5. **Primitivas de disposição com props tipadas nos tokens.** A tela se organiza por componentes de
   layout, não por CSS avulso em cada região: pilha (vertical/horizontal, com `gap`), grade
   (`columns` e `span`, ex.: 12 colunas com dois filhos de 6), superfície (cartão/painel: `padding`,
   `radius`, `elevation`, `variant`). As props aceitam só a escala de tokens (`gap="md"`,
   `padding="lg"`, `span={6}`), nunca pixel solto — o tipo recusa o que a identidade não prevê
   (D-024). CSS próprio numa região fica para o que as primitivas não expressam.
6. **O que varia e se repete vira prop tipada** (acréscimo do mantenedor, 2026-09-30): tom
   (`tone`: os papéis da identidade — neutral, brand, success, warning, danger), tamanho (`size`:
   sm, md, lg), variante quando há mais de uma (`variant`), estado (`active`, `disabled`), largura
   (`fullWidth`), trabalho em andamento (`loading`: desabilita, mostra o indicador, mantém a largura —
   quem usa o componente controla o valor). Uniões literais no tipo, padrão explícito, e o CSS module traduz cada valor em
   tokens — nunca uma classe ou um estilo avulso no lugar de usar o componente. Os nomes das props
   compartilhadas e seus valores ficam no glossário do `AGENTS.md`.
7. **Texto só pela escala tipográfica** (aceite do mantenedor, 2026-10-01 — a lateral saiu com
   cinco tamanhos de fonte sem critério): um componente `Text` com `variant` tirado da escala da
   identidade (seção 4.4 — `body-md`, `body-sm`, `caption`, `heading-*`), `tone` (primário,
   secundário, terciário) e `weight` (400, 500, 600). Os componentes do design system usam a mesma
   escala internamente. O CSS de uma região não define `font-size` nem `line-height`.
8. **Testes de componente renderizados**, com `@testing-library/preact` e `happy-dom` como
   dependências de desenvolvimento (aprovadas pelo mantenedor em 2026-09-30): o componente é
   montado e testado pelo que a pessoa vê e faz, não pelo objeto que a função devolve.

**Tailwind foi considerado e não entra.** Daria a mesma agilidade de disposição, mas traz uma
ferramenta de build nova, uma segunda fonte dos tokens (a configuração dele, ao lado da
identidade visual), marcação cheia de classes utilitárias, e competiria com os CSS modules. As
primitivas tipadas dão o ganho que importa — organizar a tela sem CSS em todo lugar — presas à
escala da identidade, sem dependência nova.

## Consequências

- **A V2-T75 cria a estrutura** e reescreve nela o esqueleto e a lateral; as tarefas de região
  seguintes (V2-T64 a V2-T71) já nascem nela.
- **O código de tela antigo migra por região.** Até a tarefa da região dele chegar, fica numa
  pasta marcada como legado e sai quando a região é reescrita — nunca coexistem dois jeitos para a
  mesma região.
- **Onde o guarda-corpo termina:** as primitivas limitam valores à escala, mas não impedem um CSS
  module de usar um valor solto; a revisão cobra, e o que se repetir vira regra de lint.
