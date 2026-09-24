---
id: decision-38
title: 'D-038 — Todo processo do seeya é invisível, salvo a sessão pedida'
date: '2026-09-24 00:41'
status: accepted
---
## Contexto

Título original completo: "Todo processo que o seeya lança é invisível por padrão; a única
exceção é a sessão que a pessoa pediu".

**Decisão do mantenedor, em 2026-09-07**, fechando a **Q-059 item 3** depois que a S4-T6 provou o
custo de não ter regra: *"não queremos janela piscando em nada que o seeya vá chamar, com exceção
das janelas que ele abre no `start-day`"*.

**O que a S4-T6 mediu, e por que isto vira regra e não só conserto.** Nove `spawn` existem em
`src/`. Dois já passavam `windowsHide: true` (`adapters/process/console-signal.ts`) porque alguém
pensou nisso **naquele arquivo** e não generalizou. Os quatro que faltavam produziram, no primeiro
uso real com o daemon, uma janela de console **por sessão viva a cada 30 segundos** e uma **rajada
no encerramento** — cada uma roubando o foco do teclado e cortando o que o mantenedor estava
digitando. **O defeito não foi ignorância da técnica: a técnica já estava no repositório.** Foi não
ter um lugar onde ela valesse para todos.

## Decisão

Processo lançado pelo `seeya` **não aparece**. A exceção é **uma**, e é a sessão interativa do
`seeya start-day` (`adapters/resumption/spawn-interactive.ts`, `stdio: 'inherit'`, docs/spikes/H):
ali a janela **é** o produto — esconder o `claude --resume` esconderia exatamente o que o comando
existe para abrir.

**O padrão inverte o ônus, e é isso que importa.** Hoje quem escreve um `spawn` novo precisa
**lembrar** de esconder; um `spawn` interno único faz o próximo nascer correto por construção, e
transforma a exceção em algo que se **declara no call site**, com o motivo escrito, em vez de algo
que se **esquece em silêncio**.

**O contra-argumento, registrado porque é legítimo:** cada `spawn` de hoje tem `stdio`/`env`/
`signal` diferentes, então o embrulho continua aceitando opções variáveis — o ganho não é menos
código, é **uma chave nunca mais esquecida**. Aceito: o custo do esquecimento já foi medido, e ele
não aparece em teste nenhum (quem roda `vitest` tem console, que é o que esconde o defeito).

## Consequências

A proibição vira **guarda executável**, do mesmo jeito que o `new Date()` fora de
`adapters/clock/` (D-019) e a matriz de camadas (D-020) — importar `spawn` de
`node:child_process` direto passa a ser erro de lint fora do embrulho e da exceção declarada.
Regra que depende de memória humana já falhou uma vez aqui.
