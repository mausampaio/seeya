---
id: TASK-25
title: 'V2-T30 — A janela: lateral por projeto e open em aba'
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-24 17:28'
labels: []
milestone: m-0
dependencies:
  - TASK-23
  - TASK-26
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T30 — A janela por projeto: lateral por projeto, recolhível, `open` em aba e adotar pela
lista.** Especificada pelo PO em 2026-09-24, com os dois requisitos que o mantenedor disse que não
esperam (comentário de 2026-09-24): **projetos como foco da listagem** e **a lateral recolhível**. O
resto da interface pode continuar provisório. Absorve a **V2-T48** (barras de rolagem).

**Por quê agora:** o mantenedor precisa usar o seeya no dia a dia, e a dor é sessão perdendo
memória. Projetos (V2-T27/T28), lock (V2-T33/T35), adoção (V2-T29) e desfazer (V2-T32) já existem na
CLI; esta tarefa leva o caminho principal para a janela.

**O que entra:**

1. **Projetos no topo da lateral.** Uma seção **Projects**, antes de tudo, com cada projeto do
   espaço de trabalho (`application/workspace.ts#listProjects`): nome, estado do lock (livre, ou
   "held by session <id>" com o mesmo texto de `core/project-lock-message.ts`), as sessões que
   pertencem a ele, e a ação **Open**. Uma sessão pertence a um projeto **só** por evidência
   (D-025): o `cwd` dela é o diretório do projeto (comparação por `core/cwd-normalization.ts`), ou
   ela é a cópia registrada em `adoptions.json` para aquele projeto, ou ela é a dona do lock dele.
   Nunca por repositório associado — um repositório pode servir a mais de um projeto. As sessões que
   não pertencem a projeto nenhum ficam numa seção **Other sessions**, abaixo. Hoje, Status e o
   resto continuam, abaixo dos projetos.
2. **A lateral recolhe.** Um botão sempre visível alterna entre aberta e recolhida; recolhida, o
   terminal ocupa a largura toda e **se reajusta** (linhas e colunas recalculadas — é o mesmo
   defeito do item 1 da V2-T48). O estado é lembrado entre aberturas do app. É preferência de
   visualização, não configuração: não vai para `config.json`; `localStorage` do renderer serve, com
   leitura protegida (sem valor, abre aberta).
3. **`open` numa aba.** **Open** chama o mesmo `openProject` da CLI com um lançador que abre o
   harness numa aba embutida (irmão do `TabSessionResumer`, implementando `HarnessLauncher` sobre o
   `PtyManager`): diretório do projeto, `--add-dir` dos repositórios, `--session-id` gerado,
   `--append-system-prompt` com o aviso do lock. Com o projeto travado por outra sessão viva, a
   janela mostra o aviso e **pede confirmação num diálogo** antes de abrir (o mesmo texto e as mesmas
   três respostas da V2-T35). A aba leva o nome do projeto. Ao fechar a aba, o lock é solto e a
   janela mostra, curto, como ele ficou. **O pid gravado no lock é o do processo principal do app** —
   o equivalente, aqui, ao processo da CLI que fica bloqueado durante o `open` (Q-087 item 3 previa
   rever isto quando o `open` deixasse de bloquear): vivo enquanto o app vive, morto se o app cair,
   e então o lock fica velho e é retomável.
4. **Novo projeto.** Um botão **New project…** na seção Projects (nome → `createProject`), que é
   também o que a adoção usa para "adotar num projeto novo".
5. **Adotar pela lista.** Cada sessão em **Other sessions** que pode ser adotada ganha **Adopt…**;
   sessão viva mostra a ação desabilitada com o motivo (a adoção recusa sessão viva). O fluxo é o da
   CLI, na janela: escolher projeto existente ou novo → o **mesmo bloco de explicação** da V2-T29
   (onde a cópia abre e por quê, onde fica o projeto, e o `project open` para depois), num diálogo
   que espera a pessoa → a cópia abre numa **aba**, no diretório original da sessão → ao fechar a
   aba, o diálogo com os arquivos que mudaram no projeto e "commitar?" → o resultado, com um botão
   **Open project** quando a adoção foi aceita.
6. **As barras de rolagem da V2-T48**, os dois itens: a janela nunca tem barra de rolagem própria
   (cada região rola o seu conteúdo), o terminal se reajusta em **qualquer** mudança de tamanho
   (inclusive a primeira maximização e o recolher da lateral), e o bloco de status quebra linha
   longa, inclusive dentro de caminho.

**Regras de construção:**

- **Texto dito pela CLI e pela janela mora num lugar só.** O que hoje está em `packages/cli/src/
  format-project.ts` e a janela precisa dizer igual (a explicação da adoção, a pergunta do commit)
  sai de `cli/` para um módulo que os dois alcancem — o mesmo movimento que a V2-T35 fez com o aviso
  do lock (`core/project-lock-message.ts`). `app/` e `cli/` continuam sem se importar (D-043).
- **`renderer.ts` e `main.ts` não crescem.** Os dois já passam de mil linhas, contra o teto de 500
  do `AGENTS.md`. O que esta tarefa acrescenta entra em módulos novos e testados (a lógica em
  `sidebar/`/`state/`, puros; a fiação o mínimo necessário). Dividir o que já existe **não** é desta
  tarefa — vira tarefa própria.
- **Nenhuma operação destrutiva na janela.** `remove`, `remove-repo`, `revert-adoption` e `add-repo`
  continuam só na CLI nesta tarefa.
- **Custo (régua do `docs/DESEMPENHO.md`):** a lista de projetos é lida na subida e depois de cada
  ação de projeto; o estado do lock e o `adoptions.json` são lidos no ciclo de 10 s que já existe
  (um arquivo pequeno por projeto). Remedir subida e repouso pelo método do documento e registrar o
  antes/depois no relatório.

**O que não entra:** as operações destrutivas acima; qualquer harness além do `claude`; mudar a
posse do daemon; a V2-T49 (clique no aviso do Linux); dividir `renderer.ts`/`main.ts`.

**Aceite do mantenedor:** abrir o app e ver os projetos no topo, cada um com as suas sessões e o
estado do lock; recolher a lateral, fechar e reabrir o app, e ela continuar recolhida, com o terminal
na largura toda; **Open** de um projeto abre numa aba, e o lock mostra a sessão; com o projeto aberto
também pela CLI, o **Open** da janela mostra o aviso e pergunta; criar um projeto de teste pela
janela e adotar nele uma sessão sem importância pela lista, aceitando o commit, e **Open project**
abrir o projeto; e a primeira maximização sem barra de rolagem nenhuma.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-24 17:28
---
Requisitos do mantenedor em 2026-09-24, para entrar na especificação: (1) PROJETOS como foco da listagem — a lateral organiza por projeto, não por sessão solta; (2) a lateral esquerda precisa RECOLHER — hoje ocupa espaço demais da tela. A interface pode continuar provisória no resto; estes dois pontos não esperam. Motivo declarado: ele precisa usar o seeya no dia a dia, e a dor principal hoje são sessões perdendo memória — projetos e adoção são o foco agora. A V2-T48 (barras de rolagem) entra junto com esta.
---
<!-- COMMENTS:END -->
