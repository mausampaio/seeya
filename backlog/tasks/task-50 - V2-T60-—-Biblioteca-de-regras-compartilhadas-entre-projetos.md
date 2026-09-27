---
id: TASK-50
title: V2-T60 — Biblioteca de regras compartilhadas entre projetos
status: To Do
assignee: []
created_date: '2026-09-27 11:19'
labels: []
milestone: m-0
dependencies:
  - TASK-49
type: feature
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T60 — Biblioteca de regras compartilhadas entre projetos.** Ideia do mantenedor em
2026-09-27, do uso real: duas sessões escreveram, cada uma à sua maneira, regras de uso das mesmas
ferramentas (por exemplo `glab`; o `gh` tem o mesmo problema), e as versões divergiram. Objetivo: uma
instrução escrita uma vez, usada do mesmo jeito em todo projeto que a quiser.

**Desenho combinado (a especificação detalha depois do spike V2-T59):**

- **Biblioteca** num repositório git próprio, gerido pelo `seeya`, **fora** do repositório do
  espaço de trabalho (nunca git aninhado). Pode ganhar remoto depois (várias máquinas, time).
- **Pacotes versionados.** Cada regra ou conjunto de regras tem versões (tag no git da biblioteca;
  granularidade por conjunto para começar — a especificação fecha).
- **Instalação por projeto, como lockfile.** O `seeya.json` guarda só o que está instalado e em que
  versão. Os arquivos da regra são gerados a cada `open` a partir da biblioteca na versão fixada,
  fora do git do espaço de trabalho (mesmo mecanismo do `.claude/settings.json`, V2-T34). O projeto
  só enxerga o que instalou; o que não instalou não existe para ele.
- **Desligar = desinstalar.** Some no próximo `open`, sem referência sobrando em arquivo do projeto.
- **Padrões.** Um pacote pode ser marcado como padrão: projeto novo nasce com ele instalado.
- **Atualização com aviso.** No `open`, o `seeya` avisa quais pacotes estão desatualizados, mostra
  o que mudou e pergunta se atualiza. A janela mostra as versões por projeto.
- **Somente leitura garantido, não só pedido.** Regra de trabalho diz que as regras instaladas são
  só leitura e não se copiam nem se referenciam em arquivo do projeto; o gancho do harness barra
  `Edit`/`Write` no diretório delas e o gancho de git recusa commit que as toque (limites medidos
  pelo spike).
- **Quem escreve na biblioteca:** só o `seeya`, ou uma sessão dedicada lançada por ele com a
  biblioteca como `cwd` e lock próprio.
- **Propostas de melhoria pela caixa de entrada (V2-T42).** Uma sessão de projeto que aprende algo
  novo sobre uma ferramenta não edita a regra: manda uma proposta como mensagem para o `seeya`
  (qual pacote, sobre qual versão, o que mudar e a evidência). O `seeya` avisa que há N propostas em
  aberto; a pessoa escolhe abrir a sessão da biblioteca para tratá-las juntas, e essa sessão
  consolida e publica uma versão nova. Proposta tende a carregar contexto do projeto de origem — a
  sessão da biblioteca generaliza antes de publicar (cuidado maior se a biblioteca ganhar remoto).
- **Migração do que já existe:** juntar o que projetos já escreveram sobre a mesma ferramenta e
  propor uma versão unificada, aprovada pela pessoa.

**Limite já conhecido:** a adoção roda no diretório original da sessão (V2-T29) e não enxerga o que
é gerado no `.claude/` do projeto — o mesmo limite de hoje.

**Depende de:** V2-T59 (spike). A parte de propostas depende da V2-T42 (caixa de entrada); o resto
não.
<!-- SECTION:DESCRIPTION:END -->
