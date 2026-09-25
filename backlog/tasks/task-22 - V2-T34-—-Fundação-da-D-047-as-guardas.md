---
id: TASK-22
title: 'V2-T34 — Fundação da D-047: as guardas'
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels:
  - fundacao
  - d-047
milestone: m-0
dependencies:
  - TASK-20
  - TASK-26
references:
  - docs/PLANO-DE-ENTREGA.md
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T34 — Fundação da D-047, parte 2: as guardas, e as regras de trabalho do projeto.**
Especificada pelo PO em 2026-09-22; **revisada em 2026-09-25** a partir de um teste proposital do
mantenedor: abriu um projeto, pediu à sessão para organizar tarefas, ela escreveu em `plans/`,
**perguntou se podia commitar**, e ele fechou a aba no X. Sobraram três arquivos sem commit, e a
próxima sessão não saberia de onde vieram. Duas lições: (a) a sessão **não sabia** que pode e deve
commitar — o `AGENTS.md` do projeto não diz nada sobre como trabalhar ali; (b) sem as guardas, o
commit que ela faria sairia sem dono. **Depende da V2-T33 e da V2-T35** (a Q-087 já foi fechada pela
V2-T35: o `open` gera o id da sessão e o grava no lock).

**O que a D-047 diz, e que esta tarefa torna verdade:** item 4 — **quem segura o lock commita**, a
própria sessão, no caminho, com as mensagens dela (não um commitão do seeya no fim — foi o receio do
mantenedor, e a decisão já o evita); item 5 — o que precisa valer sempre é garantido por código.

**O que entra:**

1. **Ganchos de git no repositório do espaço de trabalho**, instalados pelo seeya ao criar o espaço
   de trabalho e **reafirmados a cada `open`** (um gancho apagado volta sozinho):
   - **acrescentam** os trailers `Seeya-Project-Id`/`Seeya-Session-Id` quando o commit não os traz
     (revisão de 2026-09-25: menos atrito que recusar — o projeto sai do caminho dos arquivos, a
     sessão sai de `CLAUDE_CODE_SESSION_ID` ou, sem ela, do lock; sem nenhuma das duas, `unknown`,
     D-025). Trailer que já vem escrito e **contradiz** o que o gancho sabe é recusado;
   - **recusam**, cada um com a mensagem dizendo o que faltou e como deveria ser: commit que toca
     mais de um projeto; commit que inclua o arquivo de lock; commit num projeto cujo lock está com
     **outra** sessão viva. Commit feito à mão pela pessoa, sem sessão no ambiente e com o lock
     livre, passa — com sessão `unknown`;
   - **não dependem de o `seeya` estar no `PATH`**: chamam a verificação do próprio seeya pelo
     caminho absoluto gravado ao instalar — **medir** nos três sistemas; no Windows os ganchos rodam
     no shell que vem com o git.
2. **Gancho do harness no diretório do projeto**, onde o harness permitir: no Claude Code, as
   configurações de projeto dentro do diretório do projeto (que é do seeya — **nunca** `~/.claude`),
   recusando os comandos que furam os ganchos de git (`--no-verify`, trocar o diretório de ganchos).
   **Medir primeiro** se valem para uma sessão que só enxerga o projeto por `--add-dir` (a adoção);
   se não valerem, registrar que a segunda camada não protege a adoção.
3. **A auditoria**: `seeya project audit <id>` confere o histórico desde a última auditoria contra
   as mesmas regras e mostra o que escapou. Chamada também pelo `open`, antes de tomar o lock.
4. **Sobra de sessão anterior, no próximo `open`** (novo, do teste do mantenedor). Se o projeto
   tem mudança não commitada, o `open` mostra os arquivos e pergunta **antes** de lançar: **commitar
   agora** (sessão `unknown` — não dá para afirmar de quem foi, D-025) ou **seguir sem commitar** (a
   sessão nova recebe, junto das regras e do aviso do lock, a lista do que está pendente). **Nunca
   descarta sozinho.** Sem terminal interativo, recusa dizendo o porquê, como o aviso do lock. Na
   janela, o mesmo num diálogo.
5. **As regras de trabalho entregues à sessão** (novo). Um texto curto, **no código do seeya**
   (num lugar só, compartilhado CLI↔janela), entregue a cada `open` pelo `--append-system-prompt`
   (o mesmo canal do aviso do lock, V2-T35) — e não só no `AGENTS.md` do projeto, porque esse é o
   arquivo que as próprias sessões reescrevem (a adoção reescreveu o do projeto de teste inteiro).
   Diz, no mínimo: em que projeto ela está, pelo **id**; que ela **commita no caminho**, em commits
   pequenos com mensagem que explique o porquê, sem perguntar; que os trailers são acrescentados
   sozinhos (não escrevê-los à mão); um projeto por commit; nunca commitar o arquivo de lock; editar
   os arquivos canônicos **no momento em que decide** (D-047 item 1) e usar o `journal/` como
   rascunho; segredo por caminho, nunca por valor. **Limite conhecido:** a Q-069 mediu que
   `--append-system-prompt` **não** chega numa sessão retomada (`--resume`) — a adoção não recebe as
   regras por aqui; a instrução dela já cobre o que ela precisa escrever.
6. **O `AGENTS.md` do esqueleto dá nome ao projeto e aponta para as regras** (achado do mantenedor:
   a sessão chamava o projeto de "projeto seeya", genérico, porque é o que o texto diz). Passa a
   dizer "este é o projeto seeya `<id>`…" e ganha uma seção curta "Working in this project" com o
   resumo das regras do item 5. **Projetos que já existem não são reescritos** (o seeya não
   sobrescreve arquivo que a pessoa pode ter editado).
7. **Onde o guarda-corpo termina**, escrito no código e nas regras: cobre o descuido; não cobre quem
   forja o identificador de outra sessão, nem um harness sem gancho rodando `--no-verify` — isso só
   a auditoria mostra.

**Considerado e deixado de lado (2026-09-25):** uma worktree por sessão, com o seeya consolidando
depois (proposta do mantenedor). Esbarra na D-047 item 1 ("sem rascunho paralelo para consolidar
depois" — o projeto é o tracker, e a próxima sessão age sobre as regras atuais); troca commits
simples por merge de markdown com conflito provável. Volta como revisão da D-047 se o uso pedir
duas sessões escrevendo no mesmo projeto ao mesmo tempo.

**O que não entra:** gancho antes da compactação (V2-T41); metadados do projeto na criação
(V2-T54); qualquer escrita em `~/.claude`.

**Cuidados:** nenhuma dependência nova; os ganchos são texto gerado pelo seeya, testado como texto
**e** executado de verdade num repositório descartável; nada no `~/.seeya` real, nenhuma sessão
real; texto dito pela CLI e pela janela num lugar só.

**Aceite do mantenedor:** num projeto novo, o `AGENTS.md` traz o nome do projeto e a seção de
regras; numa sessão aberta pelo `open`, a sessão **commita sozinha** no caminho, e o commit sai com
os trailers sem ela escrevê-los; um commit que tente tocar dois projetos é recusado com a mensagem
certa; pedir `--no-verify` e o harness recusar (se a medição do item 2 sustentar); fechar no X com
mudança pendente e o próximo `open` mostrar a sobra e perguntar; e `seeya project audit` apontar um
commit feito por fora.
<!-- SECTION:DESCRIPTION:END -->
