---
id: decision-22
title: 'D-022 — Lista de fonte externa valida item por item, nunca em bloco'
date: '2026-09-24 00:12'
status: accepted
---
## Contexto

`agentsJsonOutputSchema` era `z.array(item)`. Testado contra a saída real de uma segunda
máquina, Linux, **rejeitou o array inteiro** por causa de uma única entrada: uma sessão `kind:
"background"` que não tem `pid` (tem `id`) e usa `state` em vez de `status`. Uma sessão de
background e o `seeya` perderia a fonte de descoberta completa.

Isso contradizia o próprio `CLAUDE.md`: "arquivo externo corrompido ou com campo desconhecido:
registre e siga em frente. Nunca derrube o comando inteiro por causa de uma entrada ruim". A
regra existia; o schema não a cumpria, porque `z.array` é tudo-ou-nada.

## Decisão

Toda coleção que vem de fonte externa é validada **por item**. Itens válidos entram, itens
inválidos são registrados e descartados individualmente, e a operação segue. Vale para:

- a saída de `claude agents --json`
- os arquivos de `~/.claude/sessions/*.json`
- as entradas do `.jsonl` de transcript
- os handoffs lidos de `~/.seeya/`

## Consequências

- O tipo de retorno declara os dois lados: os itens aceitos **e** os rejeitados com o motivo,
  para que o `seeya sessions` possa dizer "3 sessões, 1 entrada ignorada" em vez de mentir por
  omissão.
- `agentsJsonItemSchema` ganha `pid` opcional e aceita a variante de background (`id`, `state`).
  Item sem `pid` nunca é candidato a encerramento de processo, igual à sessão vinda só da
  varredura (D-016).
- Teste obrigatório: um array com uma entrada boa e uma inválida devolve a boa e reporta a outra.
  Sem esse teste, alguém "simplifica" de volta para `z.array` e o furo volta.
