---
id: TASK-26
title: V2-T35 — Aviso de lock legível e sessão com id conhecido
status: To Do
assignee: []
created_date: '2026-09-23 10:12'
updated_date: '2026-09-23 10:46'
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
