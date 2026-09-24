---
id: decision-35
title: D-035 — O que vira config e o que fica constante
date: '2026-09-24 00:29'
status: accepted
---
## Contexto

**Decisão do mantenedor, em 2026-09-05**, ao revisar três números escolhidos sem medição.

**O problema que ela resolve.** O projeto vinha decidindo caso a caso, e as decisões já não
combinavam. A **Q-027** manteve `RESUME_PROMPT_ARG_LIMIT_CHARS` como constante com o argumento "é
limite técnico do SO, não preferência de produto". A **Q-025** manteve `MAX_BRIEFING_SCAN_DAYS`
como constante, rotulado "limite de E/S, não julgamento de produto". Sem um critério escrito, a
próxima pessoa não teria como saber onde pôr o número dela.

## Decisão

**O critério.**

**Constante** quando o número é determinado pelo **sistema operacional, pelo protocolo ou por um
fato técnico** — o teto de linha de comando do Windows (~32.767 unidades), quanto custa subir um
`powershell.exe` frio, o intervalo do laço do daemon. **Ninguém configura o Windows**, e um
número desses mudar significa que a medição mudou, não que a preferência mudou.

**Config** quando depende de **como esta pessoa trabalha ou do que ela topa gastar**. Aí o valor
certo é diferente por pessoa, e nenhuma medição nossa resolve — porque não é sobre o sistema, é
sobre ela.

**O que muda por causa disto** (todos com o valor atual como default, então nada muda de
comportamento):

| número | de | para | por quê |
|---|---|---|---|
| `MAX_GIT_ROOTS_TO_VISIT` (8) | constante | **config** | depende do arranjo de pastas da pessoa |
| limite de retentativa de captura (3) | constante | **config** | depende do quanto ela topa gastar |
| `MAX_BRIEFING_SCAN_DAYS` (30) | constante | **config** | quem volta de um mês fora quer mais |
| limiar de disparo obsoleto (5 min) | constante | **config** | quanta obsolescência ela tolera (D-036) |

**O que NÃO muda**, e agora com o motivo escrito: `RESUME_PROMPT_ARG_LIMIT_CHARS` (teto do
`CreateProcess` do Windows), `FAST_FAILURE_GRACE_MS` (tempo medido de falha rápida do `claude`),
`MAX_ASSISTANT_MESSAGE_CHARS` e `MAX_LAST_PROMPTS` (forma do prompt, não preferência de uso),
`UNDERSTANDING_EXCERPT_CHARS` (largura de terminal), e o intervalo de 30s do laço.

**A inconsistência que isto conserta foi a minha.** O `MAX_BRIEFING_SCAN_DAYS` estava rotulado
como E/S, e pelo critério novo ele é preferência: "quantos dias procurar para trás" é como a
pessoa trabalha, não um fato do disco. Corrigido aqui em vez de deixado para alguém tropeçar
depois.

## Consequências

**Consequência (D-027):** quatro chaves novas em `config.json`. É o custo de tornar o critério
explícito, e ele é pago uma vez — a alternativa é continuar decidindo por caso e acumular
incoerência.
