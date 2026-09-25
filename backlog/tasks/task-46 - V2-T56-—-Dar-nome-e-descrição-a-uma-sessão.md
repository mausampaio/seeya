---
id: TASK-46
title: V2-T56 — Dar nome e descrição a uma sessão
status: To Do
assignee: []
created_date: '2026-09-25 13:35'
labels: []
milestone: m-2
dependencies: []
priority: low
type: feature
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T56 — Dar nome e descrição a uma sessão.** Ideia do mantenedor em 2026-09-25, a partir de
renomear conversas no claude.ai: *"se é uma sessão que não quero perder eu vou lá e dou um nome para
ela, uma descrição… Se é sessão descartável, que fez uma coisa específica e foi fechada, eu nem
preciso fazer nada."* Resolve pela raiz o problema da V2-T53 (dezenas de sessões com o mesmo nome,
o do diretório): quem marca o que importa é a pessoa, e só quando quer.

**Medir antes de construir:** se o próprio Claude Code já guarda um título para a sessão (versões
recentes podem ter um comando de renomear ou um resumo no transcript). Se guardar, o seeya **lê e
mostra** esse título em vez de criar um segundo nome que diverge do primeiro; o que o harness não
tiver (descrição, por exemplo) fica com o seeya. Registrar a medição.

**O que entra (o que o harness não cobrir):**

1. **Nome e descrição opcionais por sessão**, guardados pelo seeya num arquivo novo em `~/.seeya/`
   (nome do arquivo e das chaves no glossário do `AGENTS.md` **antes** do código — identificador em
   disco), chaveado pelo id da sessão.
2. **Onde se define:** na janela, uma ação na linha da sessão (e no modal de diretório da V2-T55);
   na CLI, `seeya sessions label <sessão> --name "<nome>" [--description "<texto>"]` (nome do
   subcomando e das flags fixado aqui, para entrar no glossário).
3. **Onde aparece:** em todo lugar que lista sessão — lateral, modal, painel "Hoje", `seeya
   sessions` —, com o nome dado no lugar do nome do diretório, e a descrição quando couber. A busca
   da V2-T55 também acha pelo nome.
4. **Sessão sem nome fica como hoje.** Nada é obrigatório.

**Em aberto, para decidir na especificação final:** o nome passa para a cópia quando a sessão é
adotada (a cópia tem outro id)? Parece que sim — é a mesma linha de trabalho —, mas é decisão.

**Aceite do mantenedor:** dar nome e descrição a uma sessão que ele quer guardar, fechar, e achá-la
depois pelo nome na janela e no `seeya sessions`.
<!-- SECTION:DESCRIPTION:END -->
