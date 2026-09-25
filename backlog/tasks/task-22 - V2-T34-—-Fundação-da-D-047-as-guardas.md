---
id: TASK-22
title: 'V2-T34 — Fundação da D-047: as guardas'
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-25 15:03'
labels:
  - fundacao
  - d-047
milestone: m-0
dependencies:
  - TASK-20
  - TASK-26
references:
  - docs/PLANO-DE-ENTREGA.md
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T34 — Fundação da D-047, parte 2: as guardas, e as regras de trabalho do projeto.**
Especificada pelo PO em 2026-09-22; **revisada em 2026-09-25** a partir de um teste proposital do
mantenedor: abriu um projeto, pediu à sessão para organizar tarefas, ela escreveu em `plans/`,
**perguntou se podia commitar**, e ele fechou a aba no X. Sobraram três arquivos sem commit, e a
próxima sessão não saberia de onde vieram. Duas lições: (a) a sessão **não sabia** que pode e deve
commitar — o `AGENTS.md` do projeto não diz nada sobre como trabalhar ali; (b) sem as guardas, o
commit que ela faria sairia sem dono. **Depende da V2-T33 e da V2-T35** (a Q-087 já foi fechada pela
V2-T35: o `open` gera o id da sessão e o grava no lock).

**O que a D-047 diz, e que esta tarefa torna verdade:** item 4 — **quem segura o lock commita**, a
própria sessão, no caminho, com as mensagens dela (não um commitão do seeya no fim — foi o receio do
mantenedor, e a decisão já o evita); item 5 — o que precisa valer sempre é garantido por código.

**O que entra:**

1. **Ganchos de git no repositório do espaço de trabalho**, instalados pelo seeya ao criar o espaço
   de trabalho e **reafirmados a cada `open`** (um gancho apagado volta sozinho):
   - **acrescentam** os trailers `Seeya-Project-Id`/`Seeya-Session-Id` quando o commit não os traz
     (revisão de 2026-09-25: menos atrito que recusar — o projeto sai do caminho dos arquivos, a
     sessão sai de `CLAUDE_CODE_SESSION_ID` ou, sem ela, do lock; sem nenhuma das duas, `unknown`,
     D-025). Trailer que já vem escrito e **contradiz** o que o gancho sabe é recusado;
   - **recusam**, cada um com a mensagem dizendo o que faltou e como deveria ser: commit que toca
     mais de um projeto; commit que inclua o arquivo de lock; commit num projeto cujo lock está com
     **outra** sessão viva. Commit feito à mão pela pessoa, sem sessão no ambiente e com o lock
     livre, passa — com sessão `unknown`;
   - **não dependem de o `seeya` estar no `PATH`**: chamam a verificação do próprio seeya pelo
     caminho absoluto gravado ao instalar — **medir** nos três sistemas; no Windows os ganchos rodam
     no shell que vem com o git.
2. **Gancho do harness no diretório do projeto**, onde o harness permitir: no Claude Code, as
   configurações de projeto dentro do diretório do projeto (que é do seeya — **nunca** `~/.claude`),
   recusando os comandos que furam os ganchos de git (`--no-verify`, trocar o diretório de ganchos).
   **Medir primeiro** se valem para uma sessão que só enxerga o projeto por `--add-dir` (a adoção);
   se não valerem, registrar que a segunda camada não protege a adoção.
3. **A auditoria**: `seeya project audit <id>` confere o histórico desde a última auditoria contra
   as mesmas regras e mostra o que escapou. Chamada também pelo `open`, antes de tomar o lock.
4. **Sobra de sessão anterior, no próximo `open`** (novo, do teste do mantenedor). Se o projeto
   tem mudança não commitada, o `open` mostra os arquivos e pergunta **antes** de lançar: **commitar
   agora** (sessão `unknown` — não dá para afirmar de quem foi, D-025) ou **seguir sem commitar** (a
   sessão nova recebe, junto das regras e do aviso do lock, a lista do que está pendente). **Nunca
   descarta sozinho.** Sem terminal interativo, recusa dizendo o porquê, como o aviso do lock. Na
   janela, o mesmo num diálogo.
5. **As regras de trabalho entregues à sessão** (novo). Um texto curto, **no código do seeya**
   (num lugar só, compartilhado CLI↔janela), entregue a cada `open` pelo `--append-system-prompt`
   (o mesmo canal do aviso do lock, V2-T35) — e não só no `AGENTS.md` do projeto, porque esse é o
   arquivo que as próprias sessões reescrevem (a adoção reescreveu o do projeto de teste inteiro).
   Diz, no mínimo: em que projeto ela está, pelo **id**; que ela **commita no caminho**, em commits
   pequenos com mensagem que explique o porquê, sem perguntar; que os trailers são acrescentados
   sozinhos (não escrevê-los à mão); um projeto por commit; nunca commitar o arquivo de lock; editar
   os arquivos canônicos **no momento em que decide** (D-047 item 1) e usar o `journal/` como
   rascunho; segredo por caminho, nunca por valor. **Limite conhecido:** a Q-069 mediu que
   `--append-system-prompt` **não** chega numa sessão retomada (`--resume`) — a adoção não recebe as
   regras por aqui; a instrução dela já cobre o que ela precisa escrever.
6. **O `AGENTS.md` do esqueleto dá nome ao projeto e aponta para as regras** (achado do mantenedor:
   a sessão chamava o projeto de "projeto seeya", genérico, porque é o que o texto diz). Passa a
   dizer "este é o projeto seeya `<id>`…" e ganha uma seção curta "Working in this project" com o
   resumo das regras do item 5. **Projetos que já existem não são reescritos** (o seeya não
   sobrescreve arquivo que a pessoa pode ter editado).
7. **Onde o guarda-corpo termina**, escrito no código e nas regras: cobre o descuido; não cobre quem
   forja o identificador de outra sessão, nem um harness sem gancho rodando `--no-verify` — isso só
   a auditoria mostra.

**Considerado e deixado de lado (2026-09-25):** uma worktree por sessão, com o seeya consolidando
depois (proposta do mantenedor). Esbarra na D-047 item 1 ("sem rascunho paralelo para consolidar
depois" — o projeto é o tracker, e a próxima sessão age sobre as regras atuais); troca commits
simples por merge de markdown com conflito provável. Volta como revisão da D-047 se o uso pedir
duas sessões escrevendo no mesmo projeto ao mesmo tempo.

**O que não entra:** gancho antes da compactação (V2-T41); metadados do projeto na criação
(V2-T54); qualquer escrita em `~/.claude`.

**Cuidados:** nenhuma dependência nova; os ganchos são texto gerado pelo seeya, testado como texto
**e** executado de verdade num repositório descartável; nada no `~/.seeya` real, nenhuma sessão
real; texto dito pela CLI e pela janela num lugar só.

**Aceite do mantenedor:** num projeto novo, o `AGENTS.md` traz o nome do projeto e a seção de
regras; numa sessão aberta pelo `open`, a sessão **commita sozinha** no caminho, e o commit sai com
os trailers sem ela escrevê-los; um commit que tente tocar dois projetos é recusado com a mensagem
certa; pedir `--no-verify` e o harness recusar (se a medição do item 2 sustentar); fechar no X com
mudança pendente e o próximo `open` mostrar a sobra e perguntar; e `seeya project audit` apontar um
commit feito por fora.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Relatório do agente (branch `tarefa/V2-T34-guardas`, worktree isolada, a partir da `main` em
`59d34b1`).** Os sete itens, nesta ordem, em 5 commits (a divisão real do trabalho não bate 1:1 com
os 7 itens — os arquivos compartilhados, principalmente `application/project-open.ts`, `core/ports.ts`
e `adapters/workspace/index.ts`, misturam vários itens; a divisão em commits reflete o que dava para
separar de verdade, não uma tentativa de forçar sete commits artificiais).

1. **Ganchos de git do espaço de trabalho.** `core/workspace-hooks.ts#buildCommitMsgHookScript` gera
   um script `#!/bin/sh` (único em qualquer SO — o git do Windows sempre roda ganchos pelo `sh.exe`
   embutido), chamando de volta `"$nodePath" "$cliEntryPath" project verify-commit "$1"` por caminho
   ABSOLUTO. A decisão pura é `core/workspace-commit-guard.ts#decideCommitGuard`: acrescenta
   `Seeya-Project-Id`/`Seeya-Session-Id` quando faltam (sessão de `CLAUDE_CODE_SESSION_ID` ou, sem
   ela, do lock do projeto tocado; sem nenhuma das duas, `unknown`) e recusa — mais de um projeto no
   commit, o `.seeya-lock` staged, ou lock de OUTRA sessão viva; um trailer já escrito que contradiz
   o que o gancho sabe também é recusado. `application/verify-commit.ts#verifyCommit` junta os fatos
   (arquivos staged via `WorkspaceRepository.listStagedFiles`, a mensagem via a nova porta
   `CommitMessageFile`, o lock) e aplica a decisão — exposta como `seeya project verify-commit
   <messageFile>`, o único chamador é o próprio gancho. Instalado por
   `application/workspace-hooks.ts#ensureWorkspaceHooksInstalled`, chamado em `createProject` (na
   criação) e no início de `openProject` (a cada `open`).

   **Onde e como os ganchos acham o `seeya`:** `nodePath` é `process.execPath`; `cliEntryPath` é
   `process.argv[1]` (o script real que lançou o processo `seeya` atual — `packages/cli/src
   /composition.ts#resolveCliEntryPath`), nunca `PATH`. **Medido de verdade só no Windows** (a
   máquina de desenvolvimento — `tests/integration/workspace/commit-msg-hook.test.ts`, ver abaixo).
   `npm run verificar:linux` (o container Linux) **não foi rodado nesta tarefa** — fica sem medição
   direta em Linux; o mecanismo em si (git para Windows roda ganchos pelo `sh.exe` que ele mesmo
   empacota, então o script já é POSIX `sh` por necessidade) é o mesmo que um Linux nativo usaria,
   mas isso é inferência a partir do desenho, não medição (D-025). macOS também não foi medido (sem
   máquina disponível). Os dois ficam para o aceite do mantenedor.

   **Execução real, não só simulada:** `tests/integration/workspace/commit-msg-hook.test.ts` — um
   repositório git descartável de verdade, o script gerado instalado de verdade em
   `.git/hooks/commit-msg`, chamando de volta o `packages/cli/dist/index.js` REAL (compilado por
   `npm run build`), com `git commit` real via `child_process.spawn`. Seis cenários: (a) permitido —
   trailers completados com `unknown` quando não há sessão no ambiente; (b) permitido — trailers
   completados com a sessão real do ambiente; (c) recusado — dois projetos no mesmo commit; (d)
   recusado — `.seeya-lock` staged; (e) recusado — trailer de projeto contraditório; (f) recusado —
   lock de outra sessão viva, com um PROCESSO FILHO REAL spawnado como "sessão viva" (mesma técnica de
   `tests/integration/application/project-lock.test.ts`). Todos os seis passam.

   **Achado real durante o trabalho, registrado aqui (não é uma questão nova — a causa raiz já é
   conhecida, D-017):** `tests/integration/application/workspace-boundary.test.ts` (já existente,
   V2-T27) travava porque fixava `sessionId: undefined` enquanto o AMBIENTE real de quem roda a
   suíte (esta própria sessão do Claude Code) tinha um `CLAUDE_CODE_SESSION_ID` de verdade — o commit
   trailer que `createProject` escreve (`unknown`) e o que o gancho lê do ambiente (a sessão real)
   discordavam, e o gancho (corretamente) recusava. Corrigido lendo `process.env.CLAUDE_CODE_SESSION_ID`
   no teste, a mesma fonte que `composition.ts#readCurrentSessionId` usa em produção — os dois nunca
   discordam de verdade fora de um teste com fixture hardcoded. Isto só aparece rodando a suíte de
   dentro de uma sessão real do Claude Code (como este agente); em CI (sem a variável setada) nunca
   apareceria. Não é regressão de produção, é fragilidade de fixture de teste, corrigida.

2. **Gancho do harness.** `core/harness-hook-config.ts` — `.claude/settings.json` registrando um hook
   `PreToolUse` no `Bash` (`code.claude.com/docs/en/hooks`: `matcher: "Bash"`, `type: "command"`,
   `${CLAUDE_PROJECT_DIR}` resolvido pelo próprio Claude Code antes de qualquer shell), rodando
   `.claude/hooks/verify-bash-command.mjs` (script Node puro, não shell — o gancho do harness não pode
   presumir o mesmo shell do git): recusa (`exit 2` + `permissionDecision: "deny"` no stdout, formato
   documentado) um comando Bash contendo `--no-verify` ou `hooksPath`. Escrito só na criação do
   projeto (nunca reafirmado a cada `open` — reafirmar geraria uma "mudança" não commitada a cada
   abertura, colidindo com o item 4).

   **Medição do item 2 (a pergunta do despacho):** confirmado que esta camada NÃO protege
   `seeya project adopt`, por duas vias independentes:
   - **Documentação oficial**, `code.claude.com/docs/en/permissions`: "[Claude Code] doesn't discover
     most `.claude/` configuration from these directories" (referindo-se a diretórios liberados só por
     `--add-dir`) — settings/hooks só são lidos do `cwd` da sessão.
   - **Medição empírica com uma sessão descartável real**: dois diretórios temporários, cada um com
     seu próprio `.claude/settings.json`+hook (cada hook grava um arquivo-marcador ao disparar);
     `claude -p --session-id 77777777-7777-4777-8777-777777777777 --add-dir <projeto> --cwd <original>`
     rodando um `echo` qualquer via Bash. Resultado: o hook do `cwd` disparou (arquivo-marcador
     criado, com timestamp real); o hook do diretório só `--add-dir`'d NÃO disparou (nenhum arquivo
     criado). Sessão e transcript apagados depois (`~/.claude/projects/<slug>/77777777-....jsonl`,
     removido via PowerShell) — nunca uma sessão real do mantenedor.

   Como `seeya project open` sempre lança com o diretório do projeto como `cwd`, este gancho protege
   `open` de verdade; a adoção continua coberta só pelos ganchos de git (item 1), que rodam dentro do
   próprio repositório do espaço de trabalho, nunca dependendo do `cwd` da sessão que chama `git`.

3. **`seeya project audit <id>`.** `core/project-audit.ts#auditCommits` — dado todo commit desde o
   último marcador (ou a história inteira, na primeira vez), sinaliza o que nunca passou pelo gancho:
   trailer de projeto ausente/errado, trailer de sessão ausente, commit que também tocou outro
   projeto (lista de arquivos SEM escopo, ao contrário de `findCommitsAfter` — é o que permite
   detectar isso), ou commit que inclui o arquivo de lock. `application/project-audit.ts#auditProject`
   orquestra: lê `.seeya-audit` (novo, porta `ProjectAuditMarker`, mesma disciplina de nunca-commitado
   do `.seeya-lock`), busca os commits via `WorkspaceRepository.listCommitsForAudit`, decide, grava o
   novo marcador. Chamada também por `openProject`, ANTES de tomar o lock (relatório sai por
   `onBeforeLaunch`'s own `audit`).

4. **Sobra de sessão anterior no próximo `open`.** `handleLeftoverChanges` — só quando esta tentativa
   TOMOU o lock (nunca num `open` para leitura) e `listChangedFiles` não está vazio: pergunta
   (`ConfirmLeftoverChanges`, três respostas nunca achatadas — `commitNow`/`proceedWithoutCommitting`
   /`unavailable`). `commitNow` commita com `Seeya-Session-Id: unknown` (D-025); `proceedWithoutCommitting`
   segue e soma a lista de pendências ao `--append-system-prompt`; sem confirmador, recusa e libera o
   lock que acabou de tomar (nunca descarta, nunca commita, nunca segue silenciosamente).

5. **Regras de trabalho.** `core/project-working-rules.ts#buildProjectWorkingRulesText` — id do
   projeto, commitar no caminho sem perguntar, trailers automáticos, um projeto por commit, nunca o
   `.seeya-lock`, editar os canônicos na hora da decisão (`journal/` como rascunho), segredo por
   caminho, e onde o guarda-corpo termina (item 7, ver abaixo). Entregue em TODO `open` (nunca só
   quando há algo a avisar) via o MESMO `--append-system-prompt` do aviso de lock.

   **Tamanho medido:** o texto das regras sozinho tem **1.321 caracteres**; somado a um aviso de lock
   típico (a forma mais longa do texto que `formatProjectLockWarningLines` produz), **1.598
   caracteres** — bem abaixo do teto real medido por este projeto para o argumento equivalente de
   `--resume` (Q-069: ENAMETOOLONG a partir de 32.656 no Windows; o próprio `RESUME_PROMPT_ARG_LIMIT_CHARS`
   já usa 16.384 como teto conservador). `--append-system-prompt` é uma flag diferente de `--resume`,
   mas o limite de tamanho de linha de comando do SO é o mesmo mecanismo subjacente.

   **Limite conhecido:** a Q-069 já mediu que `--append-system-prompt` não chega a uma sessão
   RETOMADA — a adoção (que usa `--resume`) não recebe este texto; a instrução própria dela
   (`buildAdoptionInstruction`) já cobre o que precisa.

6. **Esqueleto.** `core/project-skeleton.ts#buildAgentsMd` agora nomeia o projeto ("This is seeya
   project `<id>`...") e ganha a seção `## Working in this project` com o texto do item 5. Inclui
   também os dois arquivos do item 2 (`.claude/settings.json`, `.claude/hooks/verify-bash-command.mjs`).
   Projetos já existentes não são reescritos — `writeProjectSkeleton` só roda uma vez, na criação;
   nada nesta tarefa chama de novo para um projeto já existente (confirmado lendo `application
   /workspace.ts#createProject`, que só chama depois de `projectExists` ser falso).

7. **Onde o guarda-corpo termina.** Escrito em três lugares: (a) `core/workspace-commit-guard.ts`'s
   own docstring — cobre commit sem sessão forjada e sem `--no-verify`; não prova identidade além do
   que o ambiente afirma, nem impede um `git commit --no-verify` de passar batido (o gancho
   simplesmente não roda); (b) `core/harness-hook-config.ts`'s own docstring — não protege a adoção
   (medido, item 2); (c) `core/project-audit.ts`'s own docstring — auditoria é detecção, não prova:
   um `Seeya-Session-Id` sintaticamente válido não prova que foi aquela sessão que commitou. O próprio
   texto de regras (item 5) também diz isso à sessão, na última frase.

**Sessões descartáveis criadas por este agente:** apenas uma,
`77777777-7777-4777-8777-777777777777` (medição do item 2), em
`%TEMP%\claude\C--code-seeya\<sessão-do-agente>\scratchpad\v2t34-hook-probe\cwd-dir`, fora de
qualquer repositório real. Transcript apagado depois (`~/.claude/projects/C--Users-mausa-AppData-
Local-Temp-claude-C--code-seeya-...-v2t34-hook-probe-cwd-dir/`). Custo: uma chamada `haiku` com teto
de US$ 0,05, bem abaixo disso na prática (um `echo`).

**Conferência do `~/.seeya`, do espaço de trabalho e do registro reais (D-025 — conferido, não só
afirmado):** `~/.seeya/` real tem os arquivos do mantenedor (`config.json`, `estado.json`,
`workspace/teste-projeto`, `workspace/teste-projeto2`, etc.) — todos com `mtime` anterior ao início
deste trabalho (mais recente, `estado.json`/`days/`, 25/09 09:45, antes deste agente começar a ler a
tarefa). `~/.seeya/protocol-handler.json` tem `activeScheme: "seeya-dev"` e a chave do registro
`HKCU\Software\Classes\seeya-dev` existe — os dois já existiam ANTES deste trabalho (mesmo `mtime`
anterior); este agente nunca rodou `npm run app` nem `node scripts/build.mjs --dev`, então não foi
quem escreveu nenhum dos dois. Todo teste/medição deste agente usou `mkdtemp`/diretórios descartáveis
ou passou `homeDir`/`seeyaHome` explícito — nunca `os.homedir()` implícito contra o real, exceto a
única chamada real ao `claude` (item 2), que nunca invoca `seeya` e portanto nunca toca `~/.seeya/`.

**Portão:** `npm run verificar` passou inteiro (código de saída 0) — `format:check`, `tsc --noEmit`,
`eslint`, `build`, `dependencias` (482 módulos, 0 violação), `cobertura` (261 arquivos de teste, 2705
testes, 4 pulados; `core/` 99,44% linhas / 98,25% branches, `adapters/workspace/` 93,24% linhas /
80,23% branches — acima do próprio piso de 80% depois de duas rodadas de teste adicional para os dois
arquivos novos que tinham cobertura baixa (`FsCommitMessageFile`, `FsProjectAuditMarker`), todos os
demais diretórios tocados acima do piso). `npm run verificar:linux` não foi rodado à parte (o portão
completo já cobre os testes reais de execução dos ganchos; `verificar:linux` roda a mesma suíte dentro
de um container Linux e não foi disparado nesta tarefa por tempo — registrado aqui como não
verificado nesta plataforma, não como "verificado e passou").

**O que fica para o aceite do mantenedor:** medição do item 1 em macOS (só Windows e o mecanismo
POSIX genérico do gancho de git foram confirmados de verdade); `npm run verificar:linux` de verdade
(não rodado nesta tarefa); um `seeya project open` real, de um terminal de verdade, vendo o aviso de
auditoria/as regras de trabalho/a sobra de sessão anterior na tela antes do harness assumir.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Claude (agente)
created: 2026-09-25 14:58
---
Revisao do PO (2026-09-25): tres defeitos corrigidos, todos porque os testes originais rodavam a CLI com um `node` comum, nunca o Electron empacotado real.

1. **ELECTRON_RUN_AS_NODE=1 ausente ao chamar o gancho de git.** `resolveCliHookEnv(electronVersion)` em `packages/cli/src/composition.ts` decide de forma pura (testada nos dois ramos); `ProjectContext.hookEnv` carrega o resultado, `buildProjectContext` computa a partir de `process.versions.electron`. Teste de integracao prova que o script gerado para o caso Electron contem a variavel.

2. **Mensagem do verificador ausente no gancho de git.** `buildCommitMsgHookScript` (`packages/engine/src/core/workspace-hooks.ts`) ja recusava (exit 1) quando `nodePath`/`cliEntryPath` sumiam, mas sem dizer por que. Agora ecoa qual caminho faltou e "rode seeya project open <id> para reinstalar os ganchos". De quebra, corrigi um bug de aspas que eu mesmo tinha introduzido: a mensagem tinha aspas duplas dentro de um `echo "..."` tambem em aspas duplas, o que teria truncado a frase na primeira vez que esse caminho rodasse de verdade — trocado por aspas simples, com teste de regressao.

3. **Gancho do harness dependia de `node` no PATH.** Reconstruido sobre o mesmo mecanismo do gancho de git: `seeya` por caminho absoluto, `ELECTRON_RUN_AS_NODE=1` quando Electron, subcomando novo `seeya project verify-bash-command` (le o payload do `PreToolUse` pelo stdin, zod tolerante a campos desconhecidos). Verificador ausente agora sai com codigo 2 (bloqueia), nunca falha aberto — a diferenca de `PreToolUse`: so exit 2 bloqueia, qualquer outro erro e so aviso. Isso tambem corrigiu uma segunda causa de obsolescencia: `.claude/settings.json` deixou de fazer parte do esqueleto versionado do projeto (que nunca era atualizado depois de criado) e passou a ser reescrito a cada `seeya project open`, exatamente como o gancho de git ja fazia; o `.gitignore` do espaco de trabalho passou a ignorar o `.claude/` de cada projeto (`**/.claude/`), medido que o padrao com esse prefixo ignora o diretorio em qualquer profundidade.

Medido de verdade, nao simulado: uma sessao descartavel confirmou que o `command` do hook do Claude Code roda por um shell real (sintaxe `KEY=value cmd` funciona no Windows, nao e argv literal). Outra medicao, isolada num diretorio de rascunho fora do worktree real, com um `seeya` compilado de verdade e duas sessoes descartaveis: uma tentativa de `git commit --no-verify` foi bloqueada pelo gancho reconstruido, um `echo` comum passou. As duas sessoes e seus transcripts foram apagados depois. Limite medido e documentado no docstring do modulo: essa camada nao protege `seeya project adopt` (o Claude Code nao le `.claude/settings.json` de um diretorio liberado so por `--add-dir`) — os ganchos de git continuam cobrindo esse caminho.

`npm run verificar` verde (exit 0) apos as correcoes. `~/.seeya` real, o espaco de trabalho real (teste-projeto/teste-projeto2) e o registro do Windows (`seeya`/`seeya-dev`) conferidos ao final: nada alem do que ja existia antes desta rodada de correcoes.
---

author: PO
created: 2026-09-25 15:03
---
Revisão do PO em 2026-09-25, segunda rodada: aceita para o aceite do mantenedor. As três correções pedidas estão feitas e provadas: (1) a CLI passa ELECTRON_RUN_AS_NODE=1 ao gancho quando roda sob Electron (função pura testada nos dois lados) — sem isso o gancho gravado pela CLI instalada abriria o app a cada commit; (2) verificador ausente recusa com mensagem que diz o caminho e como reinstalar, executado de verdade; (3) o gancho do harness não depende mais de node no PATH: chama o seeya por caminho absoluto (seeya project verify-bash-command), bloqueia com código 2 se o verificador sumir, e é regravado a cada open, fora do git do espaço de trabalho (**/.claude/ no .gitignore). --no-verify medido bloqueado com sessão descartável isolada e a CLI compilada. Limite registrado: a camada do harness não protege a adoção (o Claude Code não lê settings de diretório só --add-dir); os ganchos de git cobrem. Portão verde no po-gate (2735 testes). A armadilha 'a CLI instalada roda sob o Electron' entrou no docs/FLUXO-DE-AGENTES.md.
---
<!-- COMMENTS:END -->
