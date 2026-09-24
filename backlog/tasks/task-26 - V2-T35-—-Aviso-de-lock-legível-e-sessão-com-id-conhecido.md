---
id: TASK-26
title: V2-T35 — Aviso de lock legível e sessão com id conhecido
status: Review
assignee: []
created_date: '2026-09-23 10:12'
updated_date: '2026-09-24 19:01'
labels:
  - correcao
  - d-047
milestone: m-0
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
priority: medium
type: bug
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T35 — Correção: o aviso de lock aparece e some, e a sessão que abre não fica sabendo dele.**
Especificada pelo PO em 2026-09-23, a partir do aceite da V2-T33 pelo mantenedor no mesmo dia.

**O que ele viu.** Abrindo um projeto já travado por outra sessão, a mensagem sai certa:

```
Project "teste-projeto" is locked by an unidentified session (pid 20540) since
2026-09-23T10:10:39.452Z — opening for reading only. Work in your own code, but changes to this
project itself will not be recorded here until that session releases the lock.
```

Só que **o harness assume a tela logo em seguida e a mensagem some** — nas palavras dele, "o claude
abre por cima, não tem como ver". Na prática, o aviso mais importante do fluxo é o único que
ninguém lê. E há um segundo furo, pior: **a sessão que acabou de abrir não sabe do lock** — quem
precisa não escrever no projeto é justamente ela.

**O que entra:**

1. **Com o projeto travado, o `open` para e espera.** Mostra o aviso e pede uma confirmação
   explícita antes de lançar o harness (seguir para leitura, ou cancelar). Com o lock livre, nada
   muda: abre direto, sem pergunta.
2. **A sessão é avisada junto.** O texto do lock entra no contexto da sessão pela forma documentada
   do harness — **medir qual é**, com sessão descartável, antes de escolher (`--append-system-prompt`
   é a candidata; a Q-069 já mediu a irmã dela por arquivo). Sem uma forma medida, item registrado
   como não entregue, nunca improvisado. Isso é instrução, não garantia: a guarda que impede
   escrever continua sendo a da V2-T34.
3. **Ao sair, o `open` repete o que a pessoa não conseguiu ler e diz como ficou**: o aviso que
   precedeu a abertura (travado por outra sessão, ou lock velho retomado — o mantenedor não
   conseguiu ler nenhum dos dois, 2026-09-23) e o estado final: lock liberado, ainda com o outro, ou
   agora com esta sessão. É a informação que a pessoa perdeu na abertura, dita quando ela volta a
   ter tela.

4. **O `open` escolhe o id da sessão que lança** (acrescentado pelo PO em 2026-09-24, fechando o que
   a Q-087 deixou aberto). Hoje o identificador vem de `CLAUDE_CODE_SESSION_ID`, que só existe quando
   o `seeya` roda **dentro** de uma sessão — rodando `seeya project open` de um terminal comum (o uso
   normal), o lock fica "travado por uma sessão não identificada" e os commits saem com
   `Seeya-Session-Id: unknown`. Como é o próprio `open` que lança o harness, ele gera um id novo e
   passa `claude --session-id <id>` — flag medida no spike J (`docs/spikes/J-cache-na-captura.md`,
   que prova que ela funciona também na **criação** de uma sessão nova) e já usada pelo gerador
   profundo (`adapters/generation/args.ts`), mas só no modo `-p`: **confirmar com sessão descartável
   que ela vale igual no modo interativo** antes de depender dela. É **esse** id que vai para o `.seeya-lock`. Vale sempre, inclusive quando o `open` roda de
   dentro de outra sessão: o dono do lock é a sessão que o `open` abriu, nunca a que o chamou.
   - Gerar o id é aleatoriedade: fica fora de `core/`, entra pela raiz de composição ou por uma porta.
   - O ambiente do `claude` lançado continua sem as variáveis de sessão herdadas (D-017).
   - A linha do glossário "identidade da sessão que segura o lock/commita" no `AGENTS.md` passa a
     dizer as duas fontes: o id gerado pelo `open`, e `CLAUDE_CODE_SESSION_ID` para os outros
     comandos.
   - Teste: o id que vai para `--session-id` é o mesmo gravado no lock.

**O que não entra:** impedir a escrita (V2-T34); mudar o formato do lock; qualquer coisa na janela
(a V2-T30 refaz isso em aba).

**Cuidados:** a confirmação lê do terminal como os fluxos de pergunta que a CLI já tem (start-day),
nunca um `readline` novo; sem confirmação disponível (entrada não interativa), o `open` **recusa**
com uma linha dizendo o porquê, em vez de abrir sem que ninguém tenha lido o aviso; nenhum agente
abre o `claude` real contra um projeto do mantenedor.

**Aceite do mantenedor:** repetir o teste dos dois terminais e conseguir **ler** o aviso antes de o
harness assumir a tela; e, dentro da sessão aberta, perguntar ao agente se o projeto está travado e
ele saber responder; e o `.seeya-lock`, enquanto a sessão está aberta, trazer o id dela.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Relatório do agente (branch `tarefa/V2-T35-aviso-de-lock-e-id`, worktree isolada, a partir da
`main`).** Os quatro itens, nesta ordem:

1. **`open` pausa e pergunta quando o lock está travado.** `application/project-open.ts#openProject`
   ganhou `OpenProjectCallbacks.confirmReadOnlyOpen` (`ConfirmReadOnlyOpen`, três respostas nunca
   achatadas — `proceed`/`decline`/`unavailable`, D-024), perguntado só quando `lock.kind ===
   'readOnly'` — lock livre ou reclamado (processo morto) continua abrindo direto, sem pergunta,
   exatamente como antes. Extraído em `blockedByLock` para `openProject` continuar reto (AGENTS.md §
   "Retorno cedo"). Sem confirmador (`undefined`), o resultado é `'unavailable'` — nunca um "sim"
   silencioso (D-025). `cli/project-command.ts#makeReadOnlyOpenConfirmer` implementa por
   `node:readline/promises`, mesmo padrão de `start-day-command.ts#makeFallbackConfirmer`, mas SEM
   resposta padrão quando `!io.isTTY`: resolve `'unavailable'` e `open` recusa dizendo o porquê
   (`OpenProjectResult`'s own `lockConfirmationUnavailable`, exit 1) — um "não" explícito vira
   `lockConfirmationDeclined` (exit 0, escolha deliberada, não falha).
2. **A sessão é avisada junto.** O MESMO texto que o terminal mostra
   (`core/project-lock-message.ts#formatProjectLockWarningLines`, movido de `cli/` para `core/`
   nesta tarefa — pure, sem I/O, para servir aos dois lados sem violar a matriz de camadas) vira
   `--append-system-prompt <texto>` do `claude` lançado, só quando há algo para avisar (`null`
   quando o lock está livre). Medido: **flag confirmada entregando a uma sessão FRESCA** (nunca
   `--resume`, cujo "não entrega" é especificamente o achado da Q-069) — ver item de medição abaixo,
   Q-089.
3. **Ao sair, `open` repete o aviso e diz o estado final do lock.**
   `OpenProjectResult`'s own `opened.finalLockStatus` (`ProjectLockStatus`, lido de novo por
   `describeProjectLockStatus` DEPOIS do harness fechar e da liberação — nunca o snapshot
   pré-lançamento repetido como se ainda valesse). `cli/format-project.ts#formatOpenedReport` repete
   as mesmas linhas de `formatProjectLockWarningLines` e acrescenta a linha `lock: ...` (reusando
   `formatLockStatusLine`, já usado por `project show`).
4. **`open` gera e usa o id da sessão que lança.** `packages/cli/src/composition.ts
   #buildProjectOpenDeps` gera `launchedSessionId` com `node:crypto#randomUUID()` — aleatoriedade
   fora de `core/`/`application/`, na raiz de composição, como a tarefa pediu. Esse id vai para
   `claude --session-id <id>` (`adapters/harness/args.ts#buildOpenArgs`, `--session-id`/
   `--append-system-prompt` sempre ANTES de `--add-dir`, para nunca ficarem adjacentes à lista
   variádica que a spike N já flagrou) e é o MESMO id gravado no `.seeya-lock`
   (`acquireOpenLock` agora usa `deps.launchedSessionId`, nunca mais `deps.sessionId`/
   `CLAUDE_CODE_SESSION_ID` do chamador) — vale sempre, inclusive quando `open` roda de dentro de
   outra sessão: o dono do lock é a sessão que `open` abriu, nunca a que chamou. Teste
   (`tests/unit/application/project-open.test.ts`) confere que o id passado a
   `harnessLauncher.open` é exatamente o gravado no lock. `deps.sessionId`/`CLAUDE_CODE_SESSION_ID`
   continua existindo em `ProjectOpenDeps`, mas só para as outras subcomandas de `project` (create/
   add-repo, trailers de commit) — `open` não o usa mais para nada.
   Glossário do `AGENTS.md` atualizado: "identidade da sessão que segura o lock/commita" agora diz
   as duas fontes.

**Ambiente do `claude` lançado continua limpo (D-017)** — nada mudou em
`adapters/resumption/env.ts#buildResumptionEnv`, já reusado por `ClaudeHarnessLauncher`.

**Medição do item 2 e confirmação do item 4 (Q-089).** Sem terminal de verdade neste agente
(`winpty` confirmou: recusa com `stdin is not a tty` — a ferramenta de execução do agente não tem
console real por trás), a confirmação em modo interativo GENUÍNO fica para o aceite do mantenedor,
como o despacho já previa ("não improvise: registre como não verificado"). O que foi medido em vez
disso, com duas sessões descartáveis reais (não `-p`, o comando default do `claude`, mesma família
que `open` invoca, com stdin pipeado — degrada sem TTY, Spike H já documentou isso, mas ainda é o
binário real): `--session-id` produziu um `.jsonl` com exatamente o id pedido; `--append-system-prompt`
entregou o texto exato ao contexto do modelo. Registrado com detalhe em Q-089 (`docs/QUESTOES.md`).
`--session-id` em criação de sessão nova já tinha confirmação prévia, em `-p`, no Spike J;
`--append-system-prompt`/`-file` entregando a uma sessão FRESCA (nunca `--resume`) já tinha
confirmação prévia, em `-p`, na Q-069.

**Refatoração de apoio, sem mudança de comportamento:** `ProjectOpenLockOutcome` movido de
`application/project-open.ts` para `core/project-lock.ts` (re-exportado, mesmo caminho de import
para quem já usava) — necessário para `core/project-lock-message.ts` descrever o tipo sem
`application/`/`cli/` se importarem mutuamente (a matriz proíbe as duas direções).

**Portão:** `npm run verificar` passou inteiro (código de saída 0) — `format:check`, `tsc --noEmit`,
`eslint`, `build`, `dependencias` (412 módulos, 0 violação), `cobertura` (227 arquivos de teste,
2351 testes, 4 pulados; `core/` 99.51%, `application/` 100%, `adapters/harness/` 100%, `cli/src`
96.72% — todos acima do próprio piso).

**Não verificado nesta tarefa (fica para o aceite):** confirmação de `--session-id`/
`--append-system-prompt` numa sessão interativa GENUÍNA (TUI real, `stdio: 'inherit'` herdando um
terminal de verdade) — ver Q-089. O aceite do mantenedor (dois terminais + perguntar ao agente se o
projeto está travado + conferir que `.seeya-lock` traz o id da sessão) cobre exatamente isso.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-24 19:01
---
Revisão do PO em 2026-09-24: mesclado no po-gate, portão verde (2351 testes). Conferido: o claude é lançado com shell:false (as aspas do texto do lock chegam intactas pelo --append-system-prompt); o id é gerado na raiz de composição (randomUUID), passado por --session-id antes dos --add-dir e é o mesmo gravado no lock; o texto do aviso subiu para core/project-lock-message.ts (puro) porque CLI e aplicação precisam da mesma frase. Não verificado em TTY real (o agente não tinha console — Q-089); provado com o binário real sem TTY e com as medições anteriores (spike J, Q-069). Fica para o aceite do mantenedor, que precisa de um build novo: dois terminais, ler o aviso e confirmar, perguntar à sessão se o projeto está travado, e o .seeya-lock trazer o id dela.
---
<!-- COMMENTS:END -->
