---
id: decision-39
title: 'D-039 — O seeya é secretário: agrega, organiza, sintetiza — nunca decide'
date: '2026-09-24 00:42'
status: accepted
---
## Contexto

Título original completo: "O seeya é um secretário: agrega, organiza, sintetiza e entrega —
nunca decide o que fazer".

**Rumo definido pelo mantenedor em 2026-09-07**, depois de dois dias usando o daemon de verdade.
**Não é tarefa, é critério** — existe para poder **recusar** funcionalidade depois.

**A dor, na formulação dele, e ela é maior do que a que originou o projeto.** O seeya nasceu para
resolver "eu passo do horário": ou esqueço, ou não quero perder a linha de pensamento, e estico.
Isso ele resolve. Mas *"eu ainda estou com 10 sessões abertas, e mesmo que o seeya feche elas,
quando eu voltar ele vai reabrir e eu ainda vou me ver perdido entre 10 sessões e mais umas 10 que
já fechei"*.

E há uma segunda dor, que é a que dá o formato do produto: **toda sessão nova nasce burra.** *"Em
uma sessão de 6h seguidas eu construí uma lógica complexa que a próxima sessão vai esquecer"*, e
recuperar isso à mão — "procure na pasta tal, no repositório y, e nos repos x, y e z, e entenda o
contexto" — *"é caro, é lento, é irritante"*.

**Memória não resolve isso, e não deveria** (palavras dele). Memória guarda o que você escolheu
tornar regra permanente; o que se perde aqui é o **estado de um trabalho específico** — o
raciocínio construído numa sessão, que não é regra e não deve virar uma. São artefatos de natureza
diferente.

## Decisão

**A metáfora, que é dele e é mais precisa que a minha:** o seeya é um **secretário**. Ele agrupa,
organiza, sintetiza, marca e **entrega de bandeja** para a sessão seguinte tudo o que ela precisa
para trabalhar. **Ele nunca diz o que fazer.**

**A linha, escrita para ser usável contra uma ideia futura:** *o seeya nunca decide que trabalho
acontece; ele só ajuda a encontrar, entender e retomar o trabalho que já é seu.* Orquestrador
**decide** o trabalho. O seeya **descreve e devolve**.

Fechar, rotular, agrupar, achar, sintetizar, retomar → continua sendo o seeya. **No dia em que ele
iniciar trabalho que ninguém pediu, virou outro produto.** O mantenedor foi explícito: *"meu
objetivo sempre vai ser qualidade de vida no mundo da IA, sem isso o seeya não seria o seeya"* — e
que não pretende competir com aplicações de orquestração de agentes.

## Consequências

**O corte múltiplo ("até daqui a pouco") fica para o v2, com o motivo dele.** A premissa do
produto não tem "dia" dentro: o que ele garante é **o corte**, e "amanhã" é só uma das distâncias
— *"vou almoçar, seeya"* funciona, *"vou almoçar, te vejo amanhã"* não. Mas adiar **não** é por
custo: é porque **o corte múltiplo sozinho não resolve a dor que parece resolver**. Sem
organização das sessões, mais cortes por dia só produzem mais material para se perder dentro. A
organização precisa de tela, e tela é v2.

**Consequência para o v1, e é a única imediata:** `seeya start-day --all` **reconstrói exatamente
a bagunça** — reabre tudo que não foi retomado. Não é defeito de implementação; é o v1 assumindo
que "voltar ao trabalho" significa "voltar a tudo".

**Primeiro passo barato, aprovado como direção e ainda não agendado:** agrupar o briefing **por
projeto**, reusando os repositórios que a D-032 já descobre pelos arquivos tocados. Ataca a metade
de leitura do problema ("estou perdido entre vinte sessões") sem virar GUI nem orquestrador, e
**constrói a base que a tela do v2 vai consumir** — razão pela qual o mantenedor se interessou por
ele agora e não depois.

## O nome já se resolveu sozinho

O pacote é `see-you-tomorrow-ai`; o que se digita, o que aparece na notificação e o que se fala em
voz alta é **`seeya`**. O nome longo é do repositório — o nome do produto é o curto.
