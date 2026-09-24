---
id: TASK-32
title: V2-T42 — Caixa de entrada entre sessões
status: To Do
assignee: []
created_date: '2026-09-24 00:17'
labels: []
milestone: m-6
dependencies: []
references:
  - docs/V2-RUMO.md
type: feature
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T42 — Caixa de entrada entre sessões.** Ideia do mantenedor em 2026-09-23, a partir de uma
necessidade real dele no mesmo período. Ainda **não especificada em detalhe** — esta entrada guarda
o caso de uso, o desenho proposto e as perguntas que precisam de resposta antes de virar tarefa
executável.

**O caso de uso, como ele viveu.** Duas sessões em frentes diferentes ao mesmo tempo: uma
consolidando dois projetos que tinham sido bifurcados e seguido caminhos distintos; outra migrando
um ambiente de cluster para outro provedor e subindo dois ambientes novos do zero. A segunda tinha
todo o contexto de infraestrutura — como conectar no banco, como usar as ferramentas de cluster, a
arquitetura dos ambientes. Em certo momento, a sessão de infraestrutura percebeu que precisava mexer
justamente no projeto que a outra estava consolidando. A solução foi manual e repetida **inúmeras
vezes**: pedir um handoff do que tinha acontecido, copiar, colar na outra sessão. O que era contexto
de infraestrutura caía na responsabilidade de uma; o que era do repositório do projeto, na outra.

**O desenho proposto por ele:** o seeya oferece um serviço de mensagens entre sessões. Uma sessão
indica para quem quer mandar, a mensagem cai na **caixa de entrada** da outra, e lá a pessoa pede ao
agente que leia a caixa. Sem copiar e colar, e com a vantagem de as mensagens poderem **apontar
arquivos** em vez de carregar o conteúdo inteiro.

**Por que encaixa neste projeto, e não é uma funcionalidade solta:** o seeya já sabe quais sessões
existem nesta máquina, já lhes dá nomes legíveis (`seeya sessions`), e já tem um lugar para estado
operacional (`~/.seeya/`, D-027). A mensagem é exatamente o tipo de coisa que não pertence ao
repositório do projeto: é operacional, é deste dispositivo, e não é conteúdo versionado.

**Esboço a confirmar quando virar tarefa executável:**

- **Endereçar por nome, nunca por id cru** — o mesmo nome que `seeya sessions` já mostra.
- **Endereçar a um projeto também**, não só a uma sessão: com a D-047, quem responde é quem segura o
  lock do projeto. Isso resolve o caso "não sei qual sessão está tocando aquilo agora".
- **Mandar e ler pela CLI** (`seeya message send`, `seeya inbox`), porque assim funciona em qualquer
  harness — é um comando de terminal, não uma integração por harness.
- **Mensagem aponta arquivo; não carrega conteúdo grande** (D-015 vale aqui também).
- **Nada roda sozinho.** Uma mensagem é dado, nunca instrução: o que chega é apresentado com a
  origem à vista ("mensagem da sessão X"), e o seeya jamais executa o que vier escrito nela. Isso
  precisa estar no desenho desde o começo, não depois.
- **A janela mostra caixa com mensagem nova** na lateral (encaixa na V2-T30), e a leitura continua
  sendo pedida pela pessoa ou lembrada por gancho (V2-T40) — nunca injetada à força na sessão.

**Precisão do mantenedor (2026-09-23): é caixa de comunicação, não de documentação.** Ela serve
para sessões se falarem; **toda decisão continua sendo registrada no projeto**. A caixa é transporte
e prova de que a conversa aconteceu — não é onde a memória mora. Isso responde a pergunta 2 abaixo:
o que vira decisão vai para `decisions/` do projeto de quem decidiu, sempre.

**Os dois usos que ele descreveu, e que definem a forma da mensagem:**

1. **Aviso que atravessa frentes.** Uma sessão encontra algo que interessa a outro projeto — "achei
   um furo que pode afetar o desenvolvimento de vocês". Quem recebe decide o que fazer com aquilo.
   A mensagem informa; não pauta o trabalho alheio.
2. **Pedido dentro de um escopo que não é seu.** Um agente toca a infraestrutura e **só ele tem essa
   permissão**; os outros podem pedir uma medição ou uma confirmação no ambiente. Quem recebe
   escolhe, **junto com a pessoa que está tocando aquela frente**, se vai fazer.

**A regra que nasce dos dois, e que não se negocia:** *"como tudo é assistido, não existe autonomia
aqui"*. Uma mensagem **nunca** é uma ordem, nunca dispara trabalho sozinha e nunca é executada por
ter chegado. Ela é dado com origem à vista; quem age é a dupla agente + pessoa do lado que recebeu.
Isso também é a defesa natural contra uma sessão induzir outra a fazer algo: sem execução
automática, o pior que uma mensagem faz é ocupar uma linha da caixa.

**Perguntas em aberto, que decidem o recorte:**

1. **Quem lê, e quando?** A pessoa pede ("leia sua caixa"), o `open` lê ao abrir, ou o gancho lembra?
   Cada resposta muda o quanto isso depende de harness.
2. ~~A mensagem vira parte do projeto?~~ **Respondida em 2026-09-23:** a caixa é transporte; a
   memória é o projeto. Decisão tomada a partir de uma mensagem vira decisão no projeto de quem
   decidiu.
3. **Mensagem para sessão morta**: fica na caixa esperando ela voltar, ou expira? E para sessão que
   nunca mais é retomada?
4. **Vale para máquinas diferentes?** Hoje não — é do dispositivo. Com a sincronização (passo 7 do
   rumo), a pergunta volta.

**Aceite (quando existir):** com duas sessões abertas em frentes diferentes, mandar de uma para a
outra o que hoje é copiado e colado, e a outra ler da própria caixa, sem intermediário humano
carregando texto.
<!-- SECTION:DESCRIPTION:END -->
