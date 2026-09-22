---
id: TASK-20
title: >-
  V2-T33 — Fundação da D-047, parte 1: o lock do projeto, e commits de um
  projeto só e com dono
status: In Progress
assignee: []
created_date: '2026-09-22 11:11'
labels:
  - fundacao
  - d-047
milestone: m-0
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
priority: high
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T33 — Fundação da D-047, parte 1: o lock do projeto, e commits de um projeto só e com
dono.** Especificada pelo PO em 2026-09-22. Primeira da fila de projetos depois da D-047 — a
adoção (V2-T29) e o desfazer (V2-T32) dependem dela.

**Vocabulário, fixado antes do código** (glossário do `AGENTS.md` na primeira leva): lock do
projeto → um arquivo **dentro do diretório do projeto** (nome fixado no glossário), com o
identificador da sessão, o `pid`, o `procStart` e o instante em que foi tomado; identificador
da sessão no commit → um trailer na mensagem (nome fixado no glossário), mais outro com o
`projectId`.

**O que entra:**
1. **Tomar, conferir e liberar o lock**, por porta. Tomar um lock livre funciona; tomar um lock
   de sessão **viva** recusa, dizendo quem o segura e desde quando; lock de processo **morto** é
   velho e pode ser tomado, com aviso. A vivacidade é a **mesma** checagem do `daemon.lock`
   (pid + `procStart`, `scheduler/daemon-state.ts#checkLiveLock` e companhia) — reusar, não
   reescrever. Liberar lock que não é seu recusa.
2. **O lock nunca é commitado**: entra no `.gitignore` do espaço de trabalho, criado ou
   atualizado pelo próprio seeya.
3. **O commit do seeya passa a tocar um projeto só.** Hoje `WorkspaceRepository.commitAll` faz
   `git add -A` no espaço de trabalho inteiro — se dois projetos tiverem mudança pendente,
   viram um commit, e reverter um desfaz o outro. Passa a adicionar só o diretório do projeto
   da operação, e todo commit do seeya leva os dois trailers. Teste de regressão: com mudança
   pendente em dois projetos, o commit de um não leva o outro.
4. **`seeya project open` toma o lock** ao abrir e **libera ao sair** (o `open` já espera o
   harness terminar, V2-T28). Com o lock de outra sessão viva, o `open` avisa quem o segura e
   abre **para leitura** — a sessão pode trabalhar no código dela, mas é avisada de que não
   escreve no projeto. Registrar o limite: "para leitura" é instrução nesta tarefa; a guarda
   que impede escrever é da V2-T34.
5. **`seeya project show`** passa a dizer se o projeto está com lock, de quem e desde quando.

**O que não entra:** os ganchos de git e do harness, e a auditoria (V2-T34); qualquer
mudança na adoção.

**Cuidados:** o lock é arquivo dentro do espaço de trabalho, escrito de forma atômica como tudo
o mais; `process.platform` só nas raízes de composição; nenhuma dependência nova; testes com
espaço de trabalho descartável e processos de verdade onde a vivacidade precisar ser provada
(o mesmo cuidado dos testes do `daemon.lock`).

**Aceite do mantenedor:** abrir um projeto numa sessão, tentar abrir o mesmo projeto em outra
e ver o aviso de lock com o nome da primeira; fechar a primeira e ver a segunda conseguir.
<!-- SECTION:DESCRIPTION:END -->
