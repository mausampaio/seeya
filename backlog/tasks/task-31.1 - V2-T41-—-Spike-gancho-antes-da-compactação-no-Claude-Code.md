---
id: TASK-31.1
title: 'V2-T41 — Spike: gancho antes da compactação no Claude Code'
status: To Do
assignee: []
created_date: '2026-09-23 11:05'
updated_date: '2026-09-28 09:58'
labels: []
milestone: m-5
dependencies: []
references:
  - docs/V2-RUMO.md
parent_task_id: TASK-31
type: spike
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T41 — Spike: gancho antes da compactação no Claude Code.** Especificada pelo PO em
2026-09-23, revista em 2026-09-28 (depois da V2-T29/V2-T34 em uso real). Primeiro filho da V2-T40.
**Spike: mede e escreve, não entrega comportamento.** O limite da família vale aqui: o seeya nunca
compacta nada; forçar compactação só acontece dentro da sessão descartável do próprio spike.

**O que mudou desde a especificação original.** Duas coisas já existem e mudam as perguntas:

- **O lugar da configuração já existe.** Desde a V2-T34, todo `seeya project open` regenera
  `<projeto>/.claude/settings.json` (fora do git, `**/.claude/` no `.gitignore` do espaço de
  trabalho). Um gancho de compactação entraria ali, ao lado do `PreToolUse` que já está lá. A
  pergunta 3 original ("vale a configuração do projeto?") vira confirmação, não descoberta.
- **As regras de trabalho já chegam à sessão** pelo `--append-system-prompt` do `open` (V2-T34
  item 5, `core/project-working-rules.ts`). Falta saber se elas sobrevivem à compactação.

**As perguntas.**

1. **O gancho antes (`PreCompact`) faz a sessão agir?** Consegue fazer o modelo escrever estado e
   saber-fazer nos arquivos do projeto antes de compactar, ou só roda um comando externo sem
   influenciar o que o modelo faz? Se o gancho devolve texto, esse texto chega ao modelo, e quando?
2. **O gancho depois é o caminho melhor?** Medir o `SessionStart` com origem de compactação (ou o
   equivalente que existir): consegue injetar contexto na sessão logo após compactar — por
   exemplo, "releia `INDEX.md` e `context/know-how.md`"? Reorientar depois pode ser mais confiável
   que fazer agir antes; o spike compara os dois.
3. **O que cada gancho recebe:** id da sessão, diretório, motivo (automática ou pedida), caminho do
   transcript.
4. **As regras de trabalho sobrevivem à compactação?** Depois de compactar, a sessão ainda segue o
   que veio pelo `--append-system-prompt` (ex.: "commit no caminho", "não mexa na config do git")?
5. **Memória da máquina × memória do projeto.** O Claude Code tem memória automática própria, por
   diretório, guardada fora do projeto (na configuração do usuário, em cada máquina). O saber-fazer
   do projeto mora em arquivos versionados (`context/know-how.md`, `decisions/`, `status/`) que vão
   para qualquer máquina. Medir: pedida para "guardar o que sabe" antes de compactar, **onde** a
   sessão escreve — nos arquivos do projeto, na memória automática, ou nos dois? Dá para orientar
   pelo texto do gancho? E propor, na seção "o que isto decide", o critério: o que é do projeto vai
   para o projeto; o que só vale nesta máquina (caminho local, onde está uma credencial aqui) vai
   para onde, sem nunca gravar segredo.
6. **Configuração do projeto vale para os dois ganchos?** Confirmar com a mesma técnica da V2-T34
   (gancho em `.claude/settings.json` do `cwd` dispara; o mesmo gancho num diretório só liberado
   por `--add-dir` não dispara). Se algum só funcionar na configuração global, o caminho está
   fechado — nunca escrevemos em `~/.claude`.
7. **Quanto custa:** atraso na compactação e tokens gastos, com números.
8. **Retomada:** numa sessão retomada (`--resume`), os ganchos do `.claude/settings.json` ATUAL do
   diretório valem (regenerado depois que ela começou)? Mesma medição serve à V2-T59.

**Como medir:** sessões descartáveis criadas pelo próprio spike, num diretório temporário fora do
repositório (um projeto de teste com o esqueleto do seeya é o cenário mais fiel), forçando a
compactação com o comando de compactar. **Nunca** uma sessão real do mantenedor, nunca a
configuração global dele, nunca o `~/.seeya` real nem o espaço de trabalho real. Modelo barato
quando a pergunta não depender do modelo.

**Entrega:** `docs/spikes/O-gancho-antes-da-compactacao.md` — método, saída bruta, e uma seção "o que
isto decide": o que a tarefa de implementação pode assumir e o que não pode, com a recomendação
entre agir antes e reorientar depois. Mais a primeira linha da matriz de capacidades da V2-T40.

**Aceite do mantenedor:** ler o spike e concordar com a leitura, ou apontar o que ficou sem medir.
<!-- SECTION:DESCRIPTION:END -->
