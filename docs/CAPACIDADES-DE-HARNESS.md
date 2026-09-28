# Matriz de capacidades por harness

A V2-T40 (`backlog/tasks/task-31 - V2-T40-—-Ganchos-por-harness-a-família.md`) pede uma matriz de
capacidades por harness — para cada um: tem gancho antes da compactação? tem gancho antes de
executar comando? onde a configuração mora (tem de ser dentro do projeto, nunca em `~/.claude` ou
equivalente)? o que já foi medido e o que não? Este arquivo não existia antes da V2-T41 (o primeiro
filho da V2-T40) — criado aqui, enxuto, com a primeira linha. Cresce um harness por vez, só quando
houver o que medir (nada de linha vazia para ferramenta que ninguém usa neste projeto).

| Harness | Gancho antes da compactação | Gancho antes de executar comando | Onde a configuração mora | Medido / não medido |
|---|---|---|---|---|
| Claude Code | Sim (`PreCompact`) — mas **nunca** fez a sessão agir nas 5 compactações reais medidas (só roda um comando externo; o `additionalContext` que devolve não obriga ação nenhuma) | Sim (`PreToolUse`, matcher `Bash`) — já em uso desde a V2-T34 (`core/harness-hook-config.ts`) | `.claude/settings.json` dentro do `cwd` real da sessão (nunca `~/.claude/`, nunca um diretório liberado só por `--add-dir` — confirmado para os dois ganchos de compactação também) | `docs/spikes/O-gancho-antes-da-compactacao.md` (V2-T41) — compactação; V2-T34 — comando |

Harnesses ainda sem linha (entram quando alguém for usá-los de verdade neste projeto, por sua
própria tarefa filha da V2-T40): Codex, Gemini.
