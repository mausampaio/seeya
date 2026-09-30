---
id: decision-51
title: D-051 — A interface usa Preact com componentes próprios
date: '2026-09-30 10:32'
status: accepted
---
## Contexto

A interface (`packages/app`) é TypeScript manipulando o DOM à mão, com um `index.css` de cores
fixas. Funcionou para as primeiras telas, mas cada componente com estado — lista, diálogo, abas —
virou código de DOM escrito à mão, e a fiação se concentrou em arquivos grandes (`renderer.ts`, o
motivo da V2-T51). Em 2026-09-29 o mantenedor decidiu investir na interface gráfica: o produto já
está em uso diário, e daqui em diante toda funcionalidade nova nasce com a tela especificada
(`docs/INTERFACE.md`).

A identidade visual (`design/IDENTIDADE_VISUAL.md`) já define tokens, tipografia, temas claro e
escuro, raios, sombras e movimento. Isso tira o valor de uma biblioteca de componentes pronta:
o estilo dela seria sobrescrito em cada componente, com peso a mais e nada ganho. Três caminhos
foram comparados: componentes em TypeScript puro (sem dependência, mas o DOM à mão cresce mal),
uma camada fina de componentes (Preact ou Lit) e React com biblioteca pronta (pesada, amarra o
visual a um estilo alheio). O objetivo declarado do app continua valendo: Electron leve e rápido.

## Decisão

**A interface passa a ser escrita em Preact, com componentes próprios construídos sobre os tokens
da identidade visual.** Nenhuma biblioteca de componentes. JSX compilado pelo `esbuild` que o
pacote já usa, sem a camada de compatibilidade com React (`preact/compat`).

- **Por que Preact e não Lit:** os dois são leves na mesma ordem de grandeza; o que desempata é
  quem mantém. O mantenedor domina React, e Preact é o mesmo modelo — Lit seria uma curva nova
  para ele (decisão dele, 2026-09-30).
- **Os módulos puros de `state/` continuam como estão.** Os reducers e construtores de texto que
  já existem e já têm teste passam a alimentar componentes, em vez de funções que montam DOM.
- **Tokens como variáveis CSS**, exatamente os valores da identidade visual, com os dois temas.
- **Fontes empacotadas no app** (Geist e Geist Mono, licença OFL), nunca carregadas da rede: o
  app funciona sem internet.

## Consequências

- **`preact` entra como dependência de `@seeya-ai/app`**, autorizada por esta decisão. Qualquer
  outra (biblioteca de testes de componente, ícones, roteamento) continua precisando de pergunta.
- **O custo é medido, não presumido.** A tarefa de fundação mede memória em repouso, tempo até a
  lista e tamanho em disco antes e depois, pelos métodos de `docs/DESEMPENHO.md`. Uma piora fora
  do ruído da faixa já registrada vira questão antes de a migração continuar; só nesse caso o Lit
  volta à mesa, medido do mesmo jeito.
- **A migração é por tela**, não de uma vez: cada tarefa troca uma região da janela e apaga o
  código de DOM à mão que ela substitui. A V2-T51 (dividir `renderer.ts`) é absorvida por esse
  caminho.
- **Onde o guarda-corpo termina:** esta decisão fixa a camada e a origem do visual; o desenho de
  cada tela vive em `docs/INTERFACE.md` e muda por especificação, não por decisão.
