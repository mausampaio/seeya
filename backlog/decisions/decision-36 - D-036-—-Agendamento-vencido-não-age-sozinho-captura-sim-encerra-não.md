---
id: decision-36
title: 'D-036 — Agendamento vencido não age sozinho: captura sim, encerra não'
date: '2026-09-24 00:29'
status: accepted
---
## Contexto

Título original completo: "Agendamento vencido não age sozinho: captura sim, encerra não, e
virou o dia não faz nada".

**Decisão do mantenedor, em 2026-09-05.** **Emenda a `docs/ESPECIFICACAO.md` § "Comportamento do
daemon"**, que dizia: *"Se a máquina estava suspensa e o horário passou sem disparo, o
encerramento acontece assim que o daemon acorda, com aviso de que houve atraso."*

**O argumento dele, e ele está certo:** *"atrasar uma ação agendada que não se sabe quando
retornará pode ser pior do que não executar nada."*

**Onde o dano mora, e ele não é uniforme.** Capturar tarde é quase inofensivo — a captura
fotografa as sessões como estão, continua sendo um retrato válido, só que de outro momento.
**Encerrar sessão tarde pode destruir trabalho:** com `canTerminate: true`, uma máquina que acorda
às 8h da manhã seguinte faria um agendamento de ontem **matar as sessões abertas hoje de manhã**.
É exatamente a surpresa contra a qual a D-002 foi cautelosa.

**E há um corte que não é número escolhido, é fato:** se o **dia local virou**, a janela acabou.
Disparar depois disso escreveria o encerramento de ontem na pasta de hoje, capturando a manhã
como se fosse o fechamento da noite anterior. Aí não é atraso, é **dado errado**.

## Decisão

**A regra, em três casos:**

1. **Dia local diferente → não dispara, nunca.** Notifica que o encerramento daquele dia não
   aconteceu e precisa ser feito à mão. **Fronteira factual**, sem número arbitrário.
2. **Mesmo dia, atrasado além do limiar → captura, mas NÃO encerra.** O handoff não se perde, e
   nenhuma sessão morre por agendamento vencido. A notificação diz que rodou atrasado e que a
   terminação foi pulada.
3. **Mesmo dia, dentro do limiar → normal.**

**O limiar mudou de significado, e é por isso que ele virou config (D-035).** Antes era "a partir
de quando eu **digo** que atrasou" — texto. Agora é "a partir de quando eu **deixo de agir**" —
comportamento. Um número que governa ação merece ser preferência de quem convive com a
consequência.

**Por que não a versão pura ("nunca disparar atrasado").** Ela é mais simples de explicar, e foi
considerada. Perde o caso barato: máquina que dormiu vinte minutos e acordou às 19h50 mandaria a
pessoa ao terminal por nada. A regra acima entrega o valor onde ele é gratuito e recua onde ele
custa.

## Consequências

**Consequência para o `core/schedule.ts`:** o `endOfDay` continua devolvendo `delayMs` **cru** —
o núcleo segue sem escolher limiar (Q-037 item 3). Quem decide é o daemon, agora lendo o valor da
config em vez de uma constante.

## Emendada

**Emendada pela D-046** (2026-09-20): acima de um teto configurável de atraso dentro do mesmo
dia, o daemon deixa de capturar sozinho também — em vez disso registra um encerramento pendente e
avisa, com um botão para rodar na hora. A regra desta decisão (os três casos acima) continua
valendo **abaixo** desse teto; a D-046 só corta o caso 2 quando o atraso é grande demais.
