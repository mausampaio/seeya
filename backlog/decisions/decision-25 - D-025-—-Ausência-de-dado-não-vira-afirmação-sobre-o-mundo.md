---
id: decision-25
title: D-025 — Ausência de dado não vira afirmação sobre o mundo
date: '2026-09-24 00:25'
status: accepted
---
## Contexto

Ao classificar o estado de uma sessão viva cuja última escrita no transcript é `null` — porque
não há transcript —, a implementação de S1-T1 retornou **`idle`**, com o argumento de que é a
leitura literal de "sessão viva sem escrita no transcript há mais de `idleMinutes`" no caso
degenerado.

## Decisão

**Está errado, e a resposta correta é `alive`.** O próprio glossário resolve:

- **`alive`** = "sessão cujo processo está em execução agora". É exatamente o que se sabe quando
  o PID está vivo.
- **`idle`** = "sessão **viva** sem escrita no transcript há mais de `idleMinutes`". É um
  **refinamento** de `alive`, e depende de evidência de não-escrita.

Com `null` não há transcript, logo não há como estabelecer "sem escrita há mais de X minutos" —
não há como estabelecer nada sobre escrita. `idle` é uma **afirmação**; `null` é **ausência de
dado**. Converter uma na outra é o erro.

**Por que isso importa mais do que parece.** `null` é precisamente o caso de D-013: transcript
suprimido, que é o agente de execução autônomo. Marcá-lo como `idle` diria "não está fazendo
nada" justamente sobre a sessão com maior probabilidade de estar trabalhando a todo vapor e
invisível. O `seeya sessions` mentiria com confiança, e sobre o caso que mais importa.

## Consequências

- `classifyState` devolve `alive` quando o processo está vivo e `lastTranscriptWrite` é `null`.
  Só devolve `idle` com um timestamp real que já passou do limite.
- Vale como princípio geral do domínio: **nenhuma regra converte "não sei" em afirmação
  positiva.** Quando faltar dado, o resultado é o estado menos específico que a evidência
  sustenta, nunca o mais específico que ela permitiria imaginar.
- Teste obrigatório: sessão viva com `null` é `alive`; sessão viva com timestamp antigo é `idle`.
  Os dois casos, sempre — sem o primeiro, alguém "otimiza" de volta.
