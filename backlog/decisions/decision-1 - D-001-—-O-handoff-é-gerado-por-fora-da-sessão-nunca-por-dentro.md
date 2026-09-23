---
id: decision-1
title: 'D-001 — O handoff é gerado por fora da sessão, nunca por dentro'
date: '2026-09-23 10:52'
status: accepted
---
## Contexto

A ideia original era "enviar um comando para a sessão interromper e guardar
tudo". Escrever no TTY de outro processo não é viável nos três SOs.

> **CORREÇÃO (2026-08-30, observado).** Este parágrafo afirmava também que "não há IPC, não há
> socket de controle". **Isso não é mais verdade.** O registro de uma sessão viva traz
> `messagingSocketPath` (no Windows, um named pipe `\.pipecc-msg-<hex>`),
> `bridgeSessionId` e `peerProtocol`; o ambiente dos processos filhos traz
> `CLAUDE_CODE_MESSAGING_SOCKET` e `CLAUDE_CODE_MESSAGING_TOKEN`. Observado no registro real,
> **não sondado** — mandar mensagem malformada para o pipe de uma sessão viva é risco sem
> retorno.
>
> Pelo que dá para ler, é a **malha interna de mensagens entre agentes** do Claude Code, não um
> canal de controle geral, e é protegida por um token que vive no ambiente herdado — exatamente
> a categoria de variável que a **D-017** existe para remover. Usá-lo seria o `seeya` se passar
> por processo filho de uma sessão, contra uma decisão que já tomamos.
>
> **A decisão continua valendo, pelos motivos que sobrevivem à correção**, e eles são de
> produto, não de impossibilidade: gerar por dentro gastaria o contexto da própria sessão —
> justamente a mais escassa no fim do dia, que é quando o handoff importa — e interromperia o
> turno dela. Ver **D-031**, que redefine o escopo e mantém "por fora" como o único mecanismo.

## Decisão

O `see-you-tomorrow` nunca fala com a sessão viva. Ele lê o transcript da sessão
em disco e gera o handoff em um **processo headless separado**
(`claude -p --resume <sessionId> --fork-session`), que enxerga a conversa inteira.

## Consequências

- Funciona mesmo para sessões que já morreram.
- Não consome o contexto nem interrompe o turno da sessão viva.
- `--fork-session` é obrigatório: garante que a captura não escreva no transcript original.
- O verbo "encerrar" no produto significa **capturar e avisar**, não **matar**, exceto onde
  D-002 permitir.
