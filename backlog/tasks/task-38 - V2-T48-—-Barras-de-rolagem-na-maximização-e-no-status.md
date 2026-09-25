---
id: TASK-38
title: V2-T48 — Barras de rolagem na maximização e no status
status: To Do
assignee: []
created_date: '2026-09-24 14:44'
updated_date: '2026-09-25 01:16'
labels: []
milestone: m-2
dependencies:
  - TASK-25
references:
  - packages/app/src/electron
priority: medium
type: bug
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T48 — Barras de rolagem na janela: primeira maximização e bloco de status.** Relato do
mantenedor em 2026-09-24 (Windows, app instalado), com duas capturas de tela que ficam **fora do
repositório** — têm caminhos reais e conteúdo de sessão. Descritas aqui.

**1. A primeira maximização deixa o terminal maior que o espaço dele.** Abrir o seeya e maximizar
pela primeira vez: o terminal da aba passa do painel — o texto sai cortado na borda direita, e a
**janela inteira** ganha uma barra de rolagem vertical (borda direita, de cima a baixo) e uma
horizontal (atravessando o rodapé, lateral incluída). Desmaximizar e maximizar de novo corrige, e
dali em diante fica certo. Ou seja: o recálculo de linhas e colunas do terminal não acompanha a
**primeira** mudança de tamanho, e acompanha as seguintes.

- **Medir antes de corrigir**: qual evento a primeira maximização dispara (ou deixa de disparar),
  e em que ordem em relação ao ajuste do terminal. Um ajuste agendado antes de o layout assentar é
  a suspeita óbvia, não a conclusão.
- A correção vale para **qualquer** mudança de tamanho, não só para maximizar — maximizar é só o
  jeito mais fácil de reproduzir.
- **A janela nunca deve ter barra de rolagem própria.** Quem rola é o conteúdo de cada região
  (o terminal tem a dele); overflow do documento inteiro é o sintoma a proibir, não só a causa desta
  vez.

**2. O bloco STATUS da lateral estoura na horizontal, sempre.** Independente de maximizar: a linha
`Autostart: enabled (<caminho do executável>\resources\app.asar\node_modules\@seeya-ai\cli\dist\index.js)`
não tem onde quebrar, sai cortada, e a lateral ganha uma barra horizontal curta embaixo. Continua
visível na captura *depois* do item 1 corrigido pelo desmaximizar.

- O texto é o mesmo da CLI (`seeya status`), e **continua sendo** — o conserto é a lateral quebrar
  linha longa (inclusive dentro de caminho), não encurtar o texto do status.

**Custo (régua do `docs/DESEMPENHO.md`):** nenhum trabalho novo em repouso esperado; se a correção do
item 1 acrescentar observador de tamanho ou ajuste periódico, dizer o custo no relatório.

**Aceite do mantenedor:** abrir o seeya e maximizar pela primeira vez — sem barra de rolagem na
janela, terminal inteiro visível; com o autostart ligado, a lateral sem barra horizontal e o caminho
do autostart quebrado em linhas.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-24 15:12
---
Adiada pelo mantenedor em 2026-09-24: tem contorno (desmaximizar e maximizar de novo) e não incomoda no dia a dia; pode esperar a V2-T30 (task-25), a tarefa que desenvolve a interface por projeto, e ser feita junto com ela. Ordem combinada: V2-T46, V2-T44, V2-T34.
---

author: PO
created: 2026-09-25 01:16
---
Absorvida pela V2-T30 (item 6 da especificação de 2026-09-24): os dois itens desta tarefa são entregues e aceitos lá. Fecha junto com ela.
---
<!-- COMMENTS:END -->
