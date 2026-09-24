---
id: decision-46
title: 'D-046 — Encerramento muito vencido vira pendência, não roda sozinho'
date: '2026-09-24 00:49'
status: accepted
---
## Contexto

Título original completo: "Encerramento muito vencido não roda sozinho: acima de um teto, vira
pendência com botão".

**Decisão do mantenedor, em 2026-09-20**, a partir de um caso observado por ele na mesma manhã.
**Emenda a D-036**, que continua valendo abaixo do teto.

**O que a motivou.** Depois de reinstalar o app e aceitar que ele assumisse o daemon, o daemon
subiu às 10:43 com o horário de encerramento marcado para 10:00. Pela D-036, "vencido no mesmo
dia" ainda captura tudo (só não encerra sessão), então o seeya rodou a captura do dia inteiro na
hora, sem que ninguém pedisse. O mantenedor observou o efeito e escolheu o teto: *"pôr um teto e
perguntar"*.

**O raciocínio.** A captura custa dinheiro e acontece uma vez por dia; disparar sozinha depois de
um atraso grande junta as duas coisas que a pessoa menos espera — gasto e ação automática num
momento arbitrário, que é quando ela ligou a máquina, não quando o dia acabou. Abaixo de um atraso
pequeno, o comportamento de hoje é o certo: quem fecha o dia às 19:30 e liga o daemon às 19:40
quer a captura. A diferença entre os dois casos é só o tamanho do atraso, e por isso a decisão é
um número, não um modo novo.

## Decisão

**A regra.**
1. **Até o teto:** exatamente como a D-036 já manda — captura tudo, não encerra sessão nenhuma, e
   a notificação diz que saiu atrasada.
2. **Acima do teto:** o daemon **não captura**. Ele registra que há um encerramento pendente e
   avisa; a janela mostra esse estado com o botão de rodar agora (o mesmo "End day…" que já
   existe, que já mostra a prévia antes de gastar qualquer coisa).
3. **Ninguém age pela pessoa depois disso.** Se ela não clicar, o dia passa sem captura — e o
   estado pendente não atravessa o dia, porque um encerramento de ontem rodado hoje capturaria o
   trabalho errado (é a mesma razão pela qual a D-036 já não faz nada depois de virar o dia).
4. **O teto é configurável**, com um padrão conservador, e a chave entra no glossário antes do
   código (D-027).

## Consequências

**O que não muda:** o `seeya end-day` pedido à mão nunca consulta teto nenhum — quem digitou o
comando já decidiu; os avisos prévios seguem como estão; o formato do handoff não muda.

**Quando isto vira código (mantenedor, no mesmo dia).** Não vira tarefa própria: *"não é tão
grave... ela muda completamente com o comportamento de projetos"*. A regra fica registrada aqui e
é **absorvida pela tarefa que introduz `checkpoint`, `pause` e o `end-day` global**
(`docs/V2-RUMO.md`, passos 5 e 6), que redesenha justamente quem dispara o quê e quando. Registrar
agora, implementar junto do resto: decidir cedo é barato, implementar duas vezes não.
