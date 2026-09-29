---
id: decision-50
title: 'D-050 — O projeto ganha CLAUDE.md gerado, com Compact Instructions'
date: '2026-09-29 10:04'
status: accepted
---
## Contexto

A V2-T44 (decisão do mantenedor, 2026-09-24) tirou o `CLAUDE.md` do esqueleto do projeto: o conteúdo
vive só no `AGENTS.md`, que o Claude Code já lê no início da sessão. O spike O
(`docs/spikes/O-gancho-antes-da-compactacao.md`, V2-T41) e a leitura de documentação que o
completou em 2026-09-29 mostraram o que ficou descoberto: a documentação do Claude Code garante que
o `CLAUDE.md` da raiz do projeto é **relido do disco e reinjetado depois da compactação**, e não diz
nada sobre o `AGENTS.md`. Ler no início é garantido; voltar depois de compactar, não está escrito.
No Codex e no Gemini CLI, o arquivo de instruções do projeto volta por construção (código-fonte);
no Claude Code, só o que se chama `CLAUDE.md`.

A mesma documentação dá um jeito de dizer o que preservar no resumo: uma seção "Compact
Instructions" no `CLAUDE.md`. O spike mediu que ganchos de compactação não fazem a sessão salvar
nada; esta seção é o mecanismo documentado para orientar o próprio resumo.

## Decisão

Todo projeto aberto com o Claude Code ganha um `CLAUDE.md` **gerado pelo seeya**, com duas partes:
o import `@AGENTS.md` (o conteúdo continua num lugar só) e uma seção **Compact Instructions** fixa,
escrita pelo seeya, dizendo o que o resumo deve preservar. Decisão do mantenedor em 2026-09-29
("pode reabrir e colocar o compact instructions"), revendo em parte a V2-T44: o `AGENTS.md` continua
sendo a fonte; o `CLAUDE.md` é só a ponte específica deste harness.

## Consequências

- **As instruções do projeto voltam depois de compactar por garantia documentada**, não por hipótese.
- **O `AGENTS.md` continua sendo a única fonte do conteúdo**; ninguém edita o `CLAUDE.md` (o texto
  é do seeya, e a regra de trabalho diz para editar o `AGENTS.md`).
- **Específico do Claude Code** (D-030): outro harness que precise de ponte parecida ganha a dele.
- **Onde o guarda-corpo termina:** a seção orienta o resumo, não o obriga — é instrução ao modelo
  que resume, não código. Não substitui escrever o saber-fazer no projeto com aceite humano.
