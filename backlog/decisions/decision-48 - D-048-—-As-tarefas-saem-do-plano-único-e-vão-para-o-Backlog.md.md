---
id: decision-48
title: 'D-048 — As tarefas saem do plano único e vão para o Backlog.md'
date: '2026-09-24 00:51'
status: accepted
---
## Contexto

Título original completo: "As tarefas saem do plano em Markdown único e vão para o Backlog.md".

**Decisão do mantenedor, em 2026-09-22.** O `docs/PLANO-DE-ENTREGA.md` passou de oito mil linhas,
com especificação e relatório de cada tarefa no mesmo arquivo, e deixou de ser lido: *"hoje eu nem
leio mais aquele arquivo"*. O que ele pediu: algo aberto e simples, com bloqueio entre tarefas e
agrupamento por épico — sem expor uma lista de issues num repositório público e sem servidor.

## Decisão

**A escolha: [Backlog.md](https://github.com/MrLesk/Backlog.md)**, licença MIT, local, sem conta
nem telemetria. Cada tarefa é um arquivo Markdown em `backlog/tasks/`, com status, marco,
dependências, tipo e prioridade no cabeçalho — versionado com o código, legível pelos agentes como
o plano era, e navegável num quadro (`backlog board` no terminal, `backlog browser` no navegador).
Testada pelo PO e pelo mantenedor antes de adotar, com tarefas reais da fila.

**Como fica:**
- **Marcos** fazem o papel de épico: Projetos, Interface, Daemon, Instalador, Fronteira da v1.
- **Status**: `To Do` → `In Progress` → `Review` (entregue, aguardando o aceite do mantenedor — o
  antigo `[~]`) → `Done`. Quem move para `Done` é o review.
- **O nome da tarefa continua `V2-T<n>`** no título, porque é por ele que código, decisões e
  documentos a citam. O identificador interno do Backlog.md (`TASK-<n>`) é só dele.
- **Nada se perde na migração:** as tarefas abertas e as em aceite foram copiadas com a
  especificação inteira; as fechadas ficam no `docs/PLANO-DE-ENTREGA.md`, congelado como histórico.
- **A ferramenta é instalada na máquina, não como dependência do projeto** — o `package.json` não
  muda. Ela é configurada para nunca commitar sozinha nem ler outras branches: quem commita segue
  sendo quem já commitava.

**Os status das decisões, fixados em 2026-09-23** (o Backlog.md aceita texto livre; o vocabulário
é nosso): `accepted` — vigente; `superseded` — substituída por inteiro, com o ponteiro para a
nova; `proposed` — escrita e ainda não confirmada pelo mantenedor. **"Emendada" não é status**: a
decisão emendada continua `accepted` e ganha no corpo a linha dizendo o que mudou e por qual
decisão, porque ela ainda governa tudo o que a emenda não tocou.

## Consequências

**Ajuste do mantenedor em 2026-09-23, depois de ver a primeira tarefa fechar:** as **notas de
implementação são do agente e param quando ele entrega**. Revisão, aceite e achados posteriores
viram **comentário** na tarefa — o Backlog.md carimba data e hora em cada um, e a leitura de cima
a baixo passa a contar a história na ordem em que aconteceu. Reescrever as notas a cada evento,
como o PO fez na V2-T33, embaralha implementação com aceite.

**Título é nome, não frase — no máximo 72 caracteres, e o arquivo renomeado junto** (2026-09-23).
O Backlog.md monta o nome do arquivo a partir do título e **não** renomeia o arquivo quando o
título muda. Medido nesta máquina: um título escrito como frase inteira virou um nome de 204
caracteres, e o `git worktree add` — como cada agente recebe a cópia isolada dele — falhou com
`Filename too long` antes de qualquer trabalho começar. `core.longpaths` ficou ligado no
repositório, mas o limite de 72 é a regra, cobrada por
`tests/integration/guards/backlog-names.test.ts` (D-047 item 5: o que precisa valer sempre é
garantido por código).

**O que não muda:** `docs/DECISOES.md` continua sendo o registro das decisões (o Backlog.md tem
pasta própria para isso, mas o código inteiro cita `D-0XX` a partir daqui).
