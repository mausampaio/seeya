---
id: decision-15
title: 'D-015 — Contexto vai por stdin ou arquivo, nunca por argumento'
date: '2026-09-24 00:08'
status: accepted
---
## Contexto

No Spike C o contexto multilinha foi passado como argumento de linha de comando e chegou
mutilado ao modelo — o PowerShell quebrou a string e o modelo recebeu uma palavra solta.

## Decisão

Todo texto de tamanho variável enviado ao `claude` vai por **stdin** ou por arquivo temporário.
Argumento de linha de comando só para flags e valores curtos e conhecidos.

## Consequências

Vale junto com a regra já existente de `spawn` com array e `shell: false`.

> **CORREÇÃO (2026-08-30, medida na S3-T2).** Esta decisão generalizou de uma causa específica
> para uma proibição ampla, e a generalização não se sustenta. **O que mutilou o texto no Spike C
> foi o shell, não o argumento.** Medido com o `claude` real (2.1.235): passando por
> `spawn(bin, [...args, texto], { shell: false })`, um prompt com quebra de linha, aspas dos dois
> tipos, `%` e acento volta **byte a byte idêntico**. Cerca de 19 KB no argumento também passam.
>
> A regra continua valendo, e agora com o limite certo: **texto de tamanho variável não vai por
> argumento quando a invocação puder alcançar um shell, e não vai quando puder ser grande** — o
> Windows corta a linha de comando perto de 32.767 caracteres, e estourar isso falha de forma
> feia. Onde o projeto já usa stdin ou arquivo, continua usando: é mais seguro e não custa nada.
>
> **O caso que forçou a revisão** é a retomada interativa (D-004). Medido: sem TTY real, o
> `claude --resume` **não abre sessão interativa** — detecta a ausência de terminal, responde uma
> vez em texto puro e sai. Para haver sessão interativa de verdade, o processo precisa herdar um
> TTY real; e a partir do momento em que o stdin **é** o terminal do usuário, ele é o teclado, e
> não há como o `seeya` escrever nele por fora. O argumento posicional é o único canal que resta.
>
> Não é exceção à regra: é a regra dita com precisão. Ver Spike H.

Tem teste de integração dedicado, com conteúdo contendo quebra de linha, aspas, acento e `%`.
