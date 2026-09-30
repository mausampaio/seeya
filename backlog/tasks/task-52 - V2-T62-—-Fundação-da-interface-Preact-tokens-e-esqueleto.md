---
id: TASK-52
title: 'V2-T62 — Fundação da interface: Preact, tokens e esqueleto'
status: To Do
assignee: []
created_date: '2026-09-30 10:33'
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
