---
id: TASK-31.1
title: 'V2-T41 — Spike: gancho antes da compactação no Claude Code'
status: To Do
assignee: []
created_date: '2026-09-23 11:05'
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
2026-09-23. Primeiro filho da V2-T40. **Spike: mede e escreve, não entrega comportamento.**

**A pergunta.** O Claude Code dispara um gancho imediatamente antes de compactar o contexto. O que
ninguém mediu:

1. **O gancho consegue fazer a sessão agir antes da compactação** — escrever o estado e o
   saber-fazer nos arquivos do projeto — ou ele só executa um comando externo, sem influenciar o que
   o modelo faz em seguida?
2. **O que ele recebe**: sabe qual sessão é, o diretório, o motivo (automática ou pedida)?
3. **Onde a configuração pode morar**: vale a configuração **do projeto** (dentro do diretório que o
   seeya administra), ou só a global do usuário? Se só a global, este caminho está fechado para
   nós — a regra de nunca escrever em `~/.claude` não se negocia por conveniência.
4. **Quanto custa**: o gancho atrasa a compactação? Gasta tokens?

**Como medir:** sessão descartável criada pelo próprio spike, num diretório temporário fora do
repositório, forçando a compactação com uma conversa longa ou pelo comando de compactar. **Nunca**
uma sessão real do mantenedor, nunca a configuração global dele.

**Entrega:** `docs/spikes/O-gancho-antes-da-compactacao.md` — método, saída bruta, e uma seção "o
que isto decide": o que a tarefa de `checkpoint`/`pause` pode assumir e o que não pode. Mais a
primeira linha da matriz de capacidades da V2-T40.

**Aceite do mantenedor:** ler o spike e concordar com a leitura, ou apontar o que ficou sem medir.
<!-- SECTION:DESCRIPTION:END -->
