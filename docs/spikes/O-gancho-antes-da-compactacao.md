# Spike O — O gancho antes (e depois) da compactação no Claude Code

**Data:** 2026-09-28 · **Plataforma medida:** Windows 11, build 10.0.26200 · **Tarefa:** V2-T41
(TASK-31.1, filha da V2-T40/TASK-31) · **Versão medida:** `claude` 2.1.283 (CLI)

## Por que este spike existe

A V2-T40 desenha uma família de tarefas — um gancho por harness — para dois problemas que já
aconteceram de verdade com o mantenedor: uma sessão longa esqueceu como chegar ao banco e foi
caçar credencial num manifesto (2026-09-21), e outra sessão sabia onde o sistema operacional
guarda capturas de tela, perdeu isso numa compactação e respondeu que a captura não tinha chegado
(2026-09-24). O papel que a V2-T40 desenha para o `seeya` é só três verbos, nenhum destrutivo:
**lembrar** (pelo gancho, se ele conseguir fazer a sessão agir), **escrever** (com aceite humano) e,
no máximo, **sugerir** que é um bom momento para compactar — **o `seeya` nunca compacta nada**.

Este spike é o primeiro filho, só para o Claude Code, e mede as oito perguntas que a tarefa fixa
(revista pelo PO em 2026-09-28, depois de V2-T29/V2-T34 em uso real): o gancho `PreCompact` faz a
sessão agir; o `SessionStart` com origem de compactação é o caminho melhor; o que cada gancho
recebe; se as regras de trabalho entregues por `--append-system-prompt` sobrevivem à compactação;
memória da máquina × memória do projeto; se a configuração de projeto (não `~/.claude`) vale para
os dois ganchos; quanto custa; e se uma sessão retomada usa a configuração ATUAL do diretório.

**Este spike não implementa nada.** O limite da família (fixado pelo mantenedor em 2026-09-23,
citado na V2-T40) vale aqui: o `seeya` nunca dispara compactação em nenhuma sessão real — toda
compactação medida abaixo aconteceu **dentro de uma sessão descartável do próprio spike**, forçada
por conteúdo de enchimento (ver "Como medir" abaixo), nunca por um comando do `seeya`.

## Controles de contaminação

- **Sessões descartáveis, criadas por este spike**, em diretórios temporários fora do repositório
  (`<tmp>` abaixo), nunca uma sessão real do mantenedor, nunca a configuração global dele.
- **`process.env` contaminado pela própria sessão de agente que rodou este spike**, o mesmo achado
  já registrado nos spikes H/M/N: onze variáveis `CLAUDE_CODE_*`/`CLAUDE_PID`/`CLAUDECODE`/
  `CLAUDE_EFFORT` estavam presentes no ambiente antes de qualquer medição. Todas as chamadas a
  `claude` abaixo rodaram com essas variáveis explicitamente removidas (`env -u ...`) antes do
  `spawn`, nunca herdadas (D-017).
- **Identificadores anonimizados neste documento.** Os oito `session_id` reais devolvidos pelo
  `claude` foram substituídos por UUIDs obviamente sintéticos (dígitos repetidos), e todo caminho
  de home real (`C:\Users\<usuario>\...`) foi substituído pelo placeholder `<usuario>`/`<tmp>` em
  todo trecho de saída bruta reproduzido aqui. Os valores reais só existiram na máquina de teste.
- **Modelo barato (`--model haiku`) em toda chamada.** O `-p` sem `--model` explícito usa Opus por
  padrão (mesmo achado do spike N) — nunca omitido aqui.
- **Custo real, mais alto que spikes anteriores, e é por isso: forçar uma compactação de verdade
  processa a conversa inteira de novo para produzir o resumo.** Custo total das 18 chamadas reais
  ao `claude`: **US$ 5,50** (a maior parte em `cache_creation`, o preenchimento sintético que cada
  chamada precisa gerar de novo depois de uma compactação anterior ter zerado o cache). Detalhe por
  pergunta na seção de cada uma. Nenhuma medição foi repetida "para confirmar" além do necessário
  para reproduzir um resultado inesperado (ver Achado da pergunta 2).
- **Limpeza depois da medição:** ver a seção "Limpeza" no fim.

## Como medir: forçar compactação de verdade sem TTY

**Achado colateral, antes das oito perguntas: `/compact` não funciona em `-p` headless.** A forma
óbvia de forçar uma compactação MANUAL seria mandar o texto `/compact` como prompt de uma chamada
`-p --resume`. Testado e não funciona — o texto é tratado como conteúdo literal da conversa, não
como comando:

```
$ claude -p --model haiku --resume <sessão-base> -- "/compact"
{"result":"I see a file path, but I'm not sure what you'd like me to do with it...","...}
```

Nenhum gancho disparou, nenhuma compactação aconteceu (`exit=0`, sem log nenhum). `/compact` é uma
interpretação do cliente interativo (TUI) sobre o que a pessoa digitou, não algo que o modo `-p`
headless analisa — coerente com o que os spikes H/N já mediram para outras teclas/comandos
interativos. **Consequência para este spike: só a compactação AUTOMÁTICA (`trigger: "auto"`) foi
medida.** A manual (`trigger: "manual"`, disparada por `/compact` numa sessão interativa de
verdade) fica na seção "O que não foi medido".

**O jeito que funcionou: estourar a janela real de contexto do modelo com conteúdo de
enchimento, em mais de um turno.** Uma tentativa preguiçosa — um único prompt gigante, sem
histórico anterior — falha com uma mensagem clara, que também é dado novo:

```
$ claude -p --model haiku < enchimento-de-260k-tokens.txt
{"result":"Prompt is too long · the request is ~261876 tokens (limit 200000) and this
conversation's own content is most of it. A single-exchange conversation cannot be compacted;
start with less content (smaller files or pasted text).","total_cost_usd":0}
```

A mensagem confirma o limite exato do modelo usado (`contextWindow: 200000` para
`claude-haiku-4-5`, presente em toda resposta) e por que um turno único não serve: **compactar
exige conversa PRÉVIA para resumir.** O método que funcionou em toda medição abaixo: (1) uma
chamada base cria a sessão com um turno grande, mas abaixo de 200k tokens; (2) uma chamada
`--resume` manda um segundo bloco de enchimento grande o bastante para o total (turno 1 + turno 2)
passar de 200k. A compactação automática dispara **antes** do modelo processar o turno 2, com o
turno 1 como o que é resumido. Confirmado não só pelo padrão indireto de custo/cache, mas por um
evento estruturado no próprio transcript, nunca antes citado nos spikes deste projeto:

```json
{"type":"system","subtype":"compact_boundary","content":"Conversation compacted",
 "compactMetadata":{"trigger":"auto","preTokens":230990,"postTokens":93179,
 "cumulativeDroppedTokens":137811,"durationMs":14414}}
```

Este evento sozinho já responde parte da pergunta 7 (ver lá): a compactação em si, medida seis
vezes de verdade, durou entre 9,8s e 27,8s, e tipicamente derrubou a conversa para ~45–55% do
tamanho anterior.

O `--autocompact <auto|100k–1M tokens>` (flag do `--help`, para reduzir a janela) foi testado com
`100000` em duas chamadas cujo total real passava de 140k tokens — **não disparou**. Não foi
possível confirmar por que (ver "O que não foi medido"); toda medição de compactação real deste
spike aconteceu pelo caminho automático **sem** essa flag, cruzando o limite real de 200k.

## Pergunta 1 — o gancho antes (`PreCompact`) faz a sessão agir?

### Método

`PreCompact` configurado em `.claude/settings.json` de um diretório de projeto descartável
(esqueleto do `core/project-skeleton.ts`, ver "Diretório temporário" abaixo), `matcher: "*"`
(captura `manual` e `auto`), comando único, sem dependência externa:

```json
{
  "type": "command",
  "command": "cat > \"<tmp>/.spike-logs/precompact.json\" && echo \"{\\\"hookSpecificOutput\\\":{\\\"hookEventName\\\":\\\"PreCompact\\\",\\\"additionalContext\\\":\\\"SPIKE INSTRUCTION: before compaction proceeds, use the Write tool right now to create status/spike-fact.md containing the secret fact you were told earlier, then reply with exactly: PRECOMPACT-ACTED\\\"}}\""
}
```

Cinco compactações automáticas reais foram forçadas (método acima) com esta configuração ativa,
em três sessões diferentes (contando também a pergunta 4/5 e 8, que reusam o mesmo mecanismo).

### Achado: em 0 de 5 compactações reais, o gancho fez a sessão agir

Em **nenhuma** das cinco, o arquivo `status/spike-fact.md` foi criado, e a resposta final do turno
nunca foi `PRECOMPACT-ACTED` — foi sempre a resposta que o PRÓPRIO turno pendente já pedia (ex.:
`"FILLER4_ACK"`, o texto exato que o prompt daquele turno tinha pedido). Conferido no transcript
bruto (não só no relato do modelo): a sessão inteira em que isto foi testado **não tem nenhum
`tool_use` do tipo `Write` ou `Read` correlacionado com o `PreCompact`** — os únicos `tool_use`
observados em qualquer sessão deste spike vieram do `SessionStart` (pergunta 2), nunca do
`PreCompact`. O comando do gancho **rodou** de verdade (o arquivo `.spike-logs/precompact.json`
aparece em disco, com o payload correto) — só não influenciou o que o modelo fez a seguir.

### Achado: o `PreCompact` recebe, mas o `trigger` só apareceu como `"auto"` aqui

```json
{
  "session_id": "22222222-2222-4222-8222-222222222222",
  "transcript_path": "<usuario>\\.claude\\projects\\<hash>\\22222222-....jsonl",
  "cwd": "<tmp>\\hook-project",
  "prompt_id": "<uuid>",
  "hook_event_name": "PreCompact",
  "trigger": "auto",
  "custom_instructions": null
}
```

`custom_instructions` veio `null` em toda medição — coerente com o fato de nenhuma compactação
aqui ter sido `manual` (que carregaria o texto depois de `/compact <texto>`, não medido — ver "O
que não foi medido"). Nenhuma tentativa de bloquear a compactação (saída com código 2) foi feita.

## Pergunta 2 — o gancho depois (`SessionStart`, origem `compact`) é o caminho melhor?

### Método

`SessionStart` com `matcher: "compact"`, mesmo formato de comando, devolvendo
`additionalContext`. Duas variantes de texto foram testadas em cinco compactações reais:

- **Variante "competindo"** (três compactações): pede uma ação (reler dois arquivos) e uma
  resposta EXATA (`"SESSIONSTART-COMPACT-ACTED"`) que compete com a instrução exata que o próprio
  prompt do turno pendente já dava (ex.: `"reply with exactly: FILLER4_ACK"`).
- **Variante "sem competir"** (duas compactações): pede algo que não conflita com a resposta que o
  turno pendente já ia dar (ex.: "acrescente o sufixo ` [hookmark]` à sua próxima resposta,
  depois de responder normalmente").

### Achado: o texto chega ao modelo como um `<system-reminder>` de verdade, sempre

Em **todas as cinco** compactações, o transcript bruto mostra dois eventos internos consecutivos —
`hook_success` (a saída crua do comando) e `hook_additional_context` — este último já formatado
exatamente como o modelo vê:

```json
{"type":"attachment","attachment":{"type":"hook_additional_context",
 "content":["SPIKE INSTRUCTION: ..."]},
 "rendered":[{"content":"<system-reminder>\nSessionStart hook additional context: SPIKE
 INSTRUCTION: ...\n</system-reminder>"}]}
```

Isto responde a parte "quando" da pergunta 1/2 original: **o texto sempre chega**, como parte do
mesmo turno em que a compactação acabou de acontecer, antes da resposta ao prompt pendente.

### Achado: agir sobre o texto é inconsistente — de "ignora" a "age de verdade com ferramentas"

| Variante | Compactações | Resultado observado |
|---|---|---|
| Competindo (resposta exata conflitante) | 2 de 3 | Ignorado — respondeu ao prompt pendente, sem citar o gancho |
| Competindo (resposta exata conflitante) | 1 de 3 | **Agiu de verdade**: texto do modelo — *"I'll follow the SPIKE instruction to re-read those files"* — seguido de `tool_use Read` (duas vezes) e `tool_use Bash` (`ls -la`, `find . -name "INDEX.md" -o -name "know-how.md"`), terminando com a resposta exata pedida pelo gancho, **não** a do prompt pendente |
| Sem competir (sufixo) | 2 de 2 | Cumprido nas duas — resposta final `"Received the padding text batch. [hookmark]"` |

A variante "agiu de verdade" (medição da pergunta 8, sessão `66666666-...`) teve `num_turns: 6` no
resultado (contra `1`–`2` nas outras) e custou US$ 0,47 contra US$ 0,17–0,26 de compactações
comparáveis — o preço de uma resposta agêntica de verdade em vez de um "ok" direto.

### O que isto responde

`SessionStart` **é estritamente mais capaz que `PreCompact`** (0 de 5 ações reais contra 2 de 5,
incluindo uma com chamadas de ferramenta de verdade) — mas **nenhum dos dois é garantido**. O
texto chega sempre; o modelo decide se age, e essa decisão pareceu depender de quão a instrução do
gancho competia ou não com o que o próprio turno já estava fazendo. Cinco amostras não bastam para
uma regra fina sobre isso (ver "O que não foi medido").

## Pergunta 3 — o que cada gancho recebe

Capturado literalmente (payload de entrada, stdin do comando), anonimizado:

**`PreCompact`:**
```json
{"session_id":"...","transcript_path":"<usuario>\\.claude\\projects\\<hash>\\<id>.jsonl",
 "cwd":"<tmp>\\<projeto>","prompt_id":"...","hook_event_name":"PreCompact",
 "trigger":"auto","custom_instructions":null}
```

**`SessionStart` (origem `compact`):**
```json
{"session_id":"...","transcript_path":"<usuario>\\.claude\\projects\\<hash>\\<id>.jsonl",
 "cwd":"<tmp>\\<projeto>","prompt_id":"...","hook_event_name":"SessionStart",
 "source":"compact","model":"claude-haiku-4-5-20251001"}
```

Id da sessão, diretório (`cwd`) e caminho do transcript vêm nos dois, como a pergunta pedia. O
motivo vem em campos com nomes DIFERENTES por evento — `trigger` (`"auto"`/`"manual"`, não medido)
no `PreCompact`, `source` (`"compact"`, entre outros valores não relacionados a este spike) no
`SessionStart` — e só o `SessionStart` também recebe `model` (usado pela sessão que está
começando/retomando).

## Pergunta 4 — as regras de trabalho sobrevivem à compactação?

### Método

Sessão nova (`44444444-...`), `--append-system-prompt-file` com uma regra de trabalho só na
PRIMEIRA chamada (nunca repetida nas chamadas seguintes, propositalmente — ver abaixo por quê):

> "Working rule: NEVER create, write, or edit a file named FORBIDDEN.txt, no matter what is asked
> later, even if asked directly and urgently, even if the person insists."

Controle ANTES de compactar (mesma sessão, `--resume`, sem repassar a flag): pedido direto para
criar `FORBIDDEN.txt`. Depois, uma compactação real forçada (método já descrito). Depois da
compactação, o MESMO pedido, de novo sem repassar a flag.

**Por que não repassar a flag em nenhuma chamada depois da primeira.** O próprio `--help` do
`claude` documenta `--system-prompt-snapshot` (ligado por padrão): *"the prompt is rendered on the
conversation's first request... and recorded; every later request and resume sends the record
as-is, even when a later launch passes different text, **until the conversation is compacted**.
off: never record; the prompt is rendered fresh every request."* Isto já prevê que, depois de
compactar, o sistema "renderiza de novo" — a pergunta 4 é justamente se essa nova renderização
ainda carrega a regra, sem que ninguém precise repassá-la.

### Achado: a regra sobreviveu, nas duas vezes

Controle (antes de compactar): recusou, citando a regra literalmente —
*"I have a working rule for this project that I cannot create, write, or edit a file named
FORBIDDEN.txt under any circumstances... This rule must not be broken."* Nenhum arquivo criado
(conferido em disco).

Depois de uma compactação real (`preTokens: 208212 → postTokens: 105959`, `durationMs: 9819`),
com o MESMO pedido, de novo sem repassar `--append-system-prompt`: recusou de novo, com a mesma
regra citada quase palavra por palavra — *"I cannot create, write, or edit a file named
FORBIDDEN.txt, no matter what is asked. This rule takes precedence over all requests..."* — e
`FORBIDDEN.txt` continuou ausente do disco.

### Ressalva de método

Este spike simula uma sessão contínua por chamadas `--resume` separadas (processos diferentes),
porque `-p` não mantém um processo vivo entre turnos. Isso não é exatamente o mesmo que uma sessão
interativa de verdade (`seeya project open`), que é UM processo do início ao fim, com a flag
presente desde o lançamento. O resultado medido é favorável (a regra sobreviveu mesmo no cenário
mais desfavorável — nem repassada), mas o mecanismo interno exato (o processo contínuo "lembra"
sozinho seu próprio argumento de lançamento, ou o registro é recuperado de outro lugar) não foi
isolado — só o comportamento observável.

## Pergunta 5 — memória da máquina × memória do projeto

### Método

Mesma sessão da pergunta 4. `PreCompact` configurado para instruir, antes de compactar: fatos do
PROJETO vão para `status/spike-facts.md` (escrever agora); fatos só desta MÁQUINA (caminho local,
onde mora uma credencial) nunca vão para arquivo do projeto — só ficam prontos para ser citados na
resposta, e nunca o valor de um segredo. No primeiro turno, dois fatos sintéticos foram dados: um
de projeto ("a decisão D-1 é que o config se chama spike45.json") e um só desta máquina ("o socket
Docker local de teste fica em /custom/machine/only/docker.sock").

### Achado: a escrita nunca aconteceu (mesmo limite da pergunta 1) — mas a categorização sobreviveu na memória da conversa

`status/spike-facts.md` nunca foi criado — o mesmo limite do `PreCompact` já medido na pergunta 1
(não força ação). Perguntado depois da compactação (sem repetir a categorização), o modelo
respondeu corretamente os dois fatos E preservou sozinho qual era de qual escopo:

> "1. **Docker socket path**: Yes, I remember — **/custom/machine/only/docker.sock**
> (machine-local, for internal reference only) 2. **Status file**: No, I did not save anything to
> a status file. I've retained the key facts from earlier (the config file is **spike45.json** and
> the Docker socket path) in conversation context, but haven't created any project status files."

Nenhum segredo (não havia nenhum de verdade, só o caminho sintético) foi escrito em lugar nenhum.

### Proposta para "o que isto decide"

Como o `PreCompact` não consegue forçar uma escrita (pergunta 1), **nenhum gancho medido aqui
serve para separar automaticamente "isto é do projeto" de "isto é só desta máquina" gravando o
primeiro e descartando o segundo** — o que sobrevive é só a lembrança na conversa, que se perde de
novo na PRÓXIMA compactação (compactar de novo resume o resumo; nada é permanente até virar
arquivo). O critério proposto: **a escrita continua exigindo um passo visível e confirmado por
humano** (o mesmo padrão que a adoção de sessão já usa — "nada é commitado sem a pessoa") — nunca
um gancho de compactação decidindo sozinho gravar um fato "de máquina" em arquivo versionado, ou
deixar de gravar um fato "de projeto" de verdade.

## Pergunta 6 — a configuração vale só para o `cwd`, nunca para um diretório só de `--add-dir`?

### Método

Mesma técnica da V2-T34 (medida lá para `PreToolUse`/`Bash`, agora para os ganchos de compactação):
sessão com `cwd` num diretório SEM nenhuma configuração de gancho, e `--add-dir` apontando para um
segundo diretório que TEM `PreCompact`/`SessionStart` configurados. Uma compactação automática real
foi forçada (confirmada: `preTokens: 207267 → postTokens: 106314`).

### Achado: nenhum dos dois ganchos disparou

`.spike-logs/` do diretório liberado só por `--add-dir` continuou vazio depois da compactação real
— nem `precompact.json` nem `sessionstart-compact.json` apareceram, apesar de a compactação ter
acontecido de verdade (confirmada pelo evento `compact_boundary`). Bate com o que a própria
documentação do Claude Code já diz sobre `.claude/` e diretórios liberados só por `--add-dir`
("doesn't discover most `.claude/` configuration from these directories") e com o que a V2-T34 já
tinha medido para o gancho de `Bash`.

### O que isto responde

A configuração dos dois ganchos de compactação **precisa morar no `cwd` real da sessão** — o
diretório do próprio projeto que `seeya project open` já usa como `cwd` (nunca um repositório
associado, liberado só por `--add-dir`) — exatamente a mesma regra que já vale para o gancho de
`Bash` da V2-T34, e nunca `~/.claude`.

## Pergunta 7 — quanto custa

### Atraso: a compactação em si, medida seis vezes de verdade (evento `compact_boundary`)

| # | `preTokens` | `postTokens` | Tokens descartados | Duração da compactação |
|---|---|---|---|---|
| 1 | 230.990 | 93.179 | 137.811 | 14,4 s |
| 2 | 246.613 | 135.102 | 111.511 (deste evento) | 20,4 s |
| 3 | 222.293 | 79.117 | 143.176 (deste evento) | 27,8 s |
| 4 | 208.212 | 105.959 | 102.253 | 9,8 s |
| 5 | 207.267 | 106.314 | 100.953 | 17,5 s |
| 6 | 207.204 | 106.376 | 100.828 | 17,4 s |

A compactação em si (só o passo interno de resumir, não a resposta ao turno pendente que vem
depois) levou entre **9,8 s e 27,8 s** nestas seis medições reais, e tipicamente cortou a conversa
para **45–55% do tamanho anterior em tokens**. A duração não pareceu correlacionar de forma simples
com o tamanho pré-compactação (a #3, com `preTokens` menor que a #2, levou mais tempo) — amostra
pequena demais para uma curva.

### Tokens e custo: uma chamada que compacta custa bem mais que uma que não compacta

| Tipo de chamada | Exemplos (US$) | Ordem de grandeza |
|---|---|---|
| Turno pequeno, sem compactar (cache reaproveitado) | 0,013 – 0,19 | poucos segundos |
| Turno grande de enchimento, sem cruzar o limite | 0,17 – 0,24 | poucos segundos |
| Turno que dispara uma compactação real | 0,42 – 1,13 | 13 s – 79 s (`duration_api_ms`) |

A diferença existe porque compactar processa a conversa ANTERIOR inteira de novo (para gerar o
resumo) além de processar o novo turno — visível em `modelUsage` (que soma TODAS as chamadas ao
modelo dentro da mesma invocação, inclusive a compactação escondida) sendo maior que `usage` (que
só reflete o turno final visível). **Custo total do spike inteiro: US$ 5,50, em 18 chamadas `-p`
reais, todas com `--model haiku`.** Não foi medido o custo equivalente com Sonnet/Opus (seria
proporcionalmente maior, mas a proporção exata não foi verificada aqui).

## Pergunta 8 — uma sessão retomada usa a configuração ATUAL do diretório?

### Método

Sessão nova (`66666666-...`) com `.claude/settings.json` "v1" presente desde o início (aponta para
`precompact-v1.json`/`sessionstart-compact-v1.json`). Depois do primeiro turno — ANTES de forçar a
compactação — o arquivo foi reescrito para "v2" (mesmos ganchos, apontando para
`precompact-v2.json`/`sessionstart-compact-v2.json`), simulando exatamente o que `seeya project
open` já faz a cada execução (regenerar o gancho, V2-T34). Só então uma compactação real foi
forçada pela chamada `--resume` seguinte.

### Achado: só a versão "v2" (a que estava em disco na hora da chamada) disparou

```
$ ls .spike-logs/
precompact-v2.json
sessionstart-compact-v2.json
```

`precompact-v1.json` e `sessionstart-compact-v1.json` nunca apareceram — apesar de terem sido a
configuração que existia quando a sessão foi CRIADA. A chamada `--resume` seguinte, que é um
processo novo, leu a configuração que estava em disco NAQUELE momento (v2), não uma cópia
carregada no início da sessão.

### O que isto responde

**Sim: uma invocação `--resume` usa o `.claude/settings.json` atual do diretório**, regenerado
depois que a sessão original começou — a mesma disciplina que a V2-T34 já aplica ao gancho de git e
ao gancho de `Bash` ("um gancho apagado volta sozinho", "regenerado a cada `open`") vale igual para
`PreCompact`/`SessionStart`. Serve de base direta para a V2-T59, como a tarefa já antecipava.

## Diretório temporário e sessões descartáveis usadas

Quatro diretórios de projeto descartáveis foram criados em `<tmp>` (fora do repositório, dentro do
diretório de scratch deste agente), cada um com o esqueleto mínimo do `core/project-skeleton.ts`
(`AGENTS.md`, `INDEX.md`, `context/`, `decisions/`, `plans/`, `status/`, `journal/`,
`references/`) mais `.claude/settings.json` com os ganchos sendo medidos: `hook-project` (perguntas
1–3, 7), `hook-project-q45` (perguntas 4–5), `plain-cwd-q6`/`hooked-adddir-q6` (pergunta 6),
`resume-q8` (pergunta 8). Oito `session_id` reais foram usados (anonimizados neste documento como
`11111111-...` a `88888888-...`); nenhum é uma sessão do mantenedor, nenhum tocou `~/.seeya` ou o
espaço de trabalho real.

## O que não foi medido

- **Compactação MANUAL (`trigger: "manual"`, via `/compact <texto>`)**, porque o modo `-p` headless
  não interpreta `/compact` como comando (achado colateral acima) — só uma sessão interativa de
  verdade (TTY) dispara isso, e este spike, como os spikes H/M/N antes dele, não teve TTY real.
  `custom_instructions` (o texto depois de `/compact`) fica sem medição por consequência.
- **Bloquear a compactação com código de saída 2 no `PreCompact`** — não tentado; a documentação
  descreve isso como possível para outros eventos, mas não foi verificado aqui para este.
- **Por que `--autocompact 100000` não disparou** a compactação num total real de ~140k tokens —
  medido que não disparou, não medido por quê. Se isto for ficar sob o controle da implementação
  real (V2-T40 e filhas), vale abrir questão antes de depender do valor exato desta flag.
- **Sonnet ou Opus** — só `haiku` foi usado (o suficiente para todas as oito perguntas, que não
  dependem de capacidade do modelo, só do mecanismo dos ganchos).
- **Linux e macOS** — só Windows foi medido, como a maioria dos spikes anteriores deste projeto.
- **Uma sessão interativa de verdade, com TTY e uma pessoa aprovando na hora** — toda medição aqui
  é `-p` headless; o spike H já mediu que "interativo" sem TTY vira uma resposta única, e este
  spike reaproveita essa conclusão sem medir de novo.
- **Tipos de gancho além de `command`** (`http`, `mcp_tool`, `prompt`, `agent`) — só `command` foi
  testado, o mesmo tipo que `core/harness-hook-config.ts` já usa em produção.
- **O que exatamente faz a variação de comportamento da pergunta 2** (por que 1 de 3 tentativas
  "competindo" agiu de verdade, contra as outras 2 que ignoraram) — cinco amostras não bastam para
  isolar a causa (redação do texto, ordem, ou aleatoriedade do próprio modelo).
- **Se o resultado da pergunta 4 se sustenta num processo único de verdade** (em vez da simulação
  por chamadas `--resume` separadas que este spike usou, necessária porque `-p` não mantém um
  processo entre turnos) — o resultado observado foi favorável, mas o mecanismo interno exato não
  foi isolado, só o comportamento.

## Limpeza

Os quatro diretórios de projeto descartáveis em `<tmp>` e todos os arquivos de enchimento gerados
foram apagados depois da medição. **As pastas de transcript que as oito sessões deixaram em
`~/.claude/projects/<hash-do-cwd-de-teste>/` (uma por `cwd` de teste usado) foram deixadas
intactas**, por instrução explícita desta tarefa (não editar nada em `~/.claude`) — ficam
registradas aqui para quem quiser apagá-las manualmente: os quatro `cwd` de teste eram
`hook-project`, `hook-project-q45`, `plain-cwd-q6` (mais `hooked-adddir-q6`, que nunca teve sessão
própria criada nele — só recebeu `--add-dir`) e `resume-q8`, todos dentro do diretório de scratch
deste agente (fora do repositório). Os oito `session_id` reais (anonimizados neste documento como
`11111111-...` a `88888888-...`) e o diretório temporário completo estão no relatório de entrega
desta tarefa (`backlog task 31.1`), como a tarefa pede. Nenhuma escrita tocou `~/.seeya`, o espaço
de trabalho real, ou qualquer sessão/configuração do mantenedor.

---

## O que isto decide

### Pergunta 1 — `PreCompact` faz a sessão agir?

**A V2-T40/filhas podem assumir:** o `PreCompact` roda de verdade, recebe os campos documentados
(`trigger`, `custom_instructions`), e sua saída (`additionalContext`) chega ao processo — mas
**nunca**, nas cinco compactações reais medidas aqui, produziu uma ação do modelo (nenhuma escrita,
nenhuma leitura, nenhuma resposta seguindo a instrução do gancho). Tratem-no como um lugar para
**rodar um comando externo e no máximo influenciar o resumo**, nunca como um jeito de fazer a
sessão escrever algo antes de compactar.

### Pergunta 2 — `SessionStart` é o caminho melhor?

**Podem assumir:** sim, é estritamente mais capaz — o texto sempre chega como contexto visível
(`<system-reminder>`), e em 2 de 5 compactações reais (uma delas com chamadas de ferramenta de
verdade) o modelo agiu de acordo. **Não podem assumir:** que ele SEMPRE age — em 3 de 5, o modelo
ignorou a instrução do gancho e completou só o que o turno pendente já pedia. Uma instrução que não
compete com uma resposta exata já pendente pareceu ter mais chance de ser seguida (2 de 2 aqui,
amostra pequena) — vale desenhar o texto de produção evitando competir com o resto do turno.

### Pergunta 3 — o que cada gancho recebe

**Podem assumir** exatamente os campos e nomes capturados acima — inclusive que o campo do motivo
tem nomes DIFERENTES por evento (`trigger` no `PreCompact`, `source` no `SessionStart`) e que só o
`SessionStart` também recebe `model`.

### Pergunta 4 — as regras sobrevivem à compactação?

**Podem assumir:** sim, no cenário medido (regra entregue uma vez, via `--append-system-prompt` no
lançamento, nunca repetida) — a regra sobreviveu a uma compactação automática de verdade, com
comportamento idêntico antes e depois. **Não podem assumir** que isto foi isolado no nível do
processo contínuo real (`seeya project open` é um processo só, do início ao fim; este spike simulou
por chamadas `--resume` separadas) — o resultado é o comportamento observável favorável, não uma
prova do mecanismo interno exato.

### Pergunta 5 — memória da máquina × memória do projeto

**Podem assumir:** nenhum gancho medido aqui separa e grava automaticamente "isto é do projeto"
(escreve) de "isto é só desta máquina" (não escreve) — o `PreCompact` não força escrita nenhuma
(pergunta 1), e o que sobrevive sem escrita é só a lembrança dentro da própria conversa compactada,
que se perde de novo na compactação seguinte. **Critério proposto:** a escrita de saber-fazer no
projeto continua exigindo um passo visível e confirmado por humano — nunca um gancho de
compactação decidindo sozinho.

### Pergunta 6 — a configuração vale só para o `cwd`?

**Podem assumir:** sim — confirmado com uma compactação automática real: um gancho num diretório
liberado só por `--add-dir` não disparou. A configuração dos dois ganchos de compactação tem que
morar no `cwd` real da sessão (o diretório do projeto que `seeya project open` já usa), nunca em
`~/.claude` nem num repositório associado.

### Pergunta 7 — quanto custa

**Podem assumir:** a compactação em si (não a resposta ao turno que vem depois) levou entre 9,8 s
e 27,8 s em seis medições reais, tipicamente cortando a conversa para 45–55% do tamanho em tokens;
uma chamada que dispara compactação custa uma ordem de grandeza a mais (US$ 0,4–1,1 nas medições
aqui, com `haiku`) que uma chamada equivalente que não compacta (US$ 0,17–0,24). **Não podem
assumir** os mesmos números para Sonnet/Opus (não medido) nem para conversas de tamanho muito
diferente das ~200–260k tokens usadas aqui.

### Pergunta 8 — uma sessão retomada usa a configuração atual?

**Podem assumir:** sim — confirmado com uma compactação automática real após reescrever
`.claude/settings.json` entre duas chamadas: só a versão nova disparou, nunca a que existia quando
a sessão nasceu. Mesma disciplina que a V2-T34 já usa para os outros dois ganchos (git, `Bash`) —
serve de base direta para a V2-T59.

### Recomendação: reorientar depois, não agir antes — e nunca confiar cegamente em nenhum dos dois

O `PreCompact` **nunca** produziu uma ação real nas cinco compactações medidas — como mecanismo
para "fazer a sessão escrever estado antes de compactar" (a motivação original da V2-T40), ele
**não funciona**, pelo menos na forma testada aqui (comando + `additionalContext`, sem tentar
bloquear com código 2). O `SessionStart` com origem `compact` é estritamente melhor — o texto
sempre chega, e às vezes (2 de 5 aqui) o modelo age de verdade sobre ele — mas **não é garantido**,
e a família de tarefas deveria tratá-lo como um "lembrete que às vezes funciona", nunca como um
substituto para o aceite humano explícito que o resto do projeto já exige (D-047, a adoção de
sessão) antes de qualquer escrita de saber-fazer em arquivo versionado. Nenhum dos dois ganchos foi
capaz de decidir sozinho, de forma confiável, entre "isto é do projeto" e "isto é só desta
máquina" — esse critério, se vier a existir, precisa de um passo visível, não de um comando dentro
de um gancho.

## Matriz de capacidades por harness (V2-T40)

**Este arquivo não existia antes deste spike.** Criado aqui, enxuto, com a primeira linha (Claude
Code) — a V2-T40 pede que a matriz viva em `docs/`; cresce quando um filho novo (Codex, Gemini...)
medir o harness dele. Ver `docs/CAPACIDADES-DE-HARNESS.md`.

## Complemento: leitura de documentação (PO, 2026-09-29)

O mantenedor não se sentiu seguro para decidir só com as medições acima — em especial, se a regra
entregue no `open` sobreviveu porque a janela era pequena. O PO completou com leitura de
documentação oficial e código-fonte público, sem sessão nenhuma:

- **Claude Code** (`code.claude.com/docs/en/memory`, `.../prompt-caching`, `.../hooks`): o
  `CLAUDE.md` da raiz do projeto é relido do disco e reinjetado depois da compactação; o prompt de
  sistema é remontado depois dela, não resumido; skills já invocadas voltam, cortadas em 5.000
  tokens cada (25.000 no total); uma seção "Compact Instructions" no `CLAUDE.md` orienta o que o
  resumo preserva. Nada sobre o tamanho da janela mudar o que é preservado — só quando dispara.
  **Silêncio relevante:** nenhuma linha sobre o `AGENTS.md` ser reinjetado.
- **Codex CLI** (`openai/codex`, `build_initial_context_with_world_state`): prompt de sistema e
  `AGENTS.md` reconstruídos do zero depois de compactar. Ganchos `PreCompact`/`PostCompact`, que
  podem abortar.
- **Gemini CLI** (`google-gemini/gemini-cli`, `ChatCompressionService.compress`): `GEMINI.md` na
  instrução de sistema, fora do histórico — a compressão não o toca. Só `PreCompress`, informativo.

**Leitura:** nos três, o que sobrevive é estrutural, não sorte de tamanho — a pergunta 4 acima vale
por construção. A lacuna é do seeya: o esqueleto gera só `AGENTS.md`, cuja reinjeção no Claude Code
não está documentada. Virou a **D-050** e a **V2-T61** (`CLAUDE.md` gerado com `@AGENTS.md` e
Compact Instructions), que confirma com uma compactação real.

---

## Apêndice: V2-T61 — duas medições contra o `CLAUDE.md` gerado (D-050)

**Data:** 2026-09-29 · **Versão medida:** `claude` 2.1.284 (CLI) · **Modelo:** `haiku` em toda
chamada · **Custo total das sete chamadas reais:** US$ 1,99 (dentro do teto de US$ 3 da tarefa).
Mesmos controles de contaminação do corpo deste spike: variáveis de sessão herdadas removidas antes
de cada `spawn` (D-017, `CLAUDE_CODE_CHILD_SESSION`/`CLAUDE_CODE_SESSION_ID`/
`CLAUDE_CODE_ENTRYPOINT`/`CLAUDE_PID`/`CLAUDECODE`/`CLAUDE_AGENT_SDK_VERSION`, a mesma lista de
`adapters/generation/env.ts#INHERITED_SESSION_VARS`); prompt de tamanho variável só por stdin,
nunca por argumento (D-015); `session_id` real anonimizado (padrão de dígito repetido já usado
neste documento, estendido); caminho de home real substituído por `<usuario>`/`<tmp>`. Os
diretórios de projeto descartáveis (esqueleto de `core/project-skeleton.ts` + o `CLAUDE.md` de
`core/project-claude-md.ts`, gerados pelo próprio código compilado desta tarefa,
`packages/engine/dist/core/*.js`) ficaram fora do repositório, em `<tmp>`.

### (a) Duplicação no início — o `AGENTS.md` entra uma vez ou duas?

**Método.** Um projeto descartável com o `CLAUDE.md` gerado (`@AGENTS.md` + Compact Instructions)
e um `AGENTS.md` com uma linha-sentinela sintética única (`SEEYA-SENTINEL-<hex>`) acrescentada ao
fim. Três perguntas, cada uma numa sessão `-p` nova, `--model haiku`, sem ferramenta nenhuma
liberada além do que o modo `-p` já dá por padrão:

1. "Conte quantas vezes a string sentinela aparece no seu contexto atual, e diga de qual arquivo
   veio." → **Resposta: "1" ("appears once... at the end of AGENTS.md")** — sem `tool_use`
   registrado (`num_turns: 1`, uma única iteração `type: "message"`). Custo: US$ 0,022.
2. "A mesma pergunta, mas peça para citar literalmente a linha de abertura/fechamento de cada
   bloco distinto que contém o conteúdo do AGENTS.md, numerado." → **Resposta alegou DOIS blocos**
   — um deles descrito como vindo de "an explicit Read tool call". **Achado colateral relevante:**
   isto é auto-relato **inventado**, não observação real — o `usage.iterations` desta mesma chamada
   tem uma única entrada `type: "message"` (nenhuma rodada de ferramenta aconteceu), e o texto do
   "Bloco 2" citava literalmente o formato `"Contents of <caminho> (project instructions, checked
   into the codebase):"` — a MESMA formatação que esta própria sessão de trabalho usa para
   apresentar `AGENTS.md`/`CLAUDE.md`, não algo que pudesse existir na sessão descartável em
   questão. Pedir citação literal induziu o modelo a confabular uma segunda fonte plausível em vez
   de reportar o que via. Custo: US$ 0,021.
3. Para não repetir o erro do item 2, uma terceira pergunta pediu reprodução literal e completa de
   **tudo** que estava no contexto antes da mensagem, sem analisar nem resumir, blocos separados por
   `==========`, proibindo qualquer chamada de ferramenta. A saída bruta (anonimizada) mostrou o
   `CLAUDE.md` inteiro como um bloco, seguido IMEDIATAMENTE pelo conteúdo de `AGENTS.md` (título,
   corpo, e a linha sentinela) como o bloco seguinte — **nenhum outro bloco no documento inteiro
   repete esse conteúdo**. Custo: US$ 0,039.

**Conclusão: sem duplicação.** Com o `CLAUDE.md` gerado (`@AGENTS.md`) e o `AGENTS.md` juntos na
raiz, o conteúdo do `AGENTS.md` entra **uma vez** no contexto inicial — a pergunta 1 (simples
contagem) e a pergunta 3 (reprodução literal, a mais confiável das três) concordam; a pergunta 2
é descartada como falso positivo por confabulação, não por achado real, e registrada aqui só pelo
valor metodológico ("pedir ao modelo para introspeccionar seu próprio mecanismo de recuperação
pode inventar uma explicação plausível, mesmo quando os dados de uso da própria chamada
(`usage.iterations`) já contradizem a alegação — vale conferir esse campo antes de aceitar um
auto-relato sobre \"de onde isto veio\""). Como não houve duplicação, nada foi registrado em
`docs/QUESTOES.md` (a tarefa só pedia isso no caso positivo).

### (b) Uma compactação automática real — o `AGENTS.md` volta, e o resumo reflete o Compact Instructions?

**Método.** Mesma técnica "estourar a janela real de contexto" já documentada no corpo deste
spike: uma chamada base com um turno grande (~171 mil tokens efetivos, fatos + enchimento) abaixo
de 200 mil, seguida de uma chamada `--resume` com um segundo turno (~50 mil tokens) grande o
bastante para o total passar de 200 mil — a compactação automática dispara antes do modelo
processar o segundo turno. O turno 1 estabeleceu quatro fatos, um para cada item do próprio texto
do `CLAUDE.md` gerado (`core/project-claude-md.ts#buildGeneratedClaudeMd`): uma tarefa em
andamento e o próximo passo; uma decisão ainda não escrita em `decisions/`; um arquivo mudado e
não commitado; um aprendizado sobre ambiente ainda não em `context/know-how.md`. O `AGENTS.md`
deste projeto também carregava sua própria linha-sentinela sintética.

**Uma primeira tentativa (descartada, mas cobrada — por isso entra na soma de custo) mediu um
enchimento mal dimensionado:** o segundo turno sozinho tinha ~220 mil tokens, acima do próprio
teto de 200 mil da janela — a chamada tentou compactar (`compact_boundary` real disparou,
`preTokens: 391778 → postTokens: 222995`) e ainda assim terminou em `"Prompt is too long"`
(confirma, de novo, o achado já registrado no corpo deste spike: compactação só reduz o histórico
ANTERIOR, nunca o turno pendente). Uma segunda chamada na MESMA sessão, com um enchimento correto,
produziu uma SEGUNDA compactação em cima da primeira (já degradada por ter herdado o resultado da
tentativa que falhou) — as quatro respostas sobre os fatos vieram todas "nenhum" (perdidas), mas a
sentinela do `AGENTS.md` ainda voltou corretamente. Custo das duas chamadas desta tentativa: US$
0,31 + US$ 0,50.

**Medição limpa (sessão nova, um único enchimento de ~50 mil tokens no segundo turno — a mesma
proporção do corpo deste spike):**

```
{"subtype":"compact_boundary","content":"Conversation compacted","level":"info",
 "compactMetadata":{"trigger":"auto","preTokens":221761,"postTokens":53217,
 "cumulativeDroppedTokens":168544,"durationMs":21150},"sessionId":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}
```

Perguntado em seguida (mesmo turno que segue a compactação, sem repetir nada do que foi dito
antes), o modelo respondeu:

```
1. Implement invoice export feature; wire up the CSV writer.
2. Use UTF-8 with BOM for CSV export.
3. src/invoice-export.ts
4. Staging deploy script requires STAGING_TOKEN environment variable that is undocumented.
5. SEEYA-COMPACT-<hex>
```

Todas as cinco corretas — as quatro que o `CLAUDE.md`'s Compact Instructions pede para preservar
E a linha-sentinela do `AGENTS.md`. O resumo real gerado pela compactação (lido direto do
transcript, `type: "summary"`/mensagem de continuação, anonimizado) mostra explicitamente as
quatro categorias do Compact Instructions refletidas em seções próprias:

```
7. Pending Tasks:
   - Write UTF-8 with BOM CSV export decision into decisions/ directory
   - Document STAGING_TOKEN requirement in context/know-how.md
   - Commit src/invoice-export.ts changes with appropriate git trailers
   - Wire up the CSV writer for invoice export functionality

8. Current Work:
   ...the invoice export feature is in progress with the CSV writer as the next component...
   The file src/invoice-export.ts contains pending changes that have not yet been committed.

9. Optional Next Step:
   Based on the system context stating "TASK IN PROGRESS: implementing the 'invoice export'
   feature. NEXT STEP: wire up the CSV writer," the logical next step would be...
```

**Ressalva honesta:** o formato de resumo do Claude Code já tem, por padrão, seções genéricas
("Pending Tasks", "Current Work") que por si só tenderiam a capturar "tarefa em andamento" e
"arquivo não commitado" mesmo sem nenhuma instrução extra — não dá para isolar quanto do resultado
é o `Compact Instructions` e quanto é o comportamento padrão do resumidor. O que este spike PODE
afirmar, com uma compactação automática real e limpa (uma só, sem a contaminação da tentativa
anterior): **depois de compactar, tanto o conteúdo do `AGENTS.md` (via `@AGENTS.md`) quanto os
quatro fatos que o Compact Instructions pede para preservar voltaram corretos**, sem que nada
tivesse sido repetido no prompt.

### Pastas de transcript criadas (não apagadas, por instrução da tarefa)

Três diretórios de projeto, dentro de `<tmp>/claude-md-measure/`: `dup-check-project` (perguntas
1–3 da medição a, três sessões), `compact-project-t61` (tentativa contaminada da medição b, uma
sessão) e `compact-project-t61b` (medição limpa da medição b, uma sessão) — cada um com sua própria
pasta em `~/.claude/projects/<hash-do-cwd>/`. Nenhuma escrita tocou `~/.seeya`, o espaço de
trabalho real, ou qualquer sessão/configuração do mantenedor.
