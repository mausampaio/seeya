---
id: decision-24
title: 'D-024 — Schema é fiel, domínio torna inválido irrepresentável'
date: '2026-09-24 00:13'
status: accepted
---
## Contexto

O review de S1-T0c provou que `pid` opcional protege apenas por comentário: `item.pid!` compila
sem erro. Nada no tipo impede alguém escrever `terminarProcesso(item.pid!)`. A sugestão foi
transformar o item numa união discriminada dentro do schema.

## Decisão

As duas responsabilidades ficam em camadas diferentes, e é isso que resolve:

| | Responsabilidade | Consequência |
|---|---|---|
| **Schema** (`adapters/`) | reproduzir a realidade com **fidelidade** | se existe variante sem `pid`, ele aceita. Apertar aqui seria mentir sobre o mundo. |
| **Tipo de domínio** (`core/`) | tornar estado inválido **irrepresentável** | `pid` não é campo opcional de um tipo só; são **duas formas distintas** de sessão. |

O tipo de domínio de sessão descoberta é uma **união discriminada**: uma forma que carrega `pid`
garantido e outra que não tem PID nenhum. A política de encerramento (D-002) só aceita a
primeira, e o compilador recusa a segunda — sem `!`, sem `as`, sem depender de ninguém ler
comentário.

## Consequências

- Vira requisito de **S1-T1**, que define os tipos de `core/`. Não é correção de schema.
- O adapter de descoberta converte da forma do schema para a forma de domínio, e é ali que a
  decisão "tem PID ou não" acontece **uma vez**, em vez de em cada chamador.
- Regra geral: `!` e `as` em código de produção são sinal de que o tipo está errado, não de que o
  autor sabe mais que o compilador.

## Um achado que foi recusado, para não ser "corrigido" depois

O review notou que um item com `sessionId` + `cwd` + `startedAt`, mas **sem `pid` e sem `id`**, é
aceito. Isso é correto e deliberado. Por D-021, identidade é `sessionId` e `cwd`; `pid` é
liveness. Um item assim é uma sessão **identificável e capturável**, só não encerrável —
exatamente o caso que D-021 existe para não perder. Exigir `pid` ou `id` reintroduziria o bug que
D-021 corrigiu.
