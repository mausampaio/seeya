---
id: decision-33
title: D-033 — A moldura é pública; o conteúdo gerado espelha a sessão
date: '2026-09-24 00:28'
status: accepted
---
## Contexto

**Confirmada pelo mantenedor em 2026-09-05**, depois de ver um `end-day` real em que a sessão do
projeto saiu **em português** e a `seeya-todo-test` **em inglês**, no mesmo relatório.

A **D-028** fixa inglês para o que é **público** — CLI, documentação, README. Ela foi escrita
antes de o handoff existir, e nunca classificou o texto que o **modelo gera a partir da conversa
do usuário**.

## Decisão

São duas camadas com regras diferentes, e elas já estavam separadas na prática:

- **A moldura é nossa e é pública: inglês.** `Captured:`, `Understanding:`, `mode`, `source`,
  `Scope:`, os títulos do `summary.md`, as mensagens de erro — tudo que o `seeya` escreve por
  conta própria segue a D-028, sem exceção.
- **O conteúdo gerado espelha o idioma da sessão.** O `understanding`, os `pendingItems` e o
  `tomorrowPlan` são reflexo do trabalho de quem usa, num arquivo privado em `~/.seeya/`. **O
  handoff não é público**: é a pessoa relendo o próprio dia.

**Por que não forçar um idioma.** Forçar inglês **traduziria o trabalho da pessoa de volta para
ela** — pior que a inconsistência que isso resolveria. E um briefing bilíngue é consequência
**honesta** de um dia bilíngue: quem trabalhou em duas línguas tem duas línguas no dia.
Uniformizar esconderia isso sem ganhar nada.

**O que muda na prática: nada no comportamento, e tudo na intenção.** Hoje o modelo espelha a
sessão **por acidente** — ninguém pediu. O dia em que ele não espelhar, ninguém vai saber dizer
se foi defeito ou variação. Então a regra passa a ser **dita no prompt de captura**, não
deduzida.

## Consequências

Uma frase no `GENERATION_SYSTEM_PROMPT` instruindo que a saída use o idioma predominante da
sessão. Com o cuidado que a **S4-T0e** já estabeleceu para aquele arquivo: ele é **curto de
propósito** (D-011), e cada acréscimo tem que caber no orçamento — o teste-tripwire de 1000
caracteres continua valendo, e se a frase não couber, isso é sinal de reavaliar o conjunto, não
de subir o limite.

**Fora de escopo:** tornar o idioma configurável. Ninguém pediu, e configuração que não resolve
problema observado é a chave em disco que a **D-027** avisa ser barata agora e cara depois.
