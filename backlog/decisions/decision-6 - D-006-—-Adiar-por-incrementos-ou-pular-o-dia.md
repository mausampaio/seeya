---
id: decision-6
title: 'D-006 — Adiar por incrementos, ou pular o dia'
date: '2026-09-23 10:53'
status: accepted
---
## Contexto

## Decisão

Quando a notificação de encerramento dispara, o usuário pode:
- **adiar** por um incremento (+15min, +30min, +1h);
- **pular hoje**, o que desliga o encerramento automático até o próximo dia;
- deixar passar, e o encerramento acontece.

## Consequências

O estado de adiamento é persistido em `estado.json` e é por dia. Reiniciar o
daemon não zera adiamentos já feitos. Não há limite de adiamentos — "pular hoje" é a válvula
de escape explícita, então forçar um teto seria redundante.

## Emenda — 2026-09-24, decisão do mantenedor

Achado no uso real: com um adiamento de +1h feito, ele mudou o horário de encerramento na
configuração, e **qualquer** horário novo continuava empurrado 1h para frente — sem nenhum jeito de
desfazer o adiamento. Duas regras novas:

1. **O adiamento pode ser desfeito, enquanto ainda faz sentido.** Desfazer volta o encerramento de
   hoje ao horário configurado. Só é possível **antes** do horário configurado (sem o adiamento):
   depois dele, desfazer significaria um encerramento já vencido, e a opção deixa de ser oferecida.
2. **Mudar o horário de encerramento zera o adiamento do dia.** O horário novo é o que a pessoa quer
   agora; um adiamento feito sobre o horário antigo não se aplica a ele.

"Pular hoje" não muda com esta emenda. A consequência original continua valendo para o resto:
reiniciar o daemon não zera adiamento; só as duas ações acima zeram.
