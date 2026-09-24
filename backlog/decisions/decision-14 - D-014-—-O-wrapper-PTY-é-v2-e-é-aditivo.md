---
id: decision-14
title: 'D-014 — O wrapper PTY é v2, e é aditivo'
date: '2026-09-24 00:08'
status: accepted
---
## Contexto

A v1 descobre sessões lendo o registro e o transcript do Claude Code — nunca fala com a sessão
viva. A ideia recorrente do outro caminho era subir o próprio harness dentro de um PTY controlado
pelo `seeya` (`seeya claude`): com o processo na mão, daria para pedir o handoff à própria sessão,
em vez de reconstruí-lo por fora. A pergunta que esta decisão fechou não era "vale a pena", e sim
"isso substitui a descoberta?".

## Decisão

O `seeya claude` — subir o Claude dentro de um PTY controlado pelo `seeya`, para poder pedir o
handoff à própria sessão — fica para a v2. Quando chegar, **coexiste** com a descoberta: será o
modo recomendado de abrir sessão, mas a descoberta continua funcionando para tudo que for aberto
sem ele. Nada passa despercebido por não ter usado o wrapper.

## Consequências

- A descoberta é o piso permanente da arquitetura, nunca substituída pelo wrapper.
- `ProvedorDeSessoes` precisa suportar duas origens simultâneas sem duplicar sessão: uma sessão
  aberta via wrapper aparece **uma vez**, não duas.
- É o caminho para harnesses sem transcript legível (codex e afins), conforme D-009.
- Riscos conhecidos, a tratar quando for a hora: `node-pty` é dependência nativa; o passthrough
  precisa ser impecável (resize, raw mode, alt screen, Ctrl+C); injetar texto com um diálogo de
  permissão aberto responde o diálogo. O wrapper pede o handoff **em arquivo**, nunca lê a tela.

## Emenda — 2026-09-24, achado 2 da revisão da V2-T39

A v2 chegou. Esta seção diz o que se realizou, o que foi abandonado e o que ocupou o lugar, para
que ninguém leia a decisão acima como um plano ainda pendente.

**O que se realizou, por outro caminho.** O PTY existe, mas como as **abas embutidas da janela**
(`packages/app/src/pty/`, V2-T2/V2-T3, D-042/D-043), não como um comando `seeya claude` — que nunca
foi criado e não está na fila. O miolo aditivo desta decisão continua verdadeiro e é o que se
observa em produção: **a descoberta é a única fonte**, e uma sessão aberta numa aba aparece uma vez
só porque a aba é casada com a sessão descoberta **pelo pid** (`sidebar/session-match.ts`). A união
de duas origens dentro do `SessionProvider`, prevista na segunda consequência, nunca precisou
existir — a deduplicação mora na interface, não no adapter.

**O que foi abandonado.** Pedir o handoff à sessão viva, injetando texto no PTY. Não por
impossibilidade técnica: a **D-001, emendada pela D-031**, já tinha fechado "falar com a sessão
viva" pelo custo de contexto, e a captura continua lendo o transcript e rodando `claude -p` por
fora. Este pedaço da decisão ficou órfão por dezoito meses de trabalho sem que ninguém o marcasse —
o achado que originou esta emenda. Não existe, e não deve passar a existir, nenhum `requestHandoff`
no repositório.

**O que ocupou o lugar da necessidade.** A necessidade real por trás do wrapper — fazer a sessão
registrar o que sabe **antes** de perder o contexto — é atacada hoje pela família de ganchos por
harness (V2-T40, com o spike V2-T41), que usa o mecanismo que o próprio harness oferece em vez de
digitar na sessão de alguém. Se aquele caminho se mostrar fechado, a pergunta volta como decisão
nova, não como retomada desta.

**O que continua valendo sem ressalva:** a primeira consequência ("a descoberta é o piso
permanente") e a terceira (harnesses sem transcript legível, D-009). É por isso que esta decisão foi
emendada e não marcada como superada.
