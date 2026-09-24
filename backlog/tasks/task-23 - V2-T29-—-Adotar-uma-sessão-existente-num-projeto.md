---
id: TASK-23
title: V2-T29 — Adotar uma sessão existente num projeto
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-24 20:59'
labels:
  - adocao
  - d-047
milestone: m-0
dependencies:
  - TASK-20
  - TASK-26
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T29 — Adotar uma sessão existente num projeto: a sessão escreve a própria memória, e a
pessoa aprova cada escrita.** Especificada pelo PO em 2026-09-22, implementando a **D-045
item 4**, com três insumos: o spike V2-T26 (`docs/spikes/N-adocao-de-sessao.md`), o relato do
mantenedor sobre o que a compactação apaga (seção "Projetos — o recorte" deste plano), e a
**decisão do mantenedor no mesmo dia**: a sessão é retomada de forma **interativa**, e ele
aprova cada escrita na hora — nunca com permissão automática. O motivo, medido no spike: a
permissão automática vale também para o diretório original da sessão, que pode ser a pasta
pessoal ou um repositório de código, e não só para o projeto.

**Depende da V2-T33 e da V2-T35 (ambas prontas), e segue a D-047:** adotar é **tomar o lock do
projeto** (projeto com lock de outra sessão viva recusa a adoção, com o mesmo texto de aviso da
V2-T35), e os commits da adoção são feitos pelo próprio seeya (`WorkspaceRepository.commitAll`) —
um projeto por commit, com os trailers `Seeya-Project-Id`/`Seeya-Session-Id`. **A V2-T34 (as
guardas de git e do harness) não é pré-requisito**: o mantenedor a moveu para o fim da fila em
2026-09-24, e nada aqui depende dela. Onde esta entrada disser outra coisa, vale a D-047.

**Revisão do PO em 2026-09-24**, antes do despacho: dependência da V2-T34 retirada (acima); o id da
cópia passa a ser escolhido pelo seeya (item 2); a medição em modo interativo passa a ser do aceite
do mantenedor, porque agente não tem terminal real (V2-T35, Q-089); o nome do arquivo de
saber-fazer ficou fixado (item 3).

**Recorte:** esta tarefa é motor e CLI. Adotar pela janela (um botão na lista de sessões,
abrindo numa aba) fica para a **V2-T30**, junto com a lateral agrupada por projeto — o mesmo
modelo de aprovação, outra superfície.

**O que entra:**
1. **`seeya project adopt <sessão> <projectId>`** — a sessão escolhida pelo nome que o
   `seeya sessions` já mostra (nunca exigir o id cru). Se o projeto não existe, é criado como
   na V2-T27; se existe, a adoção escreve nele. Sessão aberta agora (viva) é recusada com uma
   linha: retomar o que está rodando abriria uma segunda cópia.
2. **A adoção roda numa CÓPIA da sessão, nunca na original** (acrescentado pelo PO em
   2026-09-22, a partir do receio do mantenedor: *"uma adoção incorreta, no projeto errado por
   engano... sujando aquela sessão para sempre, ou até corromper o transcript"*). A retomada
   usa `--fork-session`, que o seeya já usa na captura desde a S2-T2: o Claude Code copia o
   transcript para uma sessão nova e **a original não recebe uma linha sequer**. **Corrigido pela D-047 item 6:** o
   fork **não** é descartável quando a adoção é aceita — ele vira a sessão do projeto, porque é
   ele que tem o histórico e sabe o que escreveu; a original fica intocada como ponto de
   restauração e é marcada como já adotada, para não ser adotada de novo. Isso exige separar,
   no registro de forks (D-012), a cópia de captura (descartável, escondida, apagada em
   `forkCleanupDays`) da cópia de adoção aceita (promovida: aparece na descoberta e nunca é
   apagada pelo seeya). Adoção recusada antes do commit: a cópia é apagada e nada fica
   registrado. **O id da cópia é escolhido pelo seeya** (acrescentado em 2026-09-24): a retomada
   passa `--fork-session` **com** `--session-id <id gerado>`, o mesmo par que a captura já usa
   (`adapters/generation/args.ts`, spike J) — e é **esse** id que vai para o `.seeya-lock` e para o
   trailer `Seeya-Session-Id` dos commits da adoção, como o `open` faz desde a V2-T35. Gerar o id
   fica na raiz de composição, como lá. A retomada é
   **interativa**, no diretório original da sessão, com o diretório do projeto liberado por
   `--add-dir` (mesma montagem da V2-T28, com o `--` já provado no aceite dela) e **sem nenhum
   modo de permissão automática** — o Claude Code pede aprovação a cada escrita.
   **Medir antes de implementar, até onde um agente consegue**: o spike mediu `--fork-session` em
   modo automático e `--add-dir` em interativo, **nunca os dois juntos em interativo** — e um
   agente não tem terminal real para medir o modo interativo (achado da V2-T35, Q-089). Então: o
   agente prova com uma sessão descartável, sem terminal, que `--fork-session` + `--session-id` +
   `--add-dir` juntos criam a cópia com o id pedido e deixam o transcript original sem uma linha a
   mais; a confirmação em modo interativo é **o primeiro passo do aceite do mantenedor**. Se lá não
   funcionarem juntos, a tarefa volta — nunca cair de volta na sessão original sem o mantenedor
   decidir.
3. **A instrução**, curta, num lugar só do código (texto voltado à pessoa concentrado, e dentro
   do teto de argumento medido na V2-T7, D-015). O spike mostrou que o texto decide tudo, então
   ela é específica e cobre quatro coisas:
   - **nomear os arquivos pelo caminho**: `AGENTS.md`, `INDEX.md`, o estado atual em
     `status/`, as decisões em `decisions/`, o saber-fazer em `context/know-how.md` — e **nunca** usar a palavra "memória" sem destino
     (a sessão do spike entendeu como a memória do próprio Claude Code e escreveu fora do
     projeto);
   - **o saber-fazer, pelo nome**: como se opera naquele trabalho — ferramentas e skills usadas,
     caminhos de acesso, configuração por ambiente, convenções — em
     **`context/know-how.md`** (nome fixado pelo PO em 2026-09-24; entra no glossário do
     `AGENTS.md` antes do código). É o que o relato do mantenedor
     mostrou que a compactação apaga primeiro;
   - **o caminho, nunca o segredo**: dizer onde está e como se chega (a skill, o arquivo de
     configuração), nunca o valor de credencial, token ou senha;
   - **o que não se sabe fica marcado como incerto**, e nada é escrito fora do diretório do
     projeto.
4. **Nada é commitado sem a pessoa.** Quando a sessão termina, a CLI mostra os arquivos que
   mudaram dentro do projeto e pergunta se commita. Recusando, os arquivos ficam no disco, sem
   commit, e a pessoa pode revisar e commitar depois. É a segunda barreira contra algo sensível
   ir para o repositório — a primeira é a própria instrução.
5. **Só `claude`**, pelo mesmo motivo da V2-T28 (o equivalente ao `--add-dir` no Codex não
   foi medido). O spike mostrou que o Codex aceita mensagem inicial na retomada; quando o
   `--add-dir` dele for medido, entra.

**O que não entra:** adotar pela janela (V2-T30); gancho antes da compactação (candidato a
spike do passo 5); qualquer escrita automática; editar os arquivos que a sessão escreveu.

**Cuidados:** nenhuma dependência nova; o harness passa pela porta `HarnessLauncher` (ou uma
irmã dela), nunca direto do `application/`; ambiente limpo das variáveis de sessão (D-017);
nomes em disco no glossário antes do código. **Nenhum agente retoma uma sessão real do
mantenedor** — a montagem de argumentos, a instrução e o fluxo de aceite do commit se provam
com dublês; se a verificação manual retomar alguma sessão, é uma criada pelo próprio agente,
descartável, e sem gastar tokens à toa (o spike custou cerca de US$ 0,50 medindo o que
precisava).

**Aceite do mantenedor:** adotar uma sessão real dele num projeto novo, aprovar as escritas
que fizerem sentido, e ver o projeto com `AGENTS.md`, `INDEX.md`, estado e o saber-fazer
preenchidos pela própria sessão — e depois abrir o projeto numa sessão limpa (`project open`)
e ver se ela sabe como operar sem ser lembrada.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Relatório do agente (branch `tarefa/V2-T29-adocao`, worktree isolada, a partir da `main`).**

**Fluxo entregue: `seeya project adopt <sessão> <projectId>`.** `packages/cli/src/project-command.ts#runProjectAdoptCommand`
resolve `<sessão>` contra a descoberta real (`resolveSessionReference`, o mesmo casamento
por sessionId/prefixo/nome/cwd que `--session` já usa em `end-day`/`start-day` —
`session-reference.ts#toDiscoveredSessionReference` extraído para ser compartilhado, em vez de
duplicado). `application/project-adopt.ts#adoptSession` então: recusa sessão viva (`alive`/`idle`)
e sessão já adotada (`adoptions.json`); cria o projeto se não existir (reusa `createProject`, nunca
duplicado); toma o lock do projeto sob o id do FORK (mesmo padrão `launchedSessionId` da V2-T35);
registra o fork em `forks.json` ANTES de lançar (D-012, sobrevive a uma queda); lança
`adapters/harness/session-adoption.ts#ClaudeSessionAdoptionLauncher` — `--resume <original>
--fork-session --session-id <id gerado pelo seeya> --add-dir <diretório do projeto>`, interativo,
**sem nenhum `--permission-mode`**, no diretório ORIGINAL da sessão, com a instrução fixa
(`adapters/harness/adopt-instruction.ts#ADOPTION_INSTRUCTION`) como primeiro turno. Ao fechar, lê
`WorkspaceRepository.listChangedFiles` (novo: `git status --porcelain --untracked-files=all`,
escopado a um projeto só) e decide: nada mudou → descarta o fork (apaga o transcript,
`ForkCleanup.deleteFork`, e tira de `forks.json`, `ForkRegistration.unregister`) e reporta
`noChanges`; recusado → mesmo descarte, reporta `declined`; sem terminal para perguntar → **não
toca em nada** (fork continua escondido em `forks.json`, arquivos ficam sem commit — Q-091, nunca
apaga trabalho aprovado por ninguém ainda) e reporta `confirmationUnavailable`; aceito → commita
(`Seeya-Session-Id` = id do FORK, nunca o do chamador), tira o fork de `forks.json` (promovido —
nunca mais escondido, nunca mais apagável por idade) e grava em `adoptions.json`.

**Provado sem terminal (Q-090).** Sessão descartável real, `-p` (sem TTY, mesma lacuna da Q-069/
Q-089): um comando único combinando `--resume` + `--fork-session` + `--session-id <id pedido>` +
`--add-dir` produziu o fork exatamente com o id pedido, ecoou o contexto da sessão original
(prova de que carregou o transcript de verdade), e o hash SHA-256 do transcript original ficou
**idêntico** antes/depois (201.520 bytes, mesmo hash). As três flags nunca tinham sido medidas
juntas antes desta tarefa.

**Fica para o aceite do mantenedor (interativo genuíno, TUI real):** a confirmação em modo
interativo de verdade das quatro flags juntas (este agente não tem terminal real, mesma lacuna já
registrada em Q-069/Q-089); e o fluxo fim a fim — adotar uma sessão real dele, aprovar as escritas
que fizerem sentido, ver `AGENTS.md`/`INDEX.md`/`status/`/`context/know-how.md` preenchidos, e
depois `project open` numa sessão limpa para ver se ela sabe operar sem lembrete.

**Nomes novos em disco, todos no glossário do `AGENTS.md` antes desta entrega:** `adoptions.json`
(raiz de `~/.seeya/`, schemaVersion 1, `originalSessionId`/`forkSessionId`/`projectId`/
`adoptedAt`); `context/know-how.md` (nome fixado pelo PO em 2026-09-24). **Nenhuma mudança de
schema em `forks.json`** — a cópia pendente de adoção usa exatamente `registerFork`/
`unregisterFork` já existentes (D-012), sem campo novo: escondida e limpável por `forkCleanupDays`
como qualquer fork de captura enquanto pendente; "promovida" é simplesmente a ausência em
`forks.json` mais a presença em `adoptions.json`.

**Portas novas:** `ForkRegistration` (`register`/`unregister`, para `application/` sem importar
`adapters/` direto — D-020) e `SessionAdoptionLauncher` (irmã de `HarnessLauncher`, nunca um
terceiro método nele). `ForkCleanup` ganhou `deleteFork` (deleção imediata por `sessionId`, nunca
por idade). `WorkspaceRepository` ganhou `listChangedFiles`. `Storage` ganhou `readAdoptions`/
`saveAdoptions`.

**Conferência do `~/.seeya` real:** `~/.seeya/adoptions.json` não existe (nunca criado — este
agente nunca rodou o `seeya` real contra o home real); `~/.seeya/forks.json` também não existe
(idem); `~/.seeya/workspace`'s own HEAD continua em `aaee62e` (o mesmo antes desta tarefa), sem
commit novo.

**Sessões descartáveis criadas durante o trabalho (Q-090), já apagadas:**
`55555555-5555-4555-8555-555555555555` (original) e `66666666-6666-4666-8666-666666666666`
(fork), em `%TEMP%\claude\C--code-seeya\<sessão-do-agente>\scratchpad\v2t29-adoption-probe\
session-cwd` — nunca uma sessão real do mantenedor.

**Questões abertas registradas:** Q-090 (a medição acima, com o achado colateral de uma pasta
`memory/` vazia criada sem pedido — Spike N, Pergunta 2, não muda a leitura); Q-091 (o que fazer
quando não há terminal para confirmar o commit — decisão: não tocar em nada, nunca apagar trabalho
não aprovado; limite conhecido: rodar `adopt` de novo sem terminal cria um segundo fork pendente,
não resolvido por esta tarefa); Q-092 (achado incidental: `AGENTS.md` se contradiz sobre o idioma
da mensagem de commit — "Como trabalhar" diz português, a tabela de D-028 diz inglês; seguido
inglês, que bate com o `git log` real).

**Portão:** `npm run verificar` passou inteiro (código de saída 0) — `format:check`, `tsc
--noEmit`, `eslint`, `build`, `dependencias` (424 módulos, 0 violação), `cobertura` (232 arquivos
de teste, 2419 testes, 4 pulados; `core/` 99.51%, `application/` 100%, `adapters/harness/` 100%,
`cli/src` 95.27% — todos acima do próprio piso).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-24 20:35
---
Revisão do PO em 2026-09-24: mesclado no po-gate, portão verde (2419 testes). Conferido: sessão resolvida pelo nome; viva ou já adotada é recusada; lock tomado com o id da CÓPIA (gerado pelo seeya, como o open da V2-T35); cópia registrada em forks.json antes de lançar; retomada interativa sem permission-mode, no diretório original, com --add-dir só para o projeto; no fim, descarte (nada mudou / recusado) ou promoção (fora de forks.json, dentro de adoptions.json). Prova forte de que a original não muda: SHA-256 idêntico antes e depois, numa sessão descartável (Q-090). Q-091 aceita e Q-092 corrigida pelo PO (AGENTS.md dizia commits em português). Falta o aceite do mantenedor, cujo PRIMEIRO passo é confirmar em terminal real que as quatro flags funcionam juntas no modo interativo.
---

author: PO
created: 2026-09-24 20:59
---
Aceite do mantenedor em 2026-09-24 — FALHOU, volta para correção. Ele criou um projeto novo e rodou o adopt: a sessão abriu no diretório original dela (que era o do terminal dele — correto por projeto, o --resume só acha o histórico lá), mas a instrução manda escrever em 'the project directory' e cita AGENTS.md/INDEX.md/context/know-how.md sem nunca dizer ONDE o projeto fica. Para a sessão, o diretório do projeto é o dela; não achou arquivo nenhum. No spike N a sessão de teste já rodava dentro do projeto, e a ambiguidade não apareceu — a revisão do PO também não pegou. Correção: (1) a instrução passa a trazer o caminho absoluto do projeto e a nomear cada arquivo a partir dele, e 'escreva só dentro de <caminho>'; (2) antes de lançar, a CLI diz em uma linha onde a cópia vai abrir e onde fica o projeto; (3) prova em modo -p com uma sessão descartável cujo diretório original é DIFERENTE do projeto — o caso exato que falhou — e os arquivos aparecendo no projeto.
---

author: Dev
created: 2026-09-24 21:35
---
Correção do agente em 2026-09-24 (branch `tarefa/V2-T29-adocao`), respondendo ao aceite reprovado (comment #2) e aos três acréscimos do mantenedor no mesmo dia.

1. Instrução leva o caminho absoluto. `adapters/harness/adopt-instruction.ts#ADOPTION_INSTRUCTION` (constante) virou `buildAdoptionInstruction(projectDir)` (função): nomeia o diretório do projeto logo na primeira frase e cada arquivo pelo caminho ABSOLUTO a partir dele (`<projectDir>/AGENTS.md`, `.../context/know-how.md` etc.), nunca mais um nome relativo sem destino. `adapters/harness/adopt-args.ts#buildAdoptArgs` e `SessionAdoptionLauncher.adopt` (`core/ports.ts`) passaram a receber `projectDir: string` direto, no lugar de uma lista `addDirs` que este fluxo nunca usou com mais de um elemento (D-024). Continua dentro do teto de D-015 — o texto mais longo, com um caminho realista de Windows, fica bem abaixo de 3.000 caracteres (teste dedicado), longe do limite de ~32.767.

2. Por que o diretório original é o certo — dito no código, não inferido. Removida do código e dos comentários qualquer afirmação sobre o que --resume consegue ou não achar fora do diretório original de uma sessão (nunca medido). O motivo real, agora citado onde antes estava a afirmação não provada: o Claude Code carrega, pelo diretório de trabalho, o CLAUDE.md local, a memória automática, configuração e skills daquele diretório — abrir a cópia ali é o que dá a ela tudo isso; aberta no projeto, teria só o histórico.

3. Item 5: a instrução pede explicitamente que a sessão carregue o que for relevante. `buildAdoptionInstruction` agora diz: "you were resumed in your own working directory on purpose... carry over into the project whatever, from what is locally available to you here, belongs to this specific work, and leave out anything about other, unrelated work." Medido com uma sessão descartável e um CLAUDE.md descartável (fato inventado: uma ferramenta de build fictícia "Frobinator") — o fato apareceu, atribuído à origem, em AGENTS.md, INDEX.md, status e context/know-how.md do projeto adotado (docs/QUESTOES.md Q-094).

4. Item 2/6/8/9: confirmação antes de criar qualquer coisa, não só uma linha impressa. `application/project-adopt.ts#AdoptSessionCallbacks.confirmLaunch` (`ConfirmAdoptionLaunch`, proceed/decline/unavailable, D-024) é perguntada ANTES do projeto existir, do lock ser tomado ou do fork ser registrado — mesmo "explica e espera" que a V2-T35 já deu ao lock de open. Recusar ou não ter terminal não cria nada (nem projeto, nem lock, nem entrada em forks.json) — resultados novos launchConfirmationDeclined/launchConfirmationUnavailable. O texto (`cli/format-project.ts#renderAdoptionLaunchConfirmation`) diz onde a cópia abre e por quê, onde o projeto fica, e sugere `seeya project open <projectId>` para depois — a mesma sugestão repetida ao final quando a adoção é aceita (formatAdoptSessionReport's own caso adopted). Em branco a resposta é "continuar" aqui — a única pergunta deste projeto em que o silêncio não é "não", porque o comando inteiro existe para fazer isso.

5. Achado técnico durante os testes, registrado no próprio código: duas perguntas sequenciais (lançamento, depois commit) sobre o mesmo stdin de teste travavam se cada uma abrisse e fechasse sua própria readline.Interface — o que já estava em buffer além da primeira linha se perde quando a interface fecha. project-command.ts passou a abrir UMA interface por invocação de adopt/open, reusada pelas perguntas que precisar fazer.

Prova do item 3 (item 8 do despacho), em -p, sem terminal — o caso exato que reprovou o aceite: sessão descartável cujo diretório original é DIFERENTE do diretório do projeto, adotada com a instrução nova. AGENTS.md, INDEX.md e context/know-how.md apareceram exatamente dentro do diretório do projeto, com o conteúdo certo; o diretório original não ganhou nenhum arquivo novo. Hash SHA-256 do transcript original idêntico antes e depois. Detalhes, sessões descartáveis (já apagadas) e custo em docs/QUESTOES.md Q-093 (e Q-094 para a prova do item 5, com CLAUDE.md).

Continua sem medir (mesma lacuna de sempre, Q-069/Q-089/Q-090): confirmação em modo interativo genuíno (TUI real) — este agente não tem terminal de verdade. Fica para o próximo aceite do mantenedor.

Portão: npm run verificar passou inteiro (código de saída 0) — 232 arquivos de teste, 2434 testes, 4 pulados; core/ 99.51%, application/ 100%, cli/src 95.4% — todos acima do piso. ~/.seeya real conferido ao final: adoptions.json/forks.json continuam inexistentes, HEAD de ~/.seeya/workspace sem mudança.
---
<!-- COMMENTS:END -->
