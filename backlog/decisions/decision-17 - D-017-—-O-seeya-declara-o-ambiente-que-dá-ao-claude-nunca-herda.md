---
id: decision-17
title: 'D-017 — O seeya declara o ambiente que dá ao claude, nunca herda'
date: '2026-09-24 00:10'
status: accepted
---
## Contexto

O Spike D mostrou que `CLAUDE_CODE_CHILD_SESSION` é herdado por todo processo filho e suprime o
transcript na 2.1.233. O `seeya` spawna `claude` para gerar handoffs, e o daemon muito
provavelmente será iniciado de dentro de uma sessão Claude — o projeto é desenvolvido assim. Sem
tratamento, o `seeya` contamina as próprias invocações com estado ambiental que ele não escolheu.

## Decisão

Ao spawnar `claude`, o `seeya` monta o ambiente **explicitamente**, partindo do ambiente do
sistema e **removendo** as variáveis de sessão herdadas: `CLAUDE_CODE_CHILD_SESSION`,
`CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_PID`, `CLAUDECODE`,
`CLAUDE_AGENT_SDK_VERSION`. Depois define o que precisa, por modo:

| Modo | Persistência desejada | Como |
|---|---|---|
| Enxuto (padrão) | **nenhuma** — a sessão é descartável | `--no-session-persistence` |
| Profundo | **sim** — o fork precisa existir | `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` |

## Consequências

- **Simplifica D-012**: no modo enxuto, que é o padrão, nenhum fork ou transcript é criado.
  O registro e a limpeza de forks passam a valer só para o modo profundo.
- Sem isso, o modo profundo falharia silenciosamente quando o daemon fosse iniciado de dentro de
  uma sessão Claude — o fork não seria criado e `--resume` não acharia nada.
- Teste de integração dedicado: verificar o `env` entregue ao processo filho em cada modo.
