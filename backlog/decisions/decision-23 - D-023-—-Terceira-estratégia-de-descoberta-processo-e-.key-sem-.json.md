---
id: decision-23
title: 'D-023 — Terceira estratégia de descoberta: processo e .key sem .json'
date: '2026-09-24 00:13'
status: superseded
---
> **REVOGADA por D-029 em 2026-08-19.** O fenômeno observado é real, mas a causa que este texto
> atribui — "lançada com prompt como argumento" — **não se confirma**, e o custo da resposta era
> desproporcional ao caso. O texto fica como registro; **não implemente a partir daqui.**
>
> Este documento tem um defeito que vale nomear: ele **não registra a versão** do Claude Code
> sob a qual a medição foi feita, num projeto onde todo spike registra. Foi exatamente essa
> lacuna que quase produziu o erro oposto — ver D-029.

## Contexto

Um agente de execução autônomo, lançado por um script com o prompt como argumento (`claude
--dangerously-skip-permissions "/<comando> --item <N>"`), **não aparece** em `claude agents
--json` nem produz `<pid>.json` em `~/.claude/sessions/` — mesmo estando vivo e trabalhando. As
duas estratégias de D-016 são cegas para ele: sem `.json` para ler, e sem transcript para varrer
(D-013).

Medido cruzando a lista de processos do SO com o conteúdo do diretório de sessões:

| Sessão | `<pid>.json` | `<pid>.<hash>.key` |
|---|---|---|
| interativa comum | sim | às vezes |
| **lançada com prompt como argumento** | **não** | **sim** |

O arquivo `.key` estava lá o tempo todo. Foi descartado antes como "resíduo órfão de limpeza
incompleta" — errado: os `.key` sem `.json` correspondiam, PID a PID, às sessões autônomas
ativas.

## Decisão

`ProvedorDeSessoes` ganha uma terceira estratégia, e ela tem **duas fontes que se confirmam**:

1. **`.key` sem `.json` no diretório de sessões.** Dá o PID pelo nome do arquivo. Barato: uma
   listagem de diretório, sem ler conteúdo. O `.key` é material sensível (modo 600) — o `seeya`
   **lê apenas o nome do arquivo, nunca o conteúdo**.
2. **Enumeração de processos do SO.** Confirma que o PID está vivo e entrega o que o registro não
   tem: a **linha de comando** e o `cwd`.

**A linha de comando é fonte de handoff, não só de identificação.** `/<comando> --item 2990` diz
o que a sessão está fazendo e em qual item de trabalho — informação de primeira ordem para uma
sessão que não tem transcript nenhum.

## Consequências

- Capacidade por plataforma, medida: Linux dá `cwd` por `/proc/<pid>/cwd`; macOS por `lsof`;
  **Windows não dá** `cwd` sem código nativo. Aceitável — no Windows essas sessões produzem
  `.json` normalmente, então a estratégia não é necessária lá.
- Deduplicação (D-016) por **PID** para sessão viva, já que esta origem não fornece `sessionId`.
- Sessão vinda só desta origem entra com `sessionId: null` e nunca é candidata a encerramento de
  processo (D-002).
- O `.key` sem `.json` **não** é sinal de sessão morta: é sinal de sessão que se registra de
  outra forma. Não trate como entrada obsoleta.

**Superseded by D-029** (2026-08-19): a medição que a revogação se apoia e a decisão que
substituiu esta terceira estratégia por um aviso pertencem a D-029, migrada em faixa própria
(V2-T38, D-025 a D-036).
