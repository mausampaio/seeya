---
id: TASK-51
title: 'V2-T61 — O projeto ganha CLAUDE.md gerado, com Compact Instructions'
status: To Do
assignee: []
created_date: '2026-09-29 10:05'
labels: []
milestone: m-0
dependencies: []
priority: high
type: feature
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T61 — O projeto ganha CLAUDE.md gerado, com Compact Instructions.** Implementa a **D-050**
(decisão do mantenedor em 2026-09-29), a partir do spike O (V2-T41) e da leitura de documentação que
o completou: o Claude Code garante reinjetar o `CLAUDE.md` da raiz depois da compactação, e não diz
nada sobre o `AGENTS.md` — que é o único arquivo de instruções que o esqueleto gera desde a V2-T44.

**O que entra:**

1. **`CLAUDE.md` gerado a cada `open`, fora do git** — mesmo mecanismo do `.claude/settings.json`
   (V2-T34): escrito em `<projeto>/CLAUDE.md` por `seeya project open` (CLI e janela), nunca
   commitado (padrão no `.gitignore` do espaço de trabalho, conferido com `git status --ignored`
   real). Conteúdo, num lugar só em `core/`:
   - a linha `@AGENTS.md` (o conteúdo continua só no `AGENTS.md`);
   - uma seção `## Compact Instructions`, em inglês, dizendo ao resumo que preserve: a tarefa em
     andamento e o próximo passo; decisões tomadas na sessão que ainda não estão em `decisions/`;
     arquivos mudados e ainda não commitados; o que se aprendeu sobre ferramentas, acessos e
     ambiente que ainda não está em `context/know-how.md`. E que, depois de compactar, a sessão
     releia `INDEX.md` e `status/` antes de continuar. Curta.
2. **Projeto antigo com `CLAUDE.md` versionado** (criado antes da V2-T44): o `open` **não** o
   sobrescreve nem o apaga; imprime uma linha dizendo que o projeto tem um `CLAUDE.md` próprio e
   por isso não recebe o gerado (D-025). Nada de migração automática.
3. **Regras de trabalho** (`core/project-working-rules.ts`): acrescentar que o `CLAUDE.md` é gerado
   pelo seeya e não se edita — instruções do projeto vão no `AGENTS.md`.
4. **Adoção:** nada muda (a cópia roda no diretório original da sessão, V2-T29).

**Duas medições baratas, com sessões descartáveis (modelo `haiku`, teto de US$ 3 no total):**

- **(a) Duplicação no início:** com `CLAUDE.md` (`@AGENTS.md`) e `AGENTS.md` juntos na raiz, o
  conteúdo do `AGENTS.md` entra uma vez ou duas no contexto inicial? Se entrar duas, parar e
  registrar em `docs/QUESTOES.md` com a saída bruta — não escolher sozinho uma alternativa.
- **(b) Uma compactação real** (mesma técnica do spike O, a automática): depois dela, o conteúdo do
  `AGENTS.md` (via import) volta ao contexto? E a seção Compact Instructions aparece refletida no
  resumo? Registrar a saída bruta anonimizada num apêndice do `docs/spikes/O-gancho-antes-da-compactacao.md`.
  Os transcripts ficam no lugar para o PO conferir; listar as pastas no relatório.

**Cuidados:** a janela e a CLI usam a mesma geração (sem duplicar texto); nada no espaço de trabalho
real, no `~/.seeya` real ou no `~/.claude` além do que o próprio `claude` grava das sessões
descartáveis; comando bloqueado por permissão ou pela proteção da worktree **não se contorna** (nem
reescrevendo em script) — para o passo e reporta.

**Aceite do mantenedor:** abrir um projeto, ver o `CLAUDE.md` gerado e fora do `git status`; ler o
apêndice do spike.
<!-- SECTION:DESCRIPTION:END -->
