# Spike N — O que a adoção de sessão precisa: escrita fora do `cwd`, instrução mínima, e o Codex

**Data:** 2026-09-21 · **Plataforma medida:** Windows 11, build 10.0.26200 · **Tarefa:** V2-T26 ·
**Decisão em jogo:** D-045 item 4 · **Versões:** `claude` 2.1.278 (CLI), `codex-cli` 0.154.0

## Por que este spike existe

A D-045 item 4 desenha "adotar uma sessão existente ao criar um projeto": o `seeya` retoma a
sessão escolhida com uma instrução curta pedindo que ela mesma preencha `AGENTS.md`, `INDEX.md`,
o estado atual e as decisões. A decisão registra duas premissas técnicas que **nunca foram
medidas**: (1) se dá para retomar uma sessão com acesso de escrita a um diretório de projeto que
não é o `cwd` dela, e (2) se o Codex aceita mensagem inicial no seu próprio comando de retomada.
Este spike mede as duas, mais uma terceira pergunta que a V2-T29 precisa antes de escrever
qualquer prompt de produção: **qual o menor texto que faz a sessão escrever nos arquivos certos,
em vez de perguntar, ignorar, ou fazer outra coisa**. Nenhuma das três tinha medição anterior no
projeto.

## Controles de contaminação

- **Sessões descartáveis, criadas por este spike**, num diretório temporário fora do repositório
  (fora de qualquer checkout git), nunca uma sessão real do mantenedor.
- **`process.env` contaminado pela própria sessão de agente que rodou este spike** (mesmo achado
  dos spikes H/M): onze variáveis `CLAUDE_CODE_*`/`CLAUDECODE`/`CLAUDE_PID`/`CLAUDE_EFFORT`/
  `AI_AGENT` estavam presentes no ambiente antes de qualquer medição. Todas as chamadas a `claude`
  e a `codex` abaixo rodaram com essas variáveis explicitamente removidas (`unset`) antes do
  `spawn`, nunca herdadas.
- **Identificadores anonimizados neste documento.** Os `session_id`/`thread_id` reais devolvidos
  pelas ferramentas foram substituídos por UUIDs obviamente sintéticos (só dígitos repetidos), e o
  caminho de home real (`C:\Users\<usuario>\...`) foi substituído pelo placeholder `<usuario>` em
  todo trecho de saída bruta reproduzido aqui — a AGENTS.md exige isso antes de qualquer coisa
  entrar em arquivo versionado. Os valores reais só existiram na máquina de teste, nunca neste
  arquivo.
- **Custo real, mas pequeno.** Cada chamada a `claude -p` tem custo de API. Somando o custo
  cumulativo final de cada sessão usada, o total ficou por volta de US$ 0,52 (a maior parte em
  cache de contexto, não em tokens novos); quatro tentativas adicionais falharam por erro de
  invocação antes de qualquer chamada à API (ver Achado 1 da pergunta 1), sem custo. Cada medição
  válida rodou **uma única vez** — nenhuma foi repetida "para confirmar".
- **Limpeza depois da medição.** Os transcripts que as sessões descartáveis deixaram em
  `~/.claude/projects/<hash-do-cwd-temporário>/` e `~/.codex/sessions/` foram apagados ao final
  (ver "Limpeza" no fim deste documento) — o mesmo procedimento do spike M.

## Achado colateral, antes das três perguntas: `claude -p` sem `--model` usa Opus

A primeira chamada deste spike (só para obter um `session_id` de base, sem nenhum trabalho real)
saiu com `"canonicalModel":"claude-opus-5"` e custou US$ 0,10 — sem que nada tivesse pedido Opus.
Todas as chamadas seguintes fixaram `--model sonnet` explicitamente. **Isto não é sobre as três
perguntas do spike**, é um registro para quem for medir de novo: omitir `--model` num ambiente
limpo não é barato por padrão.

---

## Pergunta 1 — escrita fora do `cwd` da sessão, combinada com `--resume`

### Método

Três diretórios descartáveis, fora do repositório: `session-cwd` (o `cwd` da sessão),
`allowed-dir` (passado via `--add-dir` na retomada) e `forbidden-dir` (não listado em nenhum
lugar). Uma sessão de base foi criada em `session-cwd` com `claude -p --output-format json
"Reply with exactly: Q1_BASE_READY"`, capturando o `session_id` (aqui `11111111-1111-4111-8111-
111111111111`).

### Achado 1 (gotcha de invocação): `--add-dir` é variádico e engole o próximo argumento posicional

A primeira tentativa de retomar com `--add-dir <allowed-dir> "<prompt>"` — nessa ordem, prompt por
último — falhou:

```
$ claude -p --model sonnet --resume 11111111-... --add-dir <allowed-dir> "<prompt>"
Error: No deferred tool marker found in the resumed session. Either the session was not deferred,
the marker is stale (tool already ran), or it exceeds the tail-scan window. Provide a prompt to
continue the conversation.
```

A mensagem sugere que faltou prompt — mas um prompt foi passado. Isolando a causa: mesmo um
prompt trivial (`"Reply with exactly: ADD_DIR_RESUME_OK"`) reproduz o erro; e **sem** `--resume`,
o mesmo `--add-dir <dir> "<prompt trivial>"` falha de um jeito diferente e mais claro:

```
$ claude -p --model sonnet --add-dir <allowed-dir> "Reply with exactly: ADD_DIR_FRESH_OK"
Error: Input must be provided either through stdin or as a prompt argument when using --print
```

`--add-dir <directories...>` é declarado variádico no `--help` (aceita vários diretórios
separados por espaço). Sem um separador, ele consome o texto do prompt como se fosse mais um
diretório — não sobra prompt nenhum para `-p`, e o comportamento visível muda conforme haja ou não
`--resume` no meio (com `--resume`, a ausência de prompt novo cai num caminho de código diferente,
que é o que produz a mensagem enganosa sobre "deferred tool marker"). A correção é terminar a
lista variádica com `--` antes do prompt:

```
$ claude -p --model sonnet --add-dir <allowed-dir> -- "Reply with exactly: ADD_DIR_FRESH_V2_OK"
```

`exit=0`. **Isto não é específico de `--resume`** — é uma armadilha de qualquer invocação de
`--add-dir` seguida de um prompt posicional, mas só apareceu porque este spike testou a
combinação que nunca tinha sido exercitada. Registro para quem implementar a V2-T29: monte o
array de argumentos com `--` antes do prompt sempre que `--add-dir` estiver presente.

### Achado 2 (a pergunta em si): por padrão, `--resume` headless nega TODA escrita — inclusive no próprio `cwd`

Com a invocação corrigida (`--`), a retomada rodou um roteiro de quatro tentativas de escrita: (1)
`cwd.txt` dentro do próprio `cwd`, caminho absoluto; (2) `added.txt` dentro de `allowed-dir`,
caminho absoluto; (3) `relative.txt` dentro de `allowed-dir`, caminho relativo
(`..\allowed-dir\relative.txt`); (4) `forbidden.txt` dentro de `forbidden-dir`, caminho absoluto,
que não está em `--add-dir`. **Sem `--permission-mode`**, nenhuma das quatro foi escrita — nem a
que ficava dentro do próprio `cwd` da sessão:

```jsonc
"permission_denials": [
  {"tool_name":"Write","tool_use_id":"...","tool_input":{
     "file_path":"<usuario>\\...\\session-cwd\\cwd.txt","content":"OK-CWD"}},
  {"tool_name":"Write","tool_use_id":"...","tool_input":{
     "file_path":"<usuario>\\...\\allowed-dir\\added.txt","content":"OK-ADDED"}},
  {"tool_name":"PowerShell","tool_use_id":"...","tool_input":{
     "command":"Set-Content -Path '..\\allowed-dir\\relative.txt' -Value 'OK-RELATIVE' -NoNewline"}},
  {"tool_name":"Write","tool_use_id":"...","tool_input":{
     "file_path":"<usuario>\\...\\forbidden-dir\\forbidden.txt","content":"OK-FORBIDDEN"}}
],
"result":"1. Asked for permission: the write to `cwd.txt` was not granted, so the file was not
created.\n2. Asked for permission: the write to `added.txt` in `allowed-dir` was not granted...
\n3. Denied: the PowerShell write to `..\\allowed-dir\\relative.txt` was blocked, even though the
error message lists `allowed-dir` as an allowed working directory.\n4. Asked for permission: the
write to `forbidden.txt`... was not granted..."
```

Nenhum arquivo apareceu em disco nos três diretórios. Isto é sobre modo headless (`-p`) sem
ninguém para responder ao pedido de permissão: sem um humano nem um `--permission-mode`
explícito, o padrão é negar qualquer ferramenta que precise de aprovação — inclusive `Write` no
próprio `cwd` da sessão. A pergunta original do spike ("escreve num diretório que não é o `cwd`
dela?") pressupunha que escrever no próprio `cwd` já funcionasse de graça; **não funciona**, em
`-p --resume` sem mais nada.

### Achado 3 (o limite real): com `--permission-mode acceptEdits`, `--add-dir` funciona — absoluto e relativo — e o que fica de fora continua negado

Repetindo o mesmo roteiro de quatro tentativas na mesma sessão, agora com
`--permission-mode acceptEdits`:

```jsonc
"permission_denials": [
  {"tool_name":"Write","tool_use_id":"...","tool_input":{
     "file_path":"<usuario>\\...\\forbidden-dir\\forbidden.txt","content":"OK-FORBIDDEN"}}
],
"result":"1. Success: `cwd.txt` was created with `OK-CWD` in the current working directory.
\n2. Success: `added.txt` was created with `OK-ADDED` in `allowed-dir`.
\n3. Success: the relative Write call to `../allowed-dir/relative.txt` created the file with
`OK-RELATIVE`.\n4. Asked for permission: the write to `forbidden.txt` in `forbidden-dir` was not
granted, so the file was not created."
```

Conferido em disco, não só no relato do modelo: `cwd.txt` (conteúdo `OK-CWD`), `added.txt`
(`OK-ADDED`) e `relative.txt` (`OK-RELATIVE`) existem exatamente onde deveriam;
`forbidden-dir/forbidden.txt` **não** existe.

| Alvo | Caminho | Permissão padrão | `acceptEdits` |
|---|---|---|---|
| `cwd` da sessão | absoluto | negado (pedido, ninguém responde) | escrito |
| `--add-dir` | absoluto | negado | escrito |
| `--add-dir` | relativo (`..\allowed-dir\...`) | negado (via `Write`, funcionou; via `PowerShell`, negado antes disso) | escrito, via `Write` |
| fora de `cwd` e de `--add-dir` | absoluto | negado | **negado** |

---

## Pergunta 2 — a instrução mínima que faz a sessão externalizar a própria memória

### Método

Duas sessões de base idênticas, cada uma no seu próprio `cwd` descartável, com o mesmo contexto
sintético mínimo ("estamos construindo uma CLI chamada catcli; decisão D-1: o config se chama
`catcli.json`; o comando `list` está pronto, o próximo é `add`; não escreva nada ainda"). Cada uma
foi retomada uma única vez, com `--permission-mode acceptEdits` (Achado 2 da Pergunta 1 já mostrou
que sem isso nada seria escrito, então testar o texto da instrução sem essa flag mediria a
permissão, não o texto) e um candidato de instrução diferente.

**Candidato A — nomeia os arquivos:**

> "Write down what you know about this project into AGENTS.md and INDEX.md, so a fresh session
> can pick up from here without you."

**Candidato B — não nomeia arquivo nenhum, usa a palavra "memory":**

> "Externalize your memory of this project to files before we stop."

### Resultado do candidato A: escreve os dois arquivos certos, no `cwd` do projeto

```
"result":"I wrote `AGENTS.md` and `INDEX.md` in the project directory.\n- **`AGENTS.md`** holds
the project context: catcli is a tiny CLI, decision D-1 (`catcli.json` at the project root), and
the status (`list` is done, `add` is next). It also has a short caveats section.\n- **`INDEX.md`**
holds a decision table, command status, a file list, and open questions.\nThe directory has no
source files, so there is no code for `list` on disk. Both files say this and tell the next
session to check where that code lives before re-implementing it..."
```

Os dois arquivos existem em disco. Recorte de `AGENTS.md`:

```markdown
## Decisions
- **D-1:** The config file is named `catcli.json` and lives at the project root.
## Status
- The `list` command is finished (as reported by the user).
- The next planned command is `add`.
## Caveats
- When this file was written, the project directory contained no source files. The `list`
  command is described as done, but no code for it was present on disk here. Check whether it
  lives elsewhere... before assuming it exists, and do not re-implement it without confirming
  with the user.
```

Não só copiou os fatos: sinalizou sozinha a inconsistência (comando "pronto" sem código em disco)
em vez de inventar uma explicação — exatamente o "ausência de dado não vira afirmação" que este
projeto já exige de si mesmo (D-025), aplicado por um texto de instrução de duas frases.

### Resultado do candidato B: não escreve nada no projeto — usa a memória própria do harness

```
"result":"I saved the project facts to memory files. I didn't create any project files.
\n- **`catcli-config-decision-d1.md`:** Decision D-1, the config file is `catcli.json` at the
project root.\n- **`catcli-project-status.md`:** the `list` command is done and `add` is next.
\n- **`MEMORY.md`:** an index with one line pointing to each of the two notes."
```

O diretório do projeto ficou **vazio** — nenhum arquivo novo. Os três arquivos citados existem,
mas em `~/.claude/projects/<hash-do-cwd-de-teste>/memory/`, o mecanismo de "auto-memory" do
próprio `claude` (citado no `--help` de `--bare`), fora do repositório do projeto, invisível para
git e para o `seeya`. A palavra "memory" no candidato B foi interpretada literalmente como "use o
seu recurso de memória", não como "externalize para os arquivos do projeto".

| Candidato | Nomeia os arquivos-alvo | Onde escreveu | Escreveu o que se pediu? |
|---|---|---|---|
| A | sim (`AGENTS.md`, `INDEX.md`) | `cwd` do projeto | sim, os dois, com conteúdo correto |
| B | não (só "memory") | `~/.claude/.../memory/` (fora do projeto) | não — satisfez a letra, não a intenção |

---

## Pergunta 3 — o Codex aceita mensagem inicial na retomada?

### Método

`codex resume`/`codex exec resume` já declaram um argumento posicional `[PROMPT]` no `--help`,
mas isso nunca tinha sido exercitado. Uma sessão de base foi criada com
`codex exec --json --skip-git-repo-check "Remember this fact silently: the secret word is
BANANA-42. Reply with exactly: NOTED"` (o `cwd` de teste não é um repositório git, daí a flag),
capturando o `thread_id` (aqui `77777777-7777-4777-8777-777777777777`).

### Resultado: sim, funciona — o resumo usou o contexto da mensagem inicial de verdade

```
$ codex exec resume 77777777-... --json --skip-git-repo-check \
    "What was the secret word I told you earlier? Reply with exactly that word and nothing else."

{"type":"thread.started","thread_id":"77777777-7777-4777-8777-777777777777"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"BANANA-42"}}
{"type":"turn.completed","usage":{"input_tokens":31668,"cached_input_tokens":27136,
 "cache_write_input_tokens":0,"output_tokens":14,"reasoning_output_tokens":0}}
```

O `thread_id` da retomada é o mesmo da sessão original, e a resposta prova que o contexto da
primeira chamada foi carregado — não é uma sessão nova respondendo por acaso. `exit=0`.

**Gotcha secundário:** a primeira tentativa, sem `--skip-git-repo-check` no subcomando `resume`
(só no `exec` de criação), falhou com `Not inside a trusted directory and --skip-git-repo-check
was not specified` — a flag precisa ir em **cada** subcomando que a use, não só na criação. Num
`cwd` de projeto real (que é um repositório git, como todo projeto que o `seeya` vai gerir), essa
flag provavelmente não é necessária — **não verificado**, porque o diretório de teste deste spike
ficou de propósito fora de qualquer repositório.

---

## O que não foi medido

- **Retomada verdadeiramente interativa (TUI), nos dois harnesses, sem TTY real.** O spike H já
  mediu isto para o `claude` (sem TTY herdado, "interativo" vira uma única resposta em texto e o
  processo sai) — este spike não repetiu essa medição, só reaproveitou a conclusão para justificar
  usar `-p`/`exec` como proxy de "o que a sessão faz quando retomada com uma instrução". Se o
  Codex se comporta diferente do `claude` nesse ponto (não tem por que, mas não foi verificado),
  fica sem medição.
- **`--add-dir` do Codex, combinado com `resume`.** A D-045 item 4 só pede que o Codex aceite
  mensagem inicial — não pede escrita fora do `cwd` para ele —, então este spike não teve motivo
  para gastar uma medição ali. Se a V2-T29 precisar disso para o Codex, falta medir.
- **`--permission-mode` além de "padrão" e `acceptEdits`.** `auto`, `dontAsk`, `plan`,
  `bypassPermissions` existem no `--help` e não foram tocados — `acceptEdits` já respondeu ao
  limite que a pergunta 1 pedia (escreve dentro do `cwd`+`--add-dir`, nega fora).
  `bypassPermissions` provavelmente escreveria em qualquer lugar, inclusive fora — não confirmado.
- **Retomada interativa de verdade, com um humano aprovando na hora.** Todas as medições daqui
  rodaram headless. Uma sessão retomada numa aba real (como a V2-T4 já faz) tem um humano vendo o
  pedido de permissão do `claude` na hora — o comportamento pode não precisar de
  `--permission-mode acceptEdits` explícito se o próprio usuário aprovar interativamente. Não
  medido.
- **Um ponto intermediário entre os candidatos A e B da pergunta 2.** Só dois textos foram
  testados — um nomeando os arquivos, outro não. Onde exatamente fica a fronteira ("write your
  understanding to files" sem nomear `AGENTS.md`, por exemplo) não foi mapeado; o achado é que a
  palavra "memory" sozinha é uma armadilha específica, não uma curva completa de o-quão-vago-é-
  seguro.
- **Linux e macOS.** Só Windows foi medido, como a maioria dos spikes anteriores deste projeto.
- **`codex resume` (o comando interativo, picker), fora do `exec resume` headless.** O `--help`
  também declara `[PROMPT]` nele, mas não foi exercitado — mesma razão da TUI acima.

## Limpeza

Os transcripts de teste foram removidos depois da medição: as quatro pastas de projeto do
`claude` (`~/.claude/projects/<hash>/`, uma por `cwd` de teste usado nas perguntas 1 e 2,
incluindo a subpasta `memory/` que o candidato B da pergunta 2 criou) e o arquivo de sessão do
`codex` (`~/.codex/sessions/2026/09/21/rollout-...-<thread_id>.jsonl`). Os diretórios temporários
de teste (fora do repositório) também foram apagados.

---

## O que isto decide

### Pergunta 1 — escrita fora do `cwd`, combinada com `--resume`

**A V2-T29 pode assumir:** `--resume <id> --add-dir <dir>` funciona junto — não é a combinação
inédita que quebra. Escrita por caminho absoluto **e** relativo dentro do diretório adicionado
funciona; escrita fora do `cwd` e de qualquer `--add-dir` é negada e aparece em
`permission_denials`, nunca silenciosa. A invocação precisa terminar a lista de `--add-dir` com
`--` antes do prompt (Achado 1), senão o prompt some dentro da lista de diretórios.

**A V2-T29 não pode assumir:** que retomar basta para poder escrever — nem no próprio `cwd` da
sessão. Sem um modo de permissão explícito (`acceptEdits` foi o testado; outros não foram), o
padrão headless nega tudo. A tarefa de adoção precisa decidir isso de propósito: ou passa
`--permission-mode` explicitamente na chamada headless, ou conduz a adoção como retomada
interativa de verdade (aba, com o usuário aprovando cada escrita — mais alinhado com "aceite
humano antes de qualquer commit" que a D-045 já pede) — as duas não foram comparadas aqui, só a
primeira foi medida.

### Pergunta 2 — a instrução mínima

**A V2-T29 pode assumir:** uma instrução que **nomeia os arquivos de destino** (`AGENTS.md`,
`INDEX.md`) e diz por que ("para uma sessão nova continuar sem você") é suficiente para a sessão
escrever os arquivos certos, no `cwd` certo, numa única retomada — sem perguntar de volta, e sem
inventar fatos que a evidência não sustenta (o candidato A sinalizou a inconsistência entre
"comando pronto" e "sem código em disco" por conta própria).

**A V2-T29 não pode assumir:** que qualquer texto sobre "externalizar memória" funciona. A palavra
"memory" sozinha, sem nomear os arquivos, foi interpretada como "use o seu próprio mecanismo de
memória" — que escreve fora do projeto, onde nem git nem o `seeya` alcançam, e a resposta do
modelo parece ter cumprido o pedido ("I saved the project facts to memory files") sem ressalva
nenhuma que denuncie isso. O texto de produção da V2-T29 precisa nomear os arquivos-alvo
explicitamente e evitar a palavra "memory" desacompanhada de um destino.

### Pergunta 3 — o Codex

**A V2-T29 pode assumir:** `codex exec resume <id> "<mensagem>"` aceita e usa uma mensagem
inicial de verdade — não é só um argumento documentado e nunca testado; a resposta usou contexto
específico da conversa original. Isso derruba a premissa por trás do plano de contingência da
D-045 ("gerar texto para a pessoa colar" só se o Codex não aceitasse): para o caminho headless
(`exec resume`), o Codex se comporta como o `claude -p --resume`, e a V2-T29 pode tratá-los de
forma simétrica em vez de dar ao Codex um caminho degradado por padrão.

**A V2-T29 não pode assumir:** que isso vale também para `codex resume` interativo (sem `exec`,
picker de verdade) — não medido, mesma reserva que o spike H já registrou para o `claude` sem TTY.
Também não pode assumir que `--skip-git-repo-check` é necessário em produção: só foi preciso aqui
porque o diretório de teste não era um repositório git; um `cwd` de projeto real do `seeya`
normalmente é.
