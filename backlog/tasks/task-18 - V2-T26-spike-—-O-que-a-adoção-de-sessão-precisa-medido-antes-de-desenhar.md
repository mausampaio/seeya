---
id: TASK-18
title: 'V2-T26 (spike) — O que a adoção de sessão precisa, medido antes de desenhar'
status: Review
assignee: []
created_date: '2026-09-22 11:11'
labels: []
milestone: m-0
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: spike
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T26 (spike) — O que a adoção de sessão precisa, medido antes de desenhar.** Especificada
pelo PO em 2026-09-21. **Spike: mede e escreve, não entrega comportamento.** Existe porque a
D-045 item 4 depende de duas premissas técnicas que ninguém nunca mediu, e desenhar a adoção
sem elas seria inventar.

**O que medir, cada uma com a saída bruta no relatório:**
1. **Retomar com acesso de escrita a um diretório fora do da sessão.** O Claude Code tem um
   parâmetro de diretórios adicionais; ele nunca foi medido **junto com `--resume`**. A
   pergunta exata: uma sessão retomada consegue escrever num diretório de projeto que não é o
   `cwd` dela? Com quais limites (permissão pedida na hora? recusa silenciosa? caminho
   relativo?).
2. **Entregar uma instrução inicial na retomada.** Já sabemos que o prompt vai por argumento
   e que ele tem teto (D-015, V2-T7). A pergunta aqui é outra: **qual o menor texto útil** que
   faz a sessão entender que deve externalizar a própria memória para arquivos, e o que
   acontece quando ela é retomada com esse texto — ela escreve, pergunta, ou ignora?
3. **O Codex aceita mensagem inicial na retomada?** Ele tem um comando de retomada próprio;
   a mensagem inicial nunca foi medida. Se não aceitar, a saída da D-045 já está decidida
   (gerar o texto para a pessoa colar) — o spike só confirma qual dos dois caminhos vale.

**Como medir sem sujar nada:** sessões descartáveis, criadas pelo próprio spike num diretório
temporário fora do repositório, com `SEEYA_APP_HOME_OVERRIDE`/home descartável quando o
seeya entrar na conta. **Nunca** usar uma sessão real do mantenedor, nunca escrever no
`~/.claude` real. Cada medição custa tokens de verdade: meça uma vez, registre a saída, não
repita para "confirmar".

**Entrega:** `docs/spikes/N-adocao-de-sessao.md` em português, com método, saída bruta e uma
seção final **"o que isto decide"** — para cada um dos três pontos, o que a V2-T29 pode
assumir e o que ela não pode. Nenhuma mudança em `packages/`.

**Aceite do mantenedor:** ler o spike e concordar com a leitura, ou apontar o que ficou sem
medir.

**Relatório.** `docs/spikes/N-adocao-de-sessao.md`, medido no Windows contra `claude` 2.1.278
e `codex-cli` 0.154.0, com sessões descartáveis fora do repositório. As três respostas:

1. **Escrita fora do `cwd`, com `--resume`:** funciona — `--add-dir` combinado com `--resume`
   aceita caminho absoluto e relativo dentro do diretório adicionado. O achado que muda o
   desenho: **por padrão, o modo headless (`-p`) nega toda escrita, inclusive no próprio
   `cwd` da sessão** — sem `--permission-mode` explícito (`acceptEdits` foi o testado),
   ninguém aprova o pedido e nada é escrito. Com `acceptEdits`, escreve dentro do `cwd` e do
   `--add-dir`, e continua negando fora dos dois. Gotcha de invocação registrado: `--add-dir`
   é variádico e engole um prompt posicional que venha logo depois — precisa de `--` entre
   os dois.
2. **A instrução mínima:** nomear os arquivos-alvo (`AGENTS.md`, `INDEX.md`) funciona numa
   única retomada — a sessão escreveu os dois, com conteúdo correto, e sinalizou sozinha uma
   inconsistência nos fatos em vez de inventar. Um texto vago sobre "externalizar memória",
   sem nomear arquivo, foi um lugar-comum: a sessão usou o mecanismo de auto-memória do
   próprio `claude` (fora do projeto, em `~/.claude/`) em vez de escrever nos arquivos do
   projeto — satisfez a letra do pedido, não a intenção.
3. **O Codex:** aceita mensagem inicial em `codex exec resume <id> "<mensagem>"` — medido com
   contexto real da conversa original, não só documentado no `--help`. Isso derruba a
   premissa por trás do plano de contingência da D-045 (gerar texto para colar) para o
   caminho headless; a V2-T29 pode tratar Codex e Claude Code de forma simétrica nesse ponto.
   Não medido: `codex resume` interativo (picker, sem `exec`) e a retomada interativa de
   verdade nos dois harnesses (sem TTY, mesma reserva do spike H).

Nenhuma mudança em `packages/`; portão rodado só com `format:check` e o guard de termos
locais.
<!-- SECTION:DESCRIPTION:END -->
