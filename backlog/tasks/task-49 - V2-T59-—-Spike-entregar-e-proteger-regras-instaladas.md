---
id: TASK-49
title: 'V2-T59 — Spike: entregar e proteger regras instaladas'
status: To Do
assignee: []
created_date: '2026-09-27 11:19'
labels: []
milestone: m-0
dependencies: []
type: spike
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T59 — Spike: como entregar e proteger regras instaladas num projeto.** Primeiro passo da
biblioteca de regras compartilhadas (V2-T60), ideia do mantenedor em 2026-09-27. Mede antes de
especificar; pode dividir medições com a V2-T41 (gancho antes da compactação).

**Perguntas a medir (sessões descartáveis, nunca as do mantenedor):**

1. **Skills como forma de entrega.** Uma skill gerada em `.claude/skills/<regra>/` do `cwd` da
   sessão é descoberta e carregada só quando o assunto aparece? Quanto contexto custa quando não é
   usada (só a descrição)?
2. **Retomada.** Uma sessão retomada (`--resume`) enxerga o conjunto de skills ATUAL do diretório
   (a regra desinstalada some, a nova aparece) ou o do momento em que começou? O que sobra no
   histórico da conversa sobre uma regra que saiu?
3. **Somente leitura garantido.** Um gancho `PreToolUse` com matcher `Edit|Write` (além do `Bash`
   que a V2-T34 já cobre) consegue barrar escrita no diretório das regras instaladas, com `exit 2`?
   Onde o guarda-corpo termina (escrita indireta por `Bash`)?
4. **Aviso de desinstalação.** Existe forma de dizer a uma sessão retomada que uma regra deixou de
   valer? (A Q-069 já mediu que `--append-system-prompt` não chega a uma sessão retomada.)
5. **Biblioteca fora do alcance.** Um diretório que não é `cwd` nem `--add-dir` exige permissão para
   ser lido — confirmar que é isso que acontece por padrão.

**Entrega:** `docs/spikes/<letra>-regras-instaladas.md` com a saída bruta de cada medição e a
recomendação; nenhuma mudança de produto.
<!-- SECTION:DESCRIPTION:END -->
