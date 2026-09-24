---
id: decision-26
title: 'D-026 — Anti-duplicidade compara evidência, não transcript'
date: '2026-09-24 00:25'
status: accepted
---
## Contexto

A condição de anti-duplicidade dizia "não tem handoff do dia corrente com **transcript**
inalterado desde então". O review de S1-T1 mediu a consequência: com transcript ausente nas duas
capturas, `null == null` conta como inalterado, e a sessão fica presa como duplicada pelo resto
do dia — **mesmo que a árvore git tenha mudado**.

O caso atingido é exatamente o do agente de execução autônomo (D-013): sem transcript, com o
trabalho todo em commits e worktree. A condição foi escrita antes de D-013 tornar a evidência
multi-fonte, e nunca foi revista. A implementação de S1-T1 é leitura fiel do texto — o texto é
que estava errado.

## Decisão

A anti-duplicidade compara a **assinatura da evidência**, não o transcript. Se qualquer fonte de
D-013 mudou desde a última captura do dia, a sessão **não** é duplicada.

## Consequências

- A assinatura cobre as fontes de D-013: última atividade do transcript **quando existe**, e o
  estado do git — HEAD, sujeira, commits do dia, worktrees.
- `null` em uma fonte não é "inalterado": é ausência daquela fonte, e o julgamento passa às
  demais (mesmo princípio de D-025 — ausência de dado não vira afirmação).
- O handoff persiste a assinatura para a comparação seguinte. O formato exato é de S2-T3, quando
  houver handoff de verdade; o que S1-T1 precisa é a regra receber a assinatura pronta, não
  calculá-la.
- Teste obrigatório: duas capturas sem transcript, **com git alterado** entre elas, **não** são
  duplicadas. É o caso que motivou a decisão e o que mais dói se voltar.
