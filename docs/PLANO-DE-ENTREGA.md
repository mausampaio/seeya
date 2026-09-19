# Plano de entrega

Uma tarefa por vez, na ordem. Cada tarefa é um branch (`tarefa/S1-T3-descoberta`) e termina
com os testes da sua faixa passando e os guards verdes.

O agente dev **não pula tarefa**, **não agrupa tarefas** e **não começa a próxima** antes do
review aprovar a anterior.

Legenda: `[ ]` a fazer · `[~]` em andamento · `[x]` aprovado no review

---

## Sprint 0 — Fundação e riscos

O objetivo aqui não é entregar produto, é **derrubar as incertezas antes que elas custem caro**.

- [x] **S0-T1 — Scaffold.** Aprovado no review em 2026-08-16. `npm run verificar` verde, CLI
      roda, estrutura de camadas conforme `docs/ARQUITETURA.md`, sem escopo adiantado.

- [x] **S0-T2 — Guards executáveis.** Aprovado no review em 2026-08-16, após três rodadas.
      `dependency-cruiser`, `no-restricted-syntax` conforme D-019, cobertura por diretório,
      husky, lint-staged e CI nos 3 SOs. 25 testes provando reprovação de violação real e
      aprovação dos casos permitidos. Gerou D-019 e D-020.

- [x] **S0-T6 — Fechar a matriz de camadas.** Aprovado no review em 2026-08-16. Os 20 pares
      ordenados cobertos, com o **guard do guard**: um teste dirigido por estrutura de dados
      única (`tests/integracao/guardas/_matriz-de-camadas.ts`), declarada de forma independente
      do `.dependency-cruiser.cjs` de propósito — se ela apenas repetisse o config, um erro
      cometido nos dois lugares passaria batido. Verificado removendo regras: os pares
      afetados falham nomeados individualmente, e uma camada nova em `src/` reprova o teste de
      sanidade. Guards isolados em projeto vitest próprio, serializado porque disputam a árvore
      real de `src/`; a faixa de integração segue paralela.

- [x] **S0-T3 — SPIKE A.** Feito pelo PO em 2026-08-16. Veredito em
      `docs/spikes/A-resume-headless.md`: funciona com a sessão viva, transcript original
      preservado. Gerou D-011, D-012 e D-015.
      *Complemento feito:* `docs/spikes/C-alternativa-barata-e-transcript-desativado.md`.

- [x] **S0-T4 — SPIKE B.** Feito pelo PO em 2026-08-16. Veredito em `docs/spikes/B-notificacoes.md`.
      Windows exibe toast sem dependência nenhuma (WinRT via PowerShell). Ações clicáveis são
      inconsistentes entre SOs: a spec passou a **não depender delas**. macOS e Linux
      documentados, não executados — S5-T4 continua obrigatório.

- [x] **S0-T5 — Schemas e contrato.** Aprovado no review em 2026-08-16. Schemas do registro de
      sessões, do `agents --json`, do transcript e da saída do `claude -p`, escritos depois de
      conferir 2808 entradas reais desta máquina — que já trazem campos não previstos pela spec
      (`status`, `bridgeSessionId`, `nameSource`…), confirmando na prática o princípio de
      tolerar o desconhecido. Suíte de contrato roda contra o `~/.claude` real, imprime a versão
      do Claude Code no caminho feliz, e foi **verificada capaz de falhar** quando o schema
      diverge da realidade. `procStart` fica como string: os valores reais excedem
      `Number.MAX_SAFE_INTEGER`. Gerou D-021.

**Sprint 0 fechado.** As quatro incertezas que podiam custar caro foram derrubadas antes de
existir código de negócio: o `--resume` headless funciona e preserva o transcript (Spike A), a
notificação nativa não precisa de dependência (Spike B), a supressão de transcript tem causa
conhecida e correção (Spike D), e as fronteiras de camada são impostas por ferramenta, não por
boa vontade. Onze decisões nasceram de medição, não de opinião.

---

## Sprint 1 — Enxergar as sessões

- [x] **S1-T0 — Tornar os guards insensíveis ao estado da árvore.** Aprovado no review em
      2026-08-16, após 6 rodadas. Vem antes de tudo: guard instável mina toda tarefa seguinte,
      porque um vermelho que ninguém confia vira um vermelho que todo mundo ignora.
      **O que aconteceu:** no commit `6899f99` o CI falhou em Linux e macOS e passou no Windows.
      O teste que caiu foi o controle de D-019 (`aprova new Date(valor)`), com
      `expected 2 to be +0` — o eslint viu 2 erros onde deveria ver zero.

      **CUIDADO: não é problema de plataforma.** A primeira leitura foi essa e estava errada.
      Reproduzido com paralelismo forçado nos dois sistemas:

      | | com `--file-parallelism` |
      |---|---|
      | Linux (container) | **13 de 54 falham** |
      | Windows (local) | **11 de 54 falham** |

      O Windows nunca foi imune; teve sorte de timing naquela execução do CI. É uma **corrida**,
      e a serialização do S0-T6 a **mascara**, não a corrige.

      **Causa:** os arquivos de guard escrevem fixtures na árvore real de `src/` e as asserções
      de controle exigem "zero erros". Rodando em paralelo, um controle enxerga a violação que
      outro arquivo acabou de escrever. `limparResiduosDeTestesDeGuarda()` piora, varrendo `src/`
      inteiro e apagando tudo com prefixo `_` — inclusive fixture em voo de outro arquivo.

      **Causa raiz final:** o teste que prova a âncora de segmento cria e apaga o diretório
      `src/aplicacao-legado/` **inteiro**; a varredura de outro arquivo de teste o via listado
      em `src/` e sumido antes de conseguir ler.

      **Três soluções erradas morreram no caminho — vale saber quais, para ninguém trazê-las
      de volta achando que são melhoria:**
      1. `fileParallelism: false` (herdado do S0-T6) — mascarava, não corrigia. Removido: o
         paralelismo é mais rápido **e** é o que expõe corrida nova em vez de deixá-la dormir.
      2. Retry de 3× no `dependency-cruiser` — medido: disparava em **4 de 10** execuções, e
         numa delas esgotou as três tentativas e falhou assim mesmo. Descartado.
      3. Pré-listagem ingênua dos arquivos de produção — moveu o TOCTOU para o `readdirSync`
         do próprio teste, derrubando a **suíte** (não uma asserção) com `ENOENT: scandir`.

      **A correção:** tolerar `ENOENT` — e **apenas** `ENOENT` — na varredura, com o argumento
      semântico de que diretório que sumiu é, por definição, não-produção. `ENOTDIR` e `EPERM`
      continuam estourando. Fixtures em subdiretório próprio por arquivo, limpeza restrita a
      ele. Asserções de contagem passaram a imprimir a saída bruta da ferramenta na falha.

      **Estabilidade medida:** 40 rodadas do dev nos dois sistemas + 20 minhas, zero falhas.
      Antes, ~1 em 3.
      *Aceite cumprido:* `npx vitest run --project guards --file-parallelism` passa em Linux e
      Windows, e o guard continua reprovando violação real plantada em `src/` — verificado em
      três camadas diferentes, incluindo o caso `aplicacao-nova`, que um filtro por prefixo
      teria deixado passar.

- [x] **S1-T0b — Pré-voo local em Linux com Docker.** Aprovado no review em 2026-08-16.
      `npm run verificar:linux` roda o portão dentro de `node:22-bookworm` via `spawnSync` com
      array e `shell: false` — caminho do Windows atravessa até o Docker sem shell intermediário
      reescrevendo aspas (D-015 aplicado a ferramental). Propagação de exit code verificada com
      erro de tipo injetado: saiu 2, com a mensagem real do `tsc`. O review tentou forçar
      falso-verde por quatro caminhos e todos falharam alto e correto.
      **Achado do review, corrigido:** volume global compartilhado quebra sob concorrência —
      dois `npm ci` simultâneos de worktrees diferentes, e um perde com `ENOENT`. Passou a ser
      `seeya-node-modules-<hash-do-caminho>`, um por repositório/worktree. Elimina a corrida sem
      lock e preserva o cache (3m06s frio → 1m39s quente).
      **Limite honesto, escrito no README:** cobre Linux, não macOS — não existe container de
      macOS. O CI nos 3 SOs e a bateria manual do S5-T4 continuam obrigatórios.

- [x] **S1-T0c — Corrigir os schemas contra dado real de outra máquina.** Os schemas do S0-T5
      foram escritos contra o `~/.claude` de **uma** máquina (Windows, uso pessoal). Testados
      contra a saída real de uma segunda máquina, Linux, **rejeitam**:
      ```
      esquemaSaidaAgentsJson.safeParse(saidaReal) -> REJEITA
        0.pid : expected number, received undefined
      ```
      A entrada é uma sessão `kind: "background"` com esta forma — diferente das interativas:
      ```jsonc
      { "id": "1a2b3c4d", "cwd": "…/.claude/agente-interno/ui", "kind": "background",
        "startedAt": 1780000000000, "sessionId": "1a2b3c4d-…",
        "name": "pare o ui do agente", "state": "blocked" }   // sem pid; state, não status
      ```
      - `pid` passa a opcional; aceitar `id` e `state` da variante de background
      - validação **por item** conforme D-022: item ruim é descartado com registro, não derruba
        a lista
      - item sem `pid` nunca é candidato a encerramento de processo (igual a D-016)
      - a suíte de contrato passa a incluir esta amostra real como fixture anonimizada, para a
        regressão não voltar
      *Aceite:* a saída real da máquina Linux (fixture) é aceita, com a entrada de background
      preservada; e um array com uma entrada boa e uma inválida devolve a boa e reporta a outra.

- [x] **S1-T1 — `nucleo/` de domínio.** Tipos, portas e as regras puras de elegibilidade e de
      classificação viva/ociosa/encerrada. Sem I/O.
      **Requisito de D-024, vindo do review de S1-T0c:** o tipo de sessão descoberta é uma **união
      discriminada**, não um tipo único com `pid` opcional. Uma forma carrega `pid` garantido, a
      outra não tem PID nenhum. A política de encerramento (D-002) aceita só a primeira, e o
      compilador recusa a segunda.
      *Por que importa:* foi medido que `item.pid!` compila sem erro. Comentário avisando "não
      encerre sem PID" não impede ninguém; tipo impede.
      *Aceite:* existe um teste que **não compila** se alguém tentar passar a forma sem PID para a
      função de encerramento — ou, se um teste de compilação for caro demais, a função de
      encerramento aceita exclusivamente o tipo com `pid` garantido e isso está exercitado.
- [x] **S1-T0d — Migrar o código para inglês (D-028).** Vem **antes do S1-T2**, senão ele escreve
      código novo em português que teria de ser migrado logo depois.
      Escopo: identificadores, comentários de código, README, comandos e saída do CLI. `docs/`
      **não** muda — continua em português, e é por isso que o glossário existe.
      - use **exatamente** o glossário de `AGENTS.md` § Idioma. Termo que não estiver lá: **pare
        e pergunte**, não invente tradução. Deriva de termo é o único risco real desta migração.
      - renomear os diretórios de camada (`nucleo` → `core` etc.) tem raio de alcance grande:
        `.dependency-cruiser.cjs`, a matriz de 20 pares em
        `tests/integracao/guardas/_matriz-de-camadas.ts`, os testes de guarda, os limites de
        cobertura por diretório em `vitest.config.ts`, e os caminhos em `tests/`. Confira cada um.
      - `docs/ARQUITETURA.md` continua em português **mas cita os diretórios reais** — atualize só
        os nomes de caminho lá, não o texto.
      - o teste de sanidade da matriz compara os diretórios reais de `src/` com a lista declarada:
        ele **tem** que reprovar durante a migração e voltar a passar no fim. Se passar o tempo
        todo, alguma das duas pontas não foi migrada.
      *Aceite:* `npm run verificar` verde; `npx vitest run --project guards --file-parallelism`
      verde; nenhum identificador em português em `src/` e `tests/`; `docs/` intocado exceto os
      nomes de caminho.

- [x] **S1-T0e — Fechar o buraco do `passWithNoTests`.** Achado durante o S1-T0d, e é da pior
      classe: **falso verde**.
      `passWithNoTests: true` está ligado globalmente desde S0-T1, quando as faixas ainda estavam
      vazias. Consequência hoje: **qualquer projeto cujo glob deixe de casar passa verde, sem
      rodar teste nenhum.** Durante a migração, renomear o diretório antes de atualizar o config
      produziu `No test files found, exiting with code 0` — o portão teria aprovado uma migração
      pela metade.
      Não dá para simplesmente desligar: **duas** faixas estão legitimamente vazias hoje, não só
      uma como este item dizia antes de alguém contar de verdade. `integration` resolve para
      **zero**: os 4 arquivos que existem sob `tests/integration/` estão todos em
      `tests/integration/guards/`, que o projeto `integration` exclui por glob — as integrações
      de verdade (`discovery/`, `storage/`, `git/`, `process/`) só chegam nas tarefas seguintes.
      `tests/e2e/` também está vazio, até S1-T6.
      - guard que afirma que **cada projeto do vitest resolve para pelo menos um arquivo de
        teste**, dirigido por uma lista declarada — mesmo padrão da matriz de camadas
      - a lista declara explicitamente quais faixas podem estar vazias **e por quê** (hoje
        `integration`, até S1-T2, e `e2e`, até S1-T6)
      - **simétrico**: o teste falha também se uma faixa declarada como vazia deixar de estar.
        Sem isso, a exceção vira permanente sem ninguém notar quando o primeiro teste da faixa
        chegar.
      *Aceite:* renomear um diretório de teste sem atualizar o `vitest.config.ts` **reprova** o
      portão. Provado por execução, não por leitura.

- [x] **S1-T0f — O prettier não é aplicado em lugar nenhum.** Achado ao investigar um efeito
      colateral do S1-T0e. Medido, não suposto:
      - `core.autocrlf` está `true` nesta máquina e **não existe `.gitattributes`**, então a
        árvore de trabalho é CRLF
      - o prettier usa `endOfLine: "lf"` por padrão, então `format:check` acusa **todos** os
        arquivos
      - confirmado que a divergência é só fim de linha: a saída do prettier comparada com o
        arquivo, ignorando CR, é idêntica. Não há problema de formatação real
      - `format:check` **não está** no `verificar`, e o `lint-staged.config.js` roda
        `eslint --fix` e `tsc` — **não roda prettier**
      Ou seja: há `.prettierrc.json`, `.prettierignore`, dois scripts npm e uma seção de
      formatação no `AGENTS.md`, e **nada disso é verificado**. É padrão que existe no papel. Pior,
      o único comando que o checaria está permanentemente vermelho num checkout Windows, o que
      garante que ninguém passe a usá-lo: quem roda uma vez conclui que está quebrado.
      - fazer `format:check` passar num checkout Windows sem alterar conteúdo
      - **aplicar em algum lugar** — portão ou pre-commit. Decida qual e justifique; um padrão que
        ninguém verifica volta a divergir sozinho
      - se for preciso reformatar em massa, **commit separado** do commit que liga a verificação,
        senão o diff fica irrevisável
      *Aceite:* `npm run format:check` verde nesta máquina, e um `.ts` deliberadamente mal
      formatado em stage é barrado ou corrigido no commit. Provado por execução.

- [x] **S1-T0g — As docs internas não alcançaram o D-028.** Precisa entrar **antes do S1-T6**, que
      é onde os nomes de comando viram código.
      O escopo real é maior do que "nome de comando": a especificação inteira estava escrita com
      identificadores em português — chaves do `config.json`, chaves do handoff, layout de pastas
      em `~/.seeya/`, valores de enum e nomes de caso de uso.
      **Já feito pelo PO** (os dois documentos que o agente dev não altera): `ESPECIFICACAO.md` e
      `DECISOES.md` normalizados, 52 trocas, e o mapeamento inteiro fixado no glossário do
      `AGENTS.md` § Idioma, incluindo a tabela dos identificadores que vão para disco.
      **Falta**, e é o escopo desta tarefa:
      - `ARQUITETURA.md` — o bloco de `config.json` tem 11 chaves em português, e os casos de uso
        estão como `encerrarDia, iniciarDia, capturarSessao`
      - `PLANO-DE-ENTREGA.md`, `TESTES.md`, `FORA-DE-ESCOPO.md`, `QUESTOES.md` — nomes de comando
        e flags (`--sessao`, `--todas`, `--parar`)
      - `src/core/eligibility.ts:48` cita `~/.see-you-tomorrow/forks.json`, pasta que o D-027
        substituiu por `~/.seeya/`. É comentário apontando para caminho que não existe
      **O glossário manda.** Não invente nome: se faltar algum, pare e pergunte, para não haver
      dois nomes para a mesma coisa em dois arquivos.
      Duas coisas que **não** se traduzem: prosa em português (palavras como "fatos", "origem" e
      "caminho" também são texto corrido — trocar por busca cega destrói o documento; troque só
      dentro de crase, de chave JSON e de bloco de código), e registro histórico (o que está
      dentro de tarefa já `[x]` e os spikes descrevem o que era verdade na época).
      *Aceite:* nenhum identificador em português sobra fora de bloco histórico, a prosa continua
      em português, e `npm run verificar` verde.

- [x] **S1-T2 — `adapters/process`.** Liveness com desempate por `procStart`, nos 3 SOs.
      **Leia o `docs/spikes/F-procstart-por-so.md` antes de começar.** O formato do `procStart`
      é diferente nos três SOs e eles não se comparam entre si — no macOS nem é numérico. Aquele
      spike já rastreou os três, mas os achados **não foram verificados de forma independente**:
      confirme antes de construir em cima.
      Duas armadilhas registradas lá e aqui: no Windows o `SIGTERM` do Node chama
      `TerminateProcess`, que mata sem o processo salvar nada — usar isso viola D-002 parecendo
      cumpri-lo. E `EPERM` em `process.kill(pid, 0)` significa **vivo**, não morto.
      Quando o desempate não puder ser avaliado, `isAlive` **não** responde `false` (D-025).
- [x] **S1-T2b — Encerramento gracioso no Windows, por evento de console.** Nasce do Spike G,
      que **revoga** a conclusão do S1-T2 de que não havia caminho no Windows. Aquela conclusão
      foi tirada por raciocínio e não sobreviveu à primeira medição.
      **Leia `docs/spikes/G-ctrl-break-no-windows.md` antes de começar** — ele traz a técnica, os
      dois hospedeiros medidos e duas armadilhas de interpretação que já produziram leitura errada.
      - trocar o no-op do Windows em `src/adapters/process/termination.ts` por
        `CTRL_BREAK_EVENT` (nunca `CTRL_C_EVENT` — medido, é ignorado), via `AttachConsole` +
        `SetConsoleCtrlHandler(NULL, TRUE)` + `GenerateConsoleCtrlEvent`, por P/Invoke no
        PowerShell. **Sem dependência nova** — mesma técnica do adapter de notificação
      - `AttachConsole` falhando (sessão sem console, erro 6) devolve `false` honesto: é o caso
        que sobrou do aviso exigido por Q-007
      - depois de enviar, espera limitada e **reconfere a realidade**, como o caminho POSIX já faz
      - o comentário do módulo hoje **afirma que isso é impossível**. Ele não fica desatualizado:
        fica mentindo, e persuade quem ler a não tentar. Reescrever é parte da tarefa
      **Risco de desenho, receba pronto:** o evento vai para o **console**, não para o PID. Se o
      `seeya` estiver no mesmo console do alvo, ele se atinge. O helper se protege soltando o
      próprio console antes de anexar; o processo `seeya` pai **não**. Trate explicitamente.
      *Aceite:* teste que prova **graciosidade**, não morte — processo de controle com handler que
      grava marcador antes de sair; marcador escrito = teve chance de salvar. Mais o caso sem
      console devolvendo `false`. `verificar` e `verificar:linux` verdes (o caminho POSIX não muda).
- [x] **S1-T3 — `adapters/discovery`, estratégia por registro.** Lê
      `~/.claude/sessions/*.json`, tolerante a arquivo corrompido. Exclui forks de `forks.json`
      (D-012). Sessão sem transcript entra normalmente, com `hasTranscript: false` (D-013).
      Corrige Q-006 (`procStart` do macOS): o `regex` saiu do schema, virou `z.string().min(1)`.
      Entrada obsoleta (PID morto) entra na lista normalmente, com `processIsAlive: false` —
      não é excluída nem tratada como sinal de trabalho concluído (docs/spikes/E: o registro é
      apagado na saída graciosa, então uma entrada obsoleta só sobrevive a queda anormal, e é
      reportada como sessão encerrada, não descartada — já era o que `docs/ESPECIFICACAO.md` e o
      tipo de S1-T1 diziam). Formato de `~/.seeya/forks.json`: Q-008 fechada, opção B — objeto
      raiz com `schemaVersion` (`{ "schemaVersion": 1, "forks": [...] }`), `schemaVersion` ou
      `forks` ausentes/inválidos viram rejeição visível, cada item segue exigindo só `sessionId`.
- [x] **S1-T8 — Estratégia por varredura de transcripts (D-016).** Varre
      `~/.claude/projects/**/*.jsonl` por mtime dentro de `relevanceHours`, sem ler conteúdo
      antes de filtrar. Reconstrói o `cwd` a partir do transcript, já que o slug não é
      reversível com segurança.
      *Aceite:* sessão headless — que não aparece no registro — é descoberta. Um `~/.claude`
      falso com 500 transcripts é filtrado sem parse de conteúdo.
      **Implementado:** `src/adapters/discovery/transcript-scan.ts` (estratégia,
      `discoverSessionsFromTranscriptScan`) + `transcript-cwd.ts` (leitura mínima do `cwd`,
      linha a linha, para de ler assim que encontra). `stat` decide dentro/fora de
      `relevanceHours` antes de qualquer leitura de conteúdo; forks de `forks.json` são
      excluídos antes de abrir o arquivo (reaproveita `fork-registry.ts` da S1-T3, sem
      duplicar leitura). Prova por execução do item 2 do aceite: fixture com 500 transcripts
      obsoletos, cada um uma *pasta* com o nome `<uuid>.jsonl` (abrir como arquivo falharia,
      então sua ausência de `rejected` prova que nunca foram abertos) + um caso de controle
      idêntico *dentro* da janela, que precisa aparecer rejeitado — descarta a hipótese de que
      o filtro estivesse ignorando todo `.jsonl`-pasta por acidente, não por mtime. Linha
      truncada no fim tolerada (não derruba a sessão nem o lote); transcript >1 MB com `cwd` na
      primeira linha lido em poucos KB (`bytesRead` medido no teste). Transcript sem `cwd`
      legível em nenhuma linha é **rejeitado**, não descartado em silêncio nem inventado como
      sessão (D-025) — decisão registrada em Q-009 por ambiguidade quanto ao tipo de domínio.
      `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S1-T10 (REVOGADA por D-029) — Terceira estratégia: processo e `.key` sem `.json` (D-023).** Cobre o agente de
      **Entregue e depois revogada.** O D-029 tirou esta estratégia: a causa que o D-023
      atribuía não se confirmou em medição, e o custo era desproporcional. O código sai na
      S1-T11. Fica marcada como entregue porque foi — e como revogada porque não vale mais.
      execução autônomo, que as duas estratégias anteriores não veem: sem `.json` no registro e
      sem transcript.
      - listar `~/.claude/sessions/` e achar `<pid>.<hash>.key` **sem** `<pid>.json` — só o nome
        do arquivo. O `.key` é material sensível (modo 600): **nunca ler o conteúdo**
      - confirmar liveness e obter `cwd` + linha de comando enumerando processos: Linux por
        `/proc/<pid>/cwd`, macOS por `lsof`, Windows sem `cwd` (degrada, e lá essas sessões
        produzem `.json` de qualquer forma)
      - extrair da linha de comando o que serve de handoff: o comando e o item de trabalho
      - sessão vinda só desta origem entra com `sessionId: null` e nunca é candidata a
        encerramento de processo
      **A união de tipos vai precisar crescer, e isso é esperado.** O tipo de S1-T1 tem duas
      formas: com `pid` (e `sessionId`) e sem `pid` (e com `sessionId`). Esta origem é o inverso
      que ainda não existe: tem `pid` e **não tem `sessionId`** — o `.key` dá o PID, e o processo
      dá `cwd` e linha de comando, mas nenhum dos dois dá o id da sessão. Quem implementar decide
      a forma junto com o PO; o importante é não forçar um `sessionId` sintético só para caber no
      tipo atual, o que criaria um identificador falso que a deduplicação de S1-T9 usaria.
      *Aceite:* uma sessão lançada por script com prompt como argumento é descoberta, com `cwd` e
      linha de comando, num `~/.claude` falso + processo de teste. E um `.key` cujo PID **não**
      está vivo é ignorado, não reportado como sessão.

- [x] **S1-T12 — O piso de cobertura por diretório não existe.** Achado ao revisar a S1-T11, e é
      a **terceira** vez que este projeto encontra a mesma forma: uma garantia que existe só no
      texto (antes foram o `passWithNoTests` em S1-T0e e o prettier em S1-T0f).
      Medido, não suposto:
      - `docs/TESTES.md` afirma: "Cobertura mínima: `core/` 95%, demais diretórios de produção
        80%. **Configurado por diretório no vitest, e o CI falha abaixo disso.**"
      - o comentário do próprio `vitest.config.ts` repete "Per-directory coverage"
      - a realidade: a chave `'src/**'` aplica o limite ao **agregado**, não por diretório
      - prova: hoje `adapters/process` está em **78,19%** e o portão passa, porque o agregado
        está em 91,7%. Um diretório inteiro pode despencar sem ninguém saber
      O risco não é teórico: quanto mais código bem coberto entra, **mais folga o agregado dá**
      para um diretório mal coberto se esconder. A proteção afrouxa justamente conforme o projeto
      cresce, que é o oposto do que se quer.
      - fazer o limite valer por diretório de verdade, ou **corrigir os dois textos** para
        descreverem o que existe. As duas saídas são honestas; o que não é aceitável é a
        divergência atual
      - se escolher fazer valer: `adapters/process` vai **reprovar** hoje, e isso é o teste do
        conserto. Ou cobre, ou registra a exceção com motivo — não afrouxe o piso para caber
      *Aceite:* baixar a cobertura de um diretório abaixo do piso **reprova** o portão. Provado
      por execução, não por leitura.
- [x] **S1-T13 — O teste de terminação graciosa no Windows é intermitente.** Achado ao rodar o
      portão depois da S1-T12. **Não é regressão dela** — medido isolado, o arquivo passa em
      11,17s; o que mudava era a concorrência da suíte completa. Reproduzido de verdade uma vez
      (`npm run cobertura`, timeout em 15114ms) antes do conserto abaixo.
      **A causa original suspeitada — `Add-Type` recompilando C# a cada chamada — estava errada.**
      Medido isoladamente (script `-EncodedCommand` equivalente, 5 execuções): `Add-Type` custa
      200-350ms, muito longe de explicar um estouro de vários segundos. A causa real, encontrada
      instrumentando `sendCtrlBreak` com timestamps: depois que o helper do PowerShell transmite
      `CTRL_BREAK_EVENT` para o console em que ele mesmo está anexado, ele recebe o próprio evento
      — e o Windows leva **~5,5s medidos consistentemente (5,3s-5,6s em 3 execuções)** para
      encerrar de fato o processo do helper, mesmo com a resposta (`'sent'`) já escrita no stdout
      bem antes disso. `runPowerShellScript` esperava esse `close` antes de resolver a promise,
      então esse tempo morto entrava inteiro na duração do teste.
      **Conserto pela família B (custo, não tempo limite).** `console-signal.ts` ganhou
      `runSendScript`: resolve assim que a palavra de resultado aparece no stdout, sem esperar o
      processo fechar, e mata o helper (não é a sessão do usuário — D-002 não se aplica a esta
      plumbing interna). Isolado, o teste caiu de 7,29s para ~1,7s. Sob carga real
      (`npm run cobertura`, suíte completa, 3 execuções): 3891ms, 3149ms, 4115ms — o orçamento do
      teste desceu de 15s para **10s**, com margem real medida, não chutada (comentário ao lado do
      `it(...)` em `tests/integration/process/termination.test.ts`).
      **Não serializamos a faixa.** O `vitest.config.ts` já documenta por que isso escondeu uma
      corrida real no S0-T6 e custou seis rodadas no S1-T0 — aqui a resposta certa era reduzir o
      custo real da operação, e foi isso que resolveu o problema por completo, não só acomodá-lo.
      *Aceite:* `npm run verificar` rodou **5 vezes seguidas, 5 verdes** (ver relatório da tarefa).
      `npm run verificar:linux` verde. O teste continua verificando o marcador de shutdown do
      processo filho (`markerExists(marker)` ainda é `true`) — a garantia de graciosidade não foi
      enfraquecida, só o desperdício de tempo em volta dela.
- [x] **S1-T9 — Fusão das estratégias de descoberta.** Implementa a porta `SessionProvider`:
      `list()` devolve a união **já deduplicada**, nunca a concatenação crua. Quem chama não
      precisa saber quantas estratégias existem embaixo nem deduplicar por conta própria.
      **Reescrita em 2026-08-29 por causa do D-029.** O texto anterior falava em três
      estratégias e deduplicação por PID — os dois saíram com a revogação do D-023. Sobraram
      **duas** origens, e ambas fornecem `sessionId`:
      - **registro** (S1-T3): dá `pid`, `procStart`, liveness, `kind`, `name`
      - **varredura de transcript** (S1-T8): enxerga headless, dá `lastActivity` por mtime,
        entra com `pid: null` e nunca é candidata a encerramento de processo (D-002)
      - deduplicação **por `sessionId`**, só. Não há mais origem sem ele
      **A regra de fusão precisa ser decidida, não improvisada.** Quando a mesma sessão aparece
      nas duas origens, quem vence em cada campo? O registro é mais rico, mas o mtime do
      transcript pode ser **mais recente** que a última atividade que o registro conhece. Perder
      atividade recente é pior que perder um campo cosmético. Decida por campo, escreva o porquê,
      e registre em `docs/QUESTOES.md` se ficar ambíguo.
      **As rejeições também se somam.** As duas estratégias devolvem `{ sessions, rejected }`.
      A união preserva as duas listas — "3 sessões, 2 entradas ignoradas" continua verdadeiro
      depois da fusão, senão a visibilidade que S1-T3 e S1-T8 construíram morre aqui.
      *Aceite:* sessão presente nas duas origens aparece **uma** vez, com os campos fundidos
      segundo a regra escrita; sessão presente em uma só entra com a forma daquela origem; e as
      rejeições das duas aparecem somadas.
- [x] **S1-T4 — `adapters/transcript`.** Parser streaming; últimos prompts, arquivos
      tocados, última atividade.
      **Implementado:** porta `TranscriptReader`/tipo `SessionFacts` em `core/` (aditivo a
      `core/ports.ts`, sem reorganizar o arquivo — a S1-T5 mexe no mesmo arquivo em paralelo).
      `src/adapters/transcript/{schemas,facts,reader,index}.ts`: `reader.ts` lê o `.jsonl` linha a
      linha (`node:fs` `createReadStream`, reaproveitando o `splitLines` de
      `discovery/transcript-cwd.ts`), nunca carregando o arquivo inteiro em memória — provado por
      medição: `maxLineBufferBytes` (o pico do buffer de linha pendente) fica em torno de um chunk
      de stream (~65 KB) mesmo num fixture de >2 MB, e o teste compara os dois por execução, não
      por afirmação (`tests/integration/transcript/reader.test.ts`). Tipo de entrada desconhecido é
      contado (`unknownEntryTypeCount`) sem derrubar a leitura nem virar rejeição; linha truncada
      no fim vira rejeição individual (D-022) sem abortar as demais. Fixtures **sintéticas**
      (nenhum dado real) em `tests/fixtures/transcripts/`, moldadas pelas formas de
      `adapters/transcript/schemas.ts`. Cinco pontos não ancorados em texto registrados em Q-014.
      `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S1-T7 — Detecção precoce de sessão sem transcript.** Notificação uma vez por
      `sessionId`, disparada quando a sessão é vista, não no encerramento (D-013).
      *Aceite:* sessão registrada sem `.jsonl` gera exatamente uma notificação, e a segunda
      passagem da descoberta não repete.
      **D-029 estende esta tarefa:** além da sessão registrada sem transcript, avisar também
      sobre `.key` sem `.json` — sessões que o `seeya` vê existir e **não consegue inspecionar**.
      Só o **nome** do arquivo, nunca o conteúdo (modo 600). O aviso **não afirma** a causa: ela
      não está estabelecida (ver D-029). Diga o que se sabe e aponte o caminho conhecido.
      A listagem de `.key` sem `.json` foi removida pela S1-T11 em vez de ficar parada sem uso.
      Recupere de `src/adapters/discovery/process-key.ts` no commit `e45b348` — ela já era testada,
      e reescrever do zero seria desperdício.
      **Implementado.** Regra pura em `src/core/early-warnings.ts#detectEarlyWarnings`: dado o
      lote de `DiscoveredSession` já fundido (S1-T9), os nomes de `.key` sem `.json`
      (`src/adapters/discovery/uninspectable-keys.ts`, lógica recuperada do commit `e45b348`) e o
      estado "já avisado" anterior, devolve só os avisos **novos** e o próximo estado. Persistência
      aditiva na porta `Storage` (`core/ports.ts`): `readEarlyWarningState`/`saveEarlyWarningState`,
      implementadas em `StorageAdapter` contra `~/.seeya/early-warnings.json` (novo documento, com
      `schemaVersion` via o mecanismo de `schema-version.ts` já existente). Orquestração em
      `src/adapters/discovery/early-warnings.ts#discoverEarlyWarnings` — função nova e separada de
      `DiscoverySessionProvider` de propósito, para não mexer no construtor que a S1-T6 (em
      paralelo) já compõe; só grava o arquivo quando há aviso novo. O segundo gatilho dedupe pelo
      **nome completo do arquivo `.key`** (não o PID: o SO recicla PID, e um hash novo por sessão
      não colide mesmo com PID reciclado — raciocínio completo no topo de `early-warnings.ts`). O
      aviso do primeiro gatilho afirma causa e correção (D-018); o do segundo nomeia só o que se
      observa e um lead conhecido, sem afirmar causa (D-029). Nenhum código/teste lê conteúdo de
      `.key`. Três pontos registrados em Q-016 para confirmação (nomes de disco novos fora da
      tabela do `AGENTS.md`, a escolha da chave de dedup, e a função separada em vez de crescer
      `DiscoverySessionProvider`). `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S1-T11 — Reverter a terceira estratégia (D-029).** Remove o que a S1-T10 acrescentou.
      - sai: `adapters/discovery/process-key.ts`, `adapters/process/inspection.ts`, os métodos
        `readCwd`/`readCommandLine` de `ProcessControl`, e a terceira forma da união de tipos
      - **sai também a listagem de `.key` sem `.json`** (mudei de ideia depois de escrever esta
        tarefa): a S1-T7 ainda não existe, então mantê-la deixaria código de produção sem uso, e
        este projeto não guarda código especulativo. A lógica não se perde — está em
        `src/adapters/discovery/process-key.ts` no commit `e45b348`, de onde a S1-T7 recupera
      - `spawn-stdout.ts` é compartilhado com `proc-start.ts`: **não remova** sem conferir
      - a união volta a duas formas. Confira se o discriminante `hasSessionId` ainda paga o
        próprio custo com uma forma só — se não pagar, remova-o também
      - a regra de teste de tipo registrada em `docs/TESTES.md` (o `const` anotado pela união)
        **fica**: ela não depende desta estratégia e custou caro para ser achada
      *Aceite:* núcleo de volta a duas formas, `verificar` e `verificar:linux` verdes, e nenhuma
      leitura de linha de comando em lugar nenhum do código.
- [x] **S1-T5 — `adapters/storage`.** Raiz injetável, escrita atômica, config com
      defaults, `schemaVersion`.
      **Implementado:** porta `Storage` em `src/core/ports.ts`, aditiva (só `readConfig` por
      enquanto — `saveHandoff`/`readBriefing`/`saveState` esperam `Day`/`Handoff`/`Briefing`/
      `DayState`, que ainda não existem). `StorageAdapter` (`src/adapters/storage/index.ts`) com
      raiz `seeyaHome` injetada no construtor, nunca `os.homedir()`.
      **Atomicidade provada por execução, não por confiar no padrão** (`atomic-write.ts` +
      `tests/integration/storage/atomic-write.test.ts`): um processo real
      (`tests/fixtures/storage/slow-atomic-write.mjs`) é morto com `SIGKILL` em vários pontos
      diferentes no meio da escrita, e o arquivo em disco é conferido depois — sempre íntegro,
      antigo ou novo, nunca pela metade. Medido também que `rename` sobre destino existente e
      **desocupado** se comporta igual em Windows e POSIX (Node/libuv já usa
      `MOVEFILE_REPLACE_EXISTING`), mas que Windows **recusa** o `rename` (`EPERM`) se outro
      processo tiver o destino aberto para leitura no instante exato — POSIX não recusa. Sem
      retry (exigiria `setTimeout`, proibido fora de `adapters/clock/` por D-019, e não há hoje
      um segundo escritor/leitor concorrente de `config.json`); documentado como limite conhecido
      no comentário do módulo.
      **Mecanismo de `schemaVersion`** (`schema-version.ts`): detecta a versão do documento e
      decide — já na versão esperada, migra pela tabela registrada, ou recusa (versão
      desconhecida/mais nova nunca é lida como compatível). Só existe a versão 1 hoje, então a
      tabela de migrações em produção fica vazia de propósito; o teste unitário do mecanismo
      injeta uma migração sintética só no teste, para não inventar uma migração falsa em
      produção.
      **Duas lacunas encontradas e registradas em Q-013** (não bloquearam a tarefa, solução
      mínima seguida): `endOfDayTime` não tem default afirmado em lugar nenhum — implementei
      `null` (só manual), não o `"19:30"` do exemplo de `docs/ARQUITETURA.md`, pelo espírito
      opt-in de D-002/D-011; e `forkCleanupDays` (D-012) não está na tabela de chaves do
      `AGENTS.md`, então não entrou no tipo `Config`.
      `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S1-T6 — `seeya sessions` e `seeya status`.**
      *Aceite do sprint:* `seeya sessions` lista corretamente as sessões reais desta máquina,
      incluindo as obsoletas, e o e2e nº1 passa.
      **Implementado:** `src/cli/composition.ts` é a raiz de composição (D-020) — o único módulo
      que nomeia `StorageAdapter`, `DiscoverySessionProvider`, `processControl` e `systemClock` e
      os injeta via `buildCliContext`. `seeya sessions` (`session-view.ts` + `format-sessions.ts`
      + `sessions-command.ts`) lista vivas/ociosas/encerradas/desconhecidas e **as rejeições**
      ("N sessions, M entries ignored") — D-022/Q-012 finalmente chegando a quem lê. Campo
      cosmético ausente (`name`) nunca esconde a sessão (D-021); `lastActivity: null` aparece como
      "unknown", nunca inventado (D-025). `seeya status` (`eligibility-view.ts` +
      `format-status.ts` + `status-command.ts`) saiu com escopo reduzido, registrado em Q-015:
      mostra `endOfDayTime` e a contagem de elegíveis/descobertas, mas não "quanto falta"
      (`core/schedule`, S4-T2), adiamentos/dia pulado (S4-T4) nem status do daemon (S4-T3) —
      nenhum desses existe ainda, e inventar o valor seria o erro que `AGENTS.md` proíbe.
      `adapters/clock/index.ts` ganhou sua primeira implementação real (`systemClock`), esperada
      desde S1-T1 e ainda vazia até aqui. `_test-projects.ts`: faixa `e2e` deixou de ser vazia de
      propósito (tests/e2e/sessions.test.ts). `_coverage-directories.ts`/`vitest.config.ts`:
      `cli/` passou de `excluded` para `covered` a 80% (só `index.ts` continua fora do
      `coverage.include`, por ser wiring fino do `commander` exercitado de verdade só pelo e2e).
      E2e nº1 roda `node dist/cli/index.js` (o artefato compilado, nunca `src/` via `tsx`/vitest)
      com `HOME`/`USERPROFILE` em `tmpdir` e um `claude` falso no PATH (`pretest:e2e` builda antes
      de cada `npm run test:e2e`), contra processos reais spawnados (vivo sem transcript, vivo com
      transcript antigo, morto) mais uma entrada de registro corrompida. `npm run verificar` e
      `npm run verificar:linux` verdes.

---

## Sprint 2 — Encerrar o dia

- [x] **S2-T1 — `adapters/git`.** Branch, status, commits do dia e **enumeração de
      worktrees** com o estado de cada um (D-013). Sem quebrar quando o `cwd` não é repo.
      *Aceite:* repo de teste com dois worktrees, um sujo e um limpo, produz o estado correto
      dos dois.
      **Implementado:** porta `GitReader`/tipo `GitReadResult` em `core/ports.ts` (aditiva, ao
      final do arquivo — outro agente mexe no mesmo arquivo em paralelo na S2-T2), tipos
      `GitFacts`/`GitCommit`/`WorktreeFacts` em `core/types.ts` (mesma disciplina aditiva).
      `src/adapters/git/{run-git,repo,branch,status,commits,local-day,worktree-list,
      git-adapter}.ts`: `spawn('git', args, { cwd, shell: false })` sem shell, nunca comando por
      string. `cwd` fora de repositório (`git rev-parse --is-inside-work-tree` falha) devolve
      `{ hasGit: false }` — ausência de dado, nunca `branch`/`dirty` inventados (D-025). "Commits
      do dia" filtrado em TypeScript contra `%cI` (data do committer) e os limites do dia local
      calculados a partir do `Clock` injetado (`local-day.ts#localDayBounds`, usa
      `getFullYear`/`getMonth`/`getDate` locais, não UTC) — `--since` do git só limita
      grosseiramente o histórico, nunca decide sozinho o que é "hoje" (D-019). Worktrees
      enumerados via `git worktree list --porcelain`, excluindo a entrada do próprio `cwd`; um
      worktree cujo diretório sumiu do disco (`git worktree list` ainda o lembra, mas nenhum
      comando roda nele) vira rejeição individual (`RejectedDiscoveryRecord`, D-022) sem derrubar
      os demais — provado com um repo de teste real (`tmpdir`, dois worktrees, um sujo e um
      limpo, mais um terceiro apagado do disco), commits datados de hoje e de ontem via
      `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`, e um teste de snapshot (`HEAD`, reflog, status
      antes/depois) provando que nenhum comando escreve no repositório. Quatro escolhas sem
      resposta literal na spec registradas em Q-017 (nome da porta, assimetria de `commitsToday`
      entre o nível superior e `worktrees[]`, data de committer vs. autor, `branch: string | null`
      para HEAD destacada). `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S2-T2 — `adapters/generation`.** Duas implementações, enxuta e profunda (D-011).
      Contexto por stdin ou arquivo, nunca por argumento (D-015). `--tools ""`,
      `--system-prompt` curto, `--json-schema`, timeout, orçamento, `spawn` sem shell, erro
      tipado. Registro do fork em `forks.json` no modo profundo.
      *Aceite:* teste com conteúdo contendo quebra de linha, aspas, acento e `%` chega íntegro
      ao processo filho; medição do piso de tokens antes e depois do `--tools ""` registrada.
      **Q-008:** o formato de `~/.seeya/forks.json` está fixado — `{ schemaVersion: 1,
      forks: [{ sessionId, createdAt }] }`. O `createdAt` é escrito desde já: S2-T6 precisa dele
      para `forkCleanupDays`, e acrescentá-lo depois vira migração de arquivo já existente.
      Implementado em 2026-08-29: `LeanHandoffGenerator`/`DeepHandoffGenerator`
      (`src/adapters/generation/`), fork registrado via `registerFork` (reaproveita o leitor de
      `adapters/discovery/fork-registry.ts`, agora com `readForkRegistryEntries` preservando
      `createdAt`). Medição real registrada em `docs/QUESTOES.md` Q-020 (achado: `--json-schema`
      não reduz o piso, aumenta — ver a questão). `HandoffGenerator.generate()` precisou do
      `DiscoveredSession` inteiro, não só `SessionFacts` — ver Q-019. `npm run verificar` e
      `npm run verificar:linux` verdes.
- [x] **S2-T3 — Caso de uso `endDay`.** Coleta multi-fonte com `sources[]` (D-013),
      concorrência limitada, isolamento de falha por sessão, fallback determinístico,
      anti-duplicidade, guarda de turno ativo. Handoff válido com qualquer fonte respondendo.
      **Q-007:** `terminateGracefully` devolvendo `false` com o processo ainda vivo não é erro e
      não aborta nada, mas **precisa aparecer no resultado do dia**, nomeando a sessão e o motivo.
      Silêncio aqui faz quem marcou `canTerminate: true` acreditar que a sessão fechou.
      **Implementado em 2026-08-29:** `src/application/{end-day,capture-session,
      evidence-gathering,generation-policy,eligibility-assembly,concurrency,types}.ts`.
      `endDay` lê a config, descobre sessões, filtra por elegibilidade em dois estágios (barato,
      sem I/O, para quatro das cinco condições; completo, com evidência fresca, só para
      anti-duplicidade D-026) e captura cada sessão elegível sob `mapWithConcurrencyLimit`
      (`captureConcurrency`, default 3), isolando falha por sessão num `try`/`catch` por
      pipeline — uma sessão que lança nunca derruba as outras (provado em
      `tests/unit/application/end-day.test.ts`). `sources[]` reflete exatamente quem respondeu
      (`registry` ⟺ `hasPid`; `git` ⟺ `hasGit`; `transcript` ⟺ `hasTranscript` e a leitura não
      lançou), nunca "tentou". `source` descreve procedência da camada de entendimento, não a
      evidência de entrada (revisado no review, Q-021 item 1): `"model"` no sucesso da geração
      e `"deterministic"` na falha (D-003), **em qualquer um dos dois casos com ou sem
      transcript** — sessão sem transcript ainda roteia para o gerador enxuto (nunca o profundo,
      D-018), e um sucesso dessa chamada é `"model"` como qualquer outro; `sources[]` é quem
      registra a ausência de transcript, não `source`. `"noTranscript"` continua no enum para o
      estado em que o modelo **não é chamado** — não produzido por este código hoje.
      Anti-duplicidade (D-026) reconstrói a assinatura do `facts` já persistido em vez de
      inventar um campo novo em disco (Q-021 item 3, com o risco da reconstrução — mudança de
      forma dos fatos comparando em silêncio contra regras antigas — escrito em
      `core/evidence.ts#buildEvidenceSignature`); `Storage` ganhou `saveHandoff`/`readHandoff`,
      já incorporado ao esboço de `ARQUITETURA.md` pelo mantenedor (Q-021 item 4) — não
      conveniência, é o método que verifica o handoff em disco antes de terminar o processo.
      D-002: `saveHandoff` → `readHandoff` de verificação → só então `terminateGracefully`; falha
      no save ou verificação que volta `null` aborta a terminação sem exceção vazando (provado em
      `tests/unit/application/capture-session.test.ts`, incluindo a ordem exata das chamadas).
      Q-007: `terminateGracefully` devolvendo `false` com o processo vivo gera um
      `TerminationNotice` nomeado (`sessionId`/`cwd`/`name`/motivo) em
      `EndDayResult.terminationNotices`, nunca silencioso. `EndDayDeps` recebe `leanGenerator` E
      `deepGenerator` (não um só) porque a escolha por sessão depende de `hasTranscript`, só
      conhecido em runtime — Q-021 item 2. `knownForks` sempre vazio em `endDay`, com o risco de
      segunda ordem (se a exclusão rio acima falhar, o filtro para sem nada quebrar) escrito em
      `application/eligibility-assembly.ts#NO_KNOWN_FORKS` (Q-021 item 5). Q-021 fechada:
      confirmado nos itens 2 a 5, item 1 corrigido. `npm run verificar` e `npm run
      verificar:linux` verdes; `application/` em 100% linhas/statements, 98% branches.
- [x] **S2-T6 — Limpeza de forks.** Apaga forks próprios com mais de `forkCleanupDays`.
      *Aceite:* apaga apenas IDs presentes em `forks.json`; um teste prova que nenhum outro
      arquivo de `~/.claude/projects/` é tocado.
- [x] **S2-T4 — Briefing.** Geração do `summary.md` a partir dos handoffs.
      **Implementado em 2026-08-29:** `core/briefing.ts#generateBriefingMarkdown` é a regra pura
      (sem I/O, sem `Date.now()`, D-019) que renderiza o markdown a partir de `Handoff[]` e das
      rejeições de D-022; `application/briefing.ts#writeDailyBriefing` é a casca de I/O que lê
      `Storage#listHandoffs(day)` (nova, valida item a item — D-022 já citava "os handoffs lidos
      de `~/.seeya/`" como coleção externa) e grava com `Storage#saveBriefing` (nova, reaproveita
      `writeFileAtomic` da S1-T5). `endDay` chama isso como seu passo 3, relendo todos os handoffs
      do dia do disco — não só os desta execução — para que `seeya end-day --session <id>` (S2-T5)
      rodado mais de uma vez no mesmo dia continue produzindo um briefing consolidado. `source:
      "deterministic"` vira um blockquote de aviso explícito ("entendimento não disponível, a
      falha foi do modelo"); `capturedDuringActiveTurn: true` aparece colado à linha de estado;
      evidência parcial (`sources[]` incompleto) nomeia exatamente o que faltou; dia sem handoff
      nenhum produz "No sessions were captured today." em vez de silêncio ou invenção; handoff
      ilegível vira uma linha nomeada em "Unreadable entries", sem derrubar os demais. `Storage`
      cresceu como um segundo bloco `export interface Storage {}` mesclado pelo TypeScript (não
      editado no corpo original) — S2-T6 mexe no mesmo arquivo em paralelo, e o histórico dele já
      registrou merge quebrado por corte no meio de uma interface. Nome `saveBriefing` não estava
      na tabela de disco do `AGENTS.md` (só `readBriefing` estava, reservado para S3-T1); segui o
      par `save<Nome>`/`read<Nome>` já usado por `saveHandoff`/`saveEarlyWarningState`. Três
      escolhas registradas em Q-022 para confirmação. `npm run verificar` e `npm run
      verificar:linux` verdes; `core/` e `application/` em 100% de linhas e branches nos dois.
      **Implementado em 2026-08-29:** `forkCleanupDays` (D-012, default 7) faltava no `Config`
      desde a Q-013 (S1-T5 tinha registrado a lacuna sem inventar a chave) — acrescentado agora em
      `core/types.ts`/`adapters/storage/config-schema.ts`, primeira leitura real. Decisão pura em
      `core/fork-cleanup.ts#planForkCleanup`: idade comparada a partir do `Clock` injetado (D-019,
      nunca `Date.now()`), "mais de" é estritamente maior (fork com idade exata no limite é
      mantido), e uma entrada sem `createdAt` é sempre mantida — nunca tratada como "óbvia
      candidata" por falta de prova (D-025). Porta nova `ForkCleanup` em `core/ports.ts`
      (`ForkCleanupOutcome` como união discriminada, D-024: `reason` só existe no caso `failed`),
      aditiva ao final do arquivo por causa da S2-T4 em paralelo no mesmo arquivo.
      `adapters/discovery/fork-cleanup.ts#DiscoveryForkCleanup` é a única exceção do projeto que
      apaga arquivo fora de `~/.seeya/` (D-012) — reaproveita o leitor de `fork-registry.ts` (S1-T3)
      e o `locateTranscriptFile` de `transcript-lookup.ts` (S1-T4) em vez de duplicar a busca do
      `.jsonl`. Cada fork stale é resolvido independentemente (`Promise.all` com `try`/`catch` por
      item, D-022): uma falha real de exclusão (`failed`, com o erro bruto) nunca impede as outras,
      e um arquivo já ausente (`alreadyAbsent`) não é erro (D-025) — o usuário pode ter apagado à
      mão, e o objetivo da exceção já está satisfeito de qualquer forma. `forks.json` é reescrito
      atomicamente removendo só as entradas `deleted`/`alreadyAbsent` (`failed` fica para nova
      tentativa na próxima passagem); uma passagem sem nada para limpar nunca toca o arquivo.
      Contenção provada por instantâneo antes/depois de toda a árvore `~/.claude/projects/` (mesmo
      padrão do S2-T1 para git): conteúdo e `mtime` de um transcript real e de um fork ainda dentro
      do prazo ficam idênticos byte a byte; a única diferença é o arquivo do fork realmente stale
      desaparecendo (`tests/integration/discovery/fork-cleanup.test.ts`). Ainda sem raiz de
      composição em `cli/` — não existe hoje nenhum comando que precise disparar a limpeza (mesmo
      padrão já seguido por `adapters/generation` desde a S2-T2, sem wiring até existir chamador).
      Duas decisões sem resposta literal em D-012 registradas em Q-022 para confirmação do PO: o
      destino da entrada em `forks.json` após a exclusão, e o tratamento de arquivo já ausente.
      `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S2-T7 — O tempo limite do teste é igual ao do processo filho.** Diagnosticado pelo agente
      da S2-T6 ao investigar a intermitência recorrente do `eslint-restrictions.test.ts` — que já
      apareceu nas duas plataformas e foi atribuída a carga de máquina mais de uma vez.
      A causa é de desenho, e **mais funda do que este texto dizia originalmente**: eu escrevi que
      um mesmo valor servia de orçamento ao filho e de tempo limite ao teste. Não era isso — o
      `spawnSync` era chamado **sem opção `timeout` nenhuma**, então o filho não tinha orçamento
      próprio. Havia **um relógio só**, o do teste, matando o filho de fora.
      A consequência é pior que a lentidão: quando o filho demora, quem estoura primeiro é o
      **teste**, com "Test timed out" — em vez de o filho reportar o próprio estouro, que seria
      diagnosticável. A informação útil é sempre destruída pela corrida entre os dois.
      - o orçamento do teste tem que ficar **confortavelmente acima** do orçamento do filho, senão
        o interno nunca chega a disparar
      - a folga vem de medição, não de chute (mesma disciplina da S1-T13)
      *Aceite:* um filho que estoura o próprio orçamento produz falha **do filho**, com motivo
      legível, e não "Test timed out". Provado por execução.
      **Achado real (S2-T7): não existia orçamento nenhum no processo filho.** `run()` chamava
      `spawnSync` sem a opção `timeout` — o único relógio que já existia era o do `it(...)`, por
      fora. Por isso os dois "expiravam ao mesmo tempo": não eram dois relógios com o mesmo
      valor, era só **um** relógio (o do teste) fazendo o papel dos dois, e matando o filho antes
      que ele pudesse reportar por que estava lento.
      **Medido** (`npx vitest run --project guards` e `npm run cobertura`, 6 execuções nesta
      máquina): o filho legítimo mais lento — sempre um `eslint` real em
      `eslint-restrictions.test.ts`, cujo custo de parsing type-aware escala mal sob concorrência
      — terminou em 6246, 6676, 8808, 9834, 11618 e 11872ms. Uma dessas execuções, ainda sob o
      orçamento combinado antigo de 20000ms, reproduziu o bug de verdade: "Test timed out in
      20000ms" para um teste cujo próprio contador marcava 22239ms — o filho nunca tinha
      travado, só estava azarado sob carga, e o desenho antigo destruía essa distinção.
      `CHILD_PROCESS_BUDGET_MS = 30_000` (agora passado a `spawnSync({ timeout })`) fica ~2,5x
      acima do pior caso limpo (11872ms) e com folga real (>7,7s) sobre a execução contestada.
      `TEST_TIMEOUT_MS = CHILD_PROCESS_BUDGET_MS + 15_000 = 45_000` — a folga de 15s não é o
      tamanho do trabalho depois que o filho retorna (medido: matar via `timeout` do `spawnSync`
      volta ~10-25ms depois do valor configurado nesta máquina, sem o "ar morto" do console
      attach da S1-T13, que é um mecanismo diferente), é margem deliberada contra variação de
      agendamento sob carga real de CI.
      Teste de regressão novo: `tests/integration/guards/child-process-timeout.test.ts` força um
      comando falso (`node -e 'setTimeout(...)'`) a dormir além de um orçamento pequeno (300ms) e
      prova a mensagem legível: `"[guard child process exceeded its own 300ms budget
      (CHILD_PROCESS_BUDGET_MS) and was killed (SIGTERM) before finishing]"` — nunca "Test timed
      out". `npm run verificar` rodou **5 vezes seguidas, 5 verdes** (75 arquivos de teste, 671
      testes, 2 pulados por design). `npm run verificar:linux` verde (75 arquivos, 670 testes, 3
      pulados por design).
      **Não serializamos a faixa `guards`** — a causa aqui era o orçamento mal desenhado, não uma
      corrida real entre testes.
- [x] **S2-T5 — `seeya end-day` com `--dry-run` e `--session`.**
      *Aceite do sprint:* e2e 2, 3 e 4 passam. Encerramento com o modelo indisponível ainda
      produz handoffs úteis.
      **Implementado em 2026-08-30:** `src/cli/{end-day-command,format-end-day}.ts` +
      `composition.ts#buildEndDayContext` — a raiz de composição (D-020) finalmente nomeia os
      adapters de S2-T2 (`LeanHandoffGenerator`/`DeepHandoffGenerator`) e S2-T6
      (`DiscoveryForkCleanup`), prontos e desligados até aqui. `application/end-day.ts` ganhou
      `EndDayOptions` (`dryRun`/`sessionFilter`, ambos opcionais — nenhum call site anterior
      quebrou) em vez de um caminho paralelo: `--dry-run` percorre o mesmo pipeline real
      (descoberta, elegibilidade, evidência, geração) e só para exatamente no primeiro ponto de
      escrita (`capture-session.ts#persistAndMaybeTerminate`, a limpeza de forks e
      `application/briefing.ts#previewDailyBriefing`, que reaproveita `generateBriefingMarkdown`
      sem gravar). A única exceção deliberada: geração **profunda** nunca roda de verdade num
      dry-run — `--fork-session` escreveria um fork real em `~/.claude/projects/` por conta
      própria, fora do controle deste código, e isso violaria a regra inegociável de nunca
      escrever em `~/.claude/`; `generation-policy.ts#previewDeepCaptureOutcome` documenta o
      porquê e substitui só esse caso, sem tocar a geração enxuta (sem rodapé em disco, D-017).
      Prova de "escreve nada" por instantâneo da árvore inteira (conteúdo + mtime), mesmo
      instrumento do S2-T1/S2-T6 — `tests/e2e/end-day.test.ts`. `--session` (id ou `cwd`, string
      exata) filtra em `cli/`, não em `application/`: `endDay` recebe um predicado genérico
      (`sessionFilter`), nunca o conceito da flag. `EndDayResult` cresceu `dryRun`,
      `briefingPreview`, `sessionsInScope`, `forkCleanup`, `forkCleanupError` — todos aditivos.
      **Duas peças desligadas, uma ligada aqui:** limpeza de forks (D-012) entrou em
      `EndDayDeps.forkCleanup`, chamada como passo próprio de `endDay` (isolada como uma falha de
      captura, nunca aborta o resto); avisos precoces (D-018/S1-T7) foram decididos como
      pertencentes a `seeya sessions`, não a `end-day` — D-018 fala em "assim que a sessão é
      vista", que é a descoberta, não a rotina diária —, mas a fiação em si **não** foi feita
      nesta tarefa, para não alterar o contrato de um comando já aprovado (S1-T6) e sua suíte, fora
      do escopo orçado aqui. Argumento completo em `docs/QUESTOES.md` Q-024, junto com a segunda
      decisão (limpeza de forks nunca pré-visualizada em `--dry-run`, só pulada — `ForkCleanup` não
      tem hoje um modo somente-leitura). `tests/e2e/_harness.ts` passou a montar um `claude` falso
      de verdade no PATH (reaproveitando `tests/integration/generation/_fixtures.ts`, inclusive o
      shim `.exe` do Windows) — a versão anterior (S1-T6) nunca precisava disso, já que nenhum
      comando existente chamava `claude`. Achado no caminho: o diretório certo para o PATH é
      `path.dirname(fixture.binaryPath)`, não `fixture.dir` — no Windows os dois divergem (o `.exe`
      compilado vive num diretório de shim próprio, memoizado por processo), e usar o errado faz a
      resolução de PATH cair silenciosamente no `claude` real da máquina. `npm run verificar` e
      `npm run verificar:linux` verdes; `cli/` e `application/` em 100% de linhas nos dois.

---
- [x] **S2-T8 — Os orçamentos do Windows não têm folga para o CI.** O CI ficou **vermelho só no
      Windows** ao fechar o Sprint 2, com Ubuntu e macOS verdes. Duas causas distintas, as duas
      medidas nesta máquina e nunca no runner:
      - `tests/integration/process/termination.test.ts` usa `10_000` explícito, número que a
        S1-T13 mediu **aqui** quando a suíte tinha ~290 testes. Hoje são 714, e a contenção no
        runner é outra
      - `Hook timed out in 10000ms` no fixture de geração: é o **padrão do vitest para hooks**,
        estourado pelo `beforeAll` que compila o shim `.exe` com o `csc`. Num runner frio isso é
        caro, e o `Cannot convert undefined or null to object` que aparece junto é cascata do
        fixture ter ficado indefinido
      **A lição já está no repositório e eu não a apliquei:** a S1-T13 e a S2-T7 estabeleceram que
      número de orçamento vem de medição. O que faltou dizer é **onde** medir — medir na máquina do
      desenvolvedor e publicar é o mesmo erro de sempre, com outra roupa. O CI é o ambiente mais
      lento e mais contido dos três, e é ele que decide.
      - separe as duas causas: o tempo limite explícito do teste e o do hook
      - considere se o shim `.exe` precisa ser compilado **por worker** do vitest. Se cada arquivo
        de teste em um worker próprio recompila, o custo cresce com a suíte — e aí subir o tempo
        limite trata sintoma
      *Aceite:* CI verde nos **três** sistemas, conferido por execução (`gh run watch`), não só o
      portão local. E o número novo com a justificativa da folga escrita ao lado.


## Sprint 3 — Começar o dia

**Estado do sprint, corrigido em 2026-09-12.** S3-T4 a S3-T7 estavam marcadas `[~]` desde a
aceitação do sprint, embora mescladas e aceitas — a varredura de 10/09 corrigiu o Sprint 4 e não
olhou este. Quem achou foi uma sessão limpa do Codex, sem saber que estava sendo testada
(`docs/spikes/L-outro-harness.md`).

- [x] **S3-T1 — Leitura do briefing pendente** e montagem do prompt de retomada por sessão.
      **Implementado em 2026-08-30:** `Storage` ganhou `readBriefing(day)` (`core/ports.ts`,
      segundo bloco mesclado ao fim do arquivo — mesmo padrão de Q-022 item 2, porque a S3-T2
      mexe no mesmo arquivo em paralelo) e o tipo `Briefing` (`{ day, handoffs, rejected }`,
      reservado desde S1-T0g/Q-022): nenhum formato novo em disco, é `listHandoffs(day)` com
      `day` anexado — `null` só quando não há nada gravado para aquele dia (D-025).
      `application/find-pending-briefing.ts#findPendingBriefing` implementa o passo 1: caminha
      para trás um dia local por vez (`core/day.ts#subtractLocalDays`, novo, D-019) a partir do
      `Clock` injetado, parando no primeiro dia cujo `Briefing`
      `core/pending-briefing.ts#briefingStillPending` considera pendente. Devolve uma união
      discriminada (`{ found: true, briefing, daysAgo } | { found: false, daysSearched }`,
      D-024) — nenhum briefing pendente é caso normal, nunca exceção (aceite #5).
      **"Ainda tem pendências" definido por conteúdo, não por bookkeeping de retomada —
      Q-026, FECHADA pelo PO em 2026-08-30.** Nada persiste hoje "este dia já foi retomado" (isso
      é o passo 5, fora desta tarefa); um handoff `source !== "model"` conta sempre como pendente
      (D-025: ausência de veredito do modelo não é veredito de "concluído"), e só um
      `source: "model"` que relatou `pendingItems`/`tomorrowPlan` vazios conta como resolvido.
      Confirmado como regra **interina**: quando o passo 5 existir, "pendente" passa a ser "não
      retomado E com conteúdo", documentado em `core/pending-briefing.ts`.
      **Revisado no review: sem corte de produto por idade.** A primeira versão limitava a busca
      a 7 dias por analogia com `forkCleanupDays` — revogado: descartar um briefing pendente por
      idade não protege de nada, só esconde "onde eu parei" de quem voltou de férias. Agora a
      busca acha o briefing pendente mais recente **não importa a distância**, e devolve
      `daysAgo` (dias locais até hoje) para quem exibe. `MAX_BRIEFING_SCAN_DAYS = 30` continua
      existindo, mas só como limite de **E/S** (quanto disco esta chamada está disposta a tocar),
      não julgamento de produto — aumentar o número não muda o que conta como pendente.
      `core/resume-prompt.ts#buildResumePrompt`/`buildResumePrompts` monta o passo 4 (D-004,
      texto em inglês, D-028): honesto para `source: "deterministic"`/`"noTranscript"` (nunca
      finge entendimento que não existe, entrega só os fatos crus registrados) e sinaliza
      `capturedDuringActiveTurn: true` como aviso explícito de possível desatualização.
      `core/consolidated-plan.ts#renderConsolidatedPlan(briefing, daysAgo)` monta o passo 2
      ("mostra o plano consolidado"), texto plano por sessão (não o markdown completo de
      `seeya end-day`, que carrega git/recall/rejeitados demais para uma pré-visualização antes
      de escolher o que retomar); `renderRelativeAge` mostra a idade do briefing por extenso
      ("3 weeks ago") sempre que não for "ontem", em vez de deixar a pessoa presumir que o plano
      é fresco. `core/briefing.ts#renderGitBlock` passou a exportado para o gerador de prompt
      reaproveitar (evita duplicar a mesma renderização de `GitFacts`). Quem exibe (passo 2) e
      quem retoma de fato (passos 3-5) são S3-T3 e S3-T2 — esta tarefa não toca `cli/` (D-020).
      `npm run verificar` e `npm run verificar:linux` verdes; `core/` 100% linhas/branches nos
      dois.
- [x] **S3-T2 — Retomada.** `claude --resume` no `cwd` original, com fallback para sessão nova
      e aviso explícito ao usuário.
      **Duas incógnitas medidas antes de implementar (pedido do PO), resultado em
      `docs/spikes/H-retomada-interativa.md`:** (1) sem TTY real, "interativo" degrada sozinho
      para uma resposta única e sai — nunca abre sessão continuável — então o primeiro prompt só
      pode chegar por argumento posicional quando o processo herda o terminal do usuário; medido
      que `spawn` com array e `shell:false` (a disciplina que este projeto já usa) entrega esse
      argumento **byte a byte íntegro**, inclusive quebra de linha, aspas e acento — o que
      mutilava no Spike C era o shell, não o argumento. Isso corrigiu **D-015** (o texto da
      decisão registra a correção). (2) várias sessões interativas não cabem num terminal: a
      resposta é sequencial, um TTY herdado por vez — decisão do PO, registrada em D-015 junto
      com a primeira.
      **Implementado em 2026-08-30:** porta `SessionResumer`/tipos `ResumeOutcome`/
      `ResumeFallbackReason` (aditivo ao final de `core/ports.ts`/`core/types.ts` — S3-T1 mexe
      nos mesmos arquivos em paralelo). `adapters/resumption/` (`args.ts`, `env.ts`,
      `context-file.ts`, `spawn-interactive.ts`, `resumer.ts`): `ClaudeSessionResumer` spawna
      `claude --resume <sessionId> "<prompt>"` com `stdio: 'inherit'` quando o prompt cabe no
      teto medido (`RESUME_PROMPT_ARG_LIMIT_CHARS = 4096`, ~1/8 do limite de linha de comando do
      Windows); acima do teto, ou quando o `--resume` fecha rápido (`FAST_FAILURE_GRACE_MS =
      5000`) com código != 0, cai no **único** mecanismo de fallback (D-004): sessão nova no
      mesmo `cwd`, plano inteiro entregue via `--append-system-prompt-file` apontando para um
      arquivo escrito em `~/.seeya/tmp/` (nunca fora de `~/.seeya/`) e apagado depois de usado.
      D-017 saneado nos dois caminhos (`env.ts` reaproveita a lista de
      `adapters/generation/env.ts`, exportada para isso). Uma segunda falha rápida do próprio
      fallback lança exceção em vez de mentir dizendo que uma sessão nova abriu (D-025 aplicado a
      uma ação). Aviso ao usuário (`core/resume-notice.ts#formatResumeNotice`, puro) nomeia qual
      dos dois motivos disparou o fallback, nunca inventa qual causa exata explica um `--resume`
      que falhou (D-025 — `seeya` não lê o stderr real, que foi para a tela do usuário via
      `stdio: 'inherit'`). Seis escolhas sem resposta literal em D-004/D-015 registradas em
      Q-027 (renumerada no merge: a S3-T1 já tinha tomado o Q-026 em paralelo). `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S3-T3 — `seeya start-day`** com seleção interativa e `--all`.
      *Aceite do sprint:* e2e 5 passa; retomada real de uma sessão de ontem funciona à mão.
      **Implementado em 2026-08-30.** Os cinco passos: `application/find-pending-briefing.ts`
      (passo 1, já existia) → `core/consolidated-plan.ts#renderConsolidatedPlan` (passo 2, já
      existia) → `cli/start-day-selection.ts` decide o modo (`--session` vence `--all`; sem
      nenhuma flag e sem TTY, `noTtyNoFlag` — imprime o plano e as duas flags, sai 0, nunca trava
      esperando resposta) → `application/start-day.ts#resumeSessions` (passos 4-5, sequencial, um
      `SessionResumer.resume()` por vez, com progresso impresso entre uma sessão e outra) →
      marcação por sessão gravada **depois** de cada `resume()` completar, nunca antes ou em lote
      no fim (D-002 aplicado a bookkeeping em vez de terminação de processo). `resumeSessions`
      lançando (fallback também falhou rápido, Q-027 item 5) para o laço no meio, sem tentar as
      sessões seguintes; `cli/start-day-command.ts` relata quem foi retomado e quem não foi, e sai
      com código 1.
      **Storage ganhou `readResumedSessionIds`/`saveResumedSessionIds`** (`core/ports.ts`, dentro
      da interface já consolidada — ver a nota abaixo), persistidos em
      `~/.seeya/days/<day>/resumed.json` (`{ schemaVersion, sessionIds }`,
      `adapters/storage/resumed-sessions-schema.ts`) — por **sessão**, não por dia inteiro: um dia
      com três handoffs e um retomado continua "pendente" para as outras duas, nunca some da busca
      do passo 1. `core/pending-briefing.ts#handoffStillPending`/`briefingStillPending` passaram a
      receber esse conjunto e checá-lo primeiro; o docstring do módulo, que descrevia a regra como
      **interina** (Q-026), foi reescrito para descrever a regra real: "pendente" agora é "não
      retomado E com conteúdo". `unresumedHandoffs` (novo, mesmo arquivo) é o filtro **diferente**
      que os passos 3 usam para montar a lista de candidatos — todo handoff ainda não retomado,
      mesmo um que o modelo já confirmou limpo, porque é uma escolha real ainda não feita, não
      "pendência" no sentido de conteúdo.
      **Seleção interativa por `node:readline/promises`**, sem dependência nova
      (`cli/start-day-command.ts#askInteractively` + `cli/start-day-selection.ts#parseInteractiveSelection`):
      aceita números separados por vírgula, `all`, ou vazio para nada; resposta inválida reporta o
      problema e não retoma nada — sem laço de nova tentativa (escolha mínima, registrada abaixo).
      **`--session <id|cwd>`** casa contra **todos** os handoffs do briefing (não só os ainda não
      retomados) — intenção explícita tem precedência sobre o filtro de conveniência, mesmo
      convenção de `end-day --session`; sem match, mensagem e saída 0 (consistente com
      `end-day --session`, não um erro).
      **Consolidação de `Storage` em commit separado** (instrução do mantenedor): os dois blocos
      `export interface Storage {}` que existiam desde S2-T4/S3-T1 foram fundidos num só, sem
      mudança de comportamento, antes de qualquer código novo desta tarefa.
      **`core/consolidated-plan.ts` ganhou reconhecimento de retomada:** uma sessão já marcada
      resumida aparece como "already resumed today" em vez do seu `pendingItems`/`tomorrowPlan`
      (potencialmente obsoletos) — mesma disciplina de "não afirmar além do que se sabe" que o
      módulo já aplicava a handoff `source !== "model"`.
      Uma escolha sem resposta literal na spec registrada em `docs/QUESTOES.md` Q-028 (formato de
      `resumed.json`, ainda fora da tabela de identificadores em disco do `AGENTS.md`).
      **Aceite do sprint cumprido por e2e nº5** (`tests/e2e/start-day.test.ts`): handoff pendente
      escrito diretamente em disco (sem rodar `end-day`, já que `start-day` nunca redescobre
      sessões — D-004), `seeya start-day --all` invoca o `claude` falso com
      `['--resume', sessionId, prompt]`, e `resumed.json` reflete a sessão marcada. Um segundo
      e2e prova o caminho sem TTY (stdin `'ignore'` do harness já não é TTY, de graça): plano
      impresso, `--all`/`--session` sugeridos, `claude` nunca invocado, saída 0.
      *Retomada real à mão:* **verificada pelo mantenedor em 2026-08-30**, e é o que fecha o
      aceite do sprint. O agente corretamente NÃO alegou esta parte — não havia sessão Claude Code
      real para retomar dentro do ambiente dele —, então ela ficou pendente até a verificação
      humana. Percurso executado: sessão de teste aberta à mão com trabalho deliberadamente
      inacabado; `seeya end-day --session '<cwd>'` capturou em modo `lean` com `source: model`;
      `seeya start-day` num terminal separado achou o briefing do dia e retomou. Retomada e
      contexto injetado funcionaram.
      *Observado na captura, e vale registrar:* o "Understanding" gerado disse explicitamente que
      **não havia confirmação no contexto** de que o arquivo tinha sido criado ou as tarefas
      marcadas — em vez da narrativa óbvia a partir do pedido. É o D-025 aparecendo no texto do
      modelo, não só nos tipos, que é o que o prompt da S3-T1 foi desenhado para produzir.
      `npm run verificar` e `npm run verificar:linux` verdes; `core/` 100%, `application/` 100%,
      `cli/` 100% (linhas/statements) nos dois sistemas.

---

- [x] **S3-T4 — Teste de contrato para `--append-system-prompt-file`.** Aprovado pelo mantenedor
      em 2026-08-30 ao fechar a Q-027 item 3. O fallback da retomada (D-004) entrega o plano por
      `--append-system-prompt-file`, escolhido em vez de `--system-prompt-file` porque o primeiro
      **acrescenta** ao prompt de sistema e o segundo **substitui** o do Claude Code inteiro — o
      `seeya` não tem por que decidir remover comportamento que a pessoa espera de qualquer
      sessão. O problema: **nenhum dos dois aparece no `--help`**; foram achados varrendo strings
      do binário (Spike H). A semântica está medida na 2.1.235 e pode mudar numa versão sem
      aviso, e hoje nenhuma suíte cobre isso.
      *Escopo:* teste em `tests/contract/` (`npm run test:contrato`, a suíte que existe justamente
      para casar suposição nossa com binário real) que confirme "append, não replace" contra o
      `claude` instalado — isto é, que o prompt de sistema padrão **continua valendo** quando o
      flag é usado, não só que o texto extra chega. Se a distinção não for observável de fora,
      esse próprio achado é o resultado: registrar em QUESTOES o que dá e o que não dá para
      provar, sem inventar uma garantia que o teste não sustenta (D-025).
      **Implementado em 2026-08-30 (`tests/contract/append-system-prompt-file.test.ts`).** A
      distinção **é** observável de fora: uma chamada `claude -p --model haiku
      --append-system-prompt-file <arquivo>` pede, no mesmo turno, o nome do produto de CLI (só
      respondível a partir do prompt padrão) e um marcador sintético só presente no arquivo
      anexado — replace derrubaria o primeiro sem afetar o segundo.
      **Revisão do mantenedor pegou que a primeira entrega só tinha o braço positivo**: "os dois
      fatos chegam" é compatível com as duas semânticas até alguém medir o que o replace de fato
      faz — sem isso, o teste passaria de qualquer jeito, decorativo. **Braço negativo
      acrescentado:** uma terceira chamada com `--system-prompt-file <mesmo arquivo>` (o flag que
      de fato SUBSTITUI) fecha o argumento. Medido na 2.1.251, com `--model haiku`: controle e
      append respondem com o nome do produto ("Claude Code"), replace responde `UNKNOWN` — com o
      marcador do arquivo presente nos três casos. Essa é a prova que faltava.
      **Achado sério durante o fechamento do braço negativo: `--model sonnet` NÃO discrimina.**
      Tentado como forma de reduzir a instabilidade do haiku em responder a pergunta de
      autorrelato (abaixo); medido uma vez: (a) estourou o teto de US$0,10 por chamada (chegou a
      ~US$0,13) porque `--model sonnet` aqui passa por uma chamada interna de classificação em
      haiku antes do turno de sonnet, cada uma pagando criação de cache nova sob
      `--no-session-persistence`; (b) pior, a única chamada de sonnet que completou (a de replace)
      respondeu "Claude Code" mesmo com o prompt de sistema inteiramente substituído — autorrelato
      de identidade não depende do prompt de sistema nesse modelo, e o observável deixa de
      discriminar por completo. Revertido para `haiku`, a única configuração medida a funcionar.
      A primeira formulação da pergunta (booleano direto: "você sabe seu nome de produto?") tinha
      dado falso negativo mesmo no controle (recusa treinada a uma pergunta meta, não ausência do
      fato); a formulação corrigida (pedir o fato direto, com `UNKNOWN` como saída explícita) segue
      em uso. **Flakiness residual, medida e documentada, não escondida:** rodando o arquivo final
      (haiku, três chamadas) uma segunda vez, só a chamada de CONTROLE (sem flag) respondeu
      `UNKNOWN` de novo, sem motivo — append e replace nunca flakaram nas mesmas rodadas,
      sustentando a discriminação central. A mensagem de falha do teste de controle explica que uma
      falha isolada ali (com os outros três verdes) é ruído de amostragem até prova em contrário,
      não sinal de regressão. Nada disso foi escondido: comentário no arquivo preserva as três
      formulações tentadas (duas de pergunta, uma de modelo) e por que cada uma foi descartada.
      **Exatamente 3 chamadas reais por execução, nunca mais** (documentado em comentário no topo
      do arquivo): `--model haiku`, `--no-session-persistence`, `--max-budget-usd 0.10`, `cwd`
      descartável em `%TEMP%`, ambiente saneado reaproveitando
      `adapters/generation/env.ts#buildGenerationEnv(..., 'lean')` em vez de duplicar a lista
      D-017. **Total de chamadas reais gastas durante todo o desenvolvimento: 11** (4 na entrega
      original sem braço negativo; 1 sonda avulsa testando `--system-prompt-file`; 3 integrando o
      braço negativo com haiku; 3 tentando — e descartando — sonnet).
      **Achado extra, sem afetar a conclusão:** `claude --help` na 2.1.251 (mais nova que a 2.1.235
      do Spike H) já **menciona** as duas variantes `-file`, mas só de forma indireta, dentro da
      descrição do flag `--bare` — sem entrada própria nem descrição do que fazem. Continua sem
      ser "documentado" no sentido que importa para D-004.
      **Limitação registrada, não escondida (Q-029):** a medição usa `-p` (headless); o fallback
      real (`adapters/resumption/resumer.ts`) roda em modo interativo puro com `stdio: 'inherit'`,
      que estruturalmente não deixa o `seeya` ler o stdout do processo filho para verificar o
      mesmo fato nesse modo. Assumir que a construção do prompt de sistema é a mesma rotina nos
      dois modos é engenharia razoável, não medição direta — fica marcado como suposição, não
      como fato provado.
      Sem tocar `src/` (escopo da tarefa): só `tests/contract/`, `docs/TESTES.md`,
      `docs/QUESTOES.md` (Q-029) e este arquivo. `npm run verificar` e `npm run verificar:linux`
      verdes.
      *Fora de escopo:* trocar o flag, ou construir fallback para o caso de ele sumir — só
      quando e se a medição mostrar que sumiu.

- [x] **S3-T5 — Identificar a sessão na listagem e no `--session`.** Aprovada pelo mantenedor em
      2026-08-30, saída do primeiro teste real. **O problema:** ele lança o `claude` do diretório
      do usuário — hábito comum, e deliberado, porque trabalha em vários repositórios ao mesmo
      tempo e quer uma memória só para o projeto inteiro. Resultado: **dezenas de sessões com o
      mesmo `cwd`**, e nada na saída do `seeya sessions` que diga qual é qual. O `--session` aceita
      só `sessionId` ou `cwd` — e o `sessionId` **não é exibido em lugar nenhum**, então na prática
      sobra o `cwd`, que é ambíguo exatamente no caso dele.
      *O dado já existe:* `DiscoveredSession` carrega `sessionId`; a view é que o descarta.
      Verificado no registro real: `20632.json` traz `sessionId`, e `name` (`"code-6d"`,
      `nameSource: "derived"`) é gerado por sessão pelo próprio Claude Code — ou seja, vinte
      sessões no mesmo `cwd` já teriam nomes distintos.
      *Escopo:* exibir o `sessionId` (ou prefixo estável) no `seeya sessions`; `--session` passar a
      casar também por **prefixo de `sessionId`** e pelo **nome de exibição**, com erro claro
      quando o prefixo for ambíguo (nunca escolher uma por conta própria — D-025).
      *Junto, porque é a mesma dor:* normalizar caminho antes de comparar no `--session` e no
      `ignore` do `config.json` — hoje é igualdade exata de string, e o mantenedor tropeçou nisso
      com as contrabarras comidas pelo shell (`C:\Users\<usuario>` chegando como `C:Users<usuario>`).
      Mesma classe de erro da S2-T1, onde comparação de caminho por string passou no Linux e
      reprovou no macOS e no Windows. A mensagem de "não casou" deve mostrar o valor recebido
      quando ele diferir do digitado.

      **Implementado em 2026-08-30.** `core/cwd-normalization.ts#normalizeCwdForComparison`
      (nova, pura, sem `node:*`): unifica separador, remove barra final e só dobra maiúscula em
      `'win32'` — plataforma é **parâmetro**, nunca lida ali (mesma disciplina do `Clock`, D-019),
      justamente para o teste exercitar o ramo Windows rodando em qualquer SO (aceite: "não
      depende de rodar no Windows para valer"). `cli/session-reference.ts#resolveSessionReference`
      (nova, genérica sobre `{ sessionId, cwd, name }`) é o casador único usado por
      `end-day-command.ts` e `start-day-selection.ts`: `sessionId` exato é autoritativo e nunca
      ambíguo (D-021); senão, prefixo de `sessionId` + nome exato + `cwd` normalizado são avaliados
      juntos, e **dois ou mais candidatos casando é `ambiguous`**, nunca resolvido sozinho — nomeia
      todos os que casaram. `cli/session-id-display.ts#computeDisplaySessionIds` dá o prefixo
      exibido no `seeya sessions`: 8 caracteres (primeiro grupo do UUID) por padrão, escalando por
      fronteira de grupo (`8/13/18/23/36`) só para quem colidir no lote — matemática da colisão e
      justificativa do tamanho no docstring do módulo. `session-view.ts`/`format-sessions.ts`
      ganharam `sessionId`/`displaySessionId`/a linha `id: ...`; testado explicitamente com duas
      sessões de mesmo `cwd` e mesmo `name`, que é o caso que motivou a tarefa
      (`session-view.test.ts`, `format-sessions.test.ts`).

      **Mudança de comportamento em `end-day --session`, não só extensão.** Antes, `cwd` batendo em
      várias sessões descobertas processava todas em silêncio (igualdade exata nunca impedia isso).
      Agora `end-day-command.ts` resolve `--session` contra uma descoberta própria **antes** de
      chamar `application/endDay` (não dá para desfazer uma captura/encerramento depois de
      acontecer) e recusa com `ambiguous` — nunca captura nenhuma das candidatas. Custa uma segunda
      chamada de descoberta, com uma corrida pequena e rara coberta por mensagem própria
      (`formatVanishedMatchMessage`). A mensagem de "não casou"
      (`end-day-command.ts#formatNoMatchMessage`) sempre mostra o valor **cru** recebido, nunca uma
      forma normalizada silenciosa, e acrescenta a forma normalizada-como-`cwd` quando ela difere —
      é a peça do aceite 4, e só existe aqui (a de `start-day` é do S3-T6).
      **`start-day`:** `findHandoffBySessionReference` já devolve `ambiguous` com a lista completa,
      mas `start-day-command.ts` colapsa em `blocked` reaproveitando a `formatNoSessionMatch`
      **existente**, sem tocar `format-start-day.ts` nem `core/consolidated-plan.ts` — conforme
      instrução. **Falta**, fora do meu alcance: uma mensagem de ambiguidade própria para
      `start-day`, que nomeie as sessões, em vez de reaproveitar o "não encontrado" genérico.
      Cinco escolhas sem resposta literal na spec registradas em Q-030 para confirmação; um achado
      ortogonal (flutuação intermitente do `verificar:linux` na suíte `guards` sob contenção do
      container, não causada pelo código desta tarefa mas talvez agravada por ele) registrado em
      Q-030a.
      Normalização coberta nos três sistemas sem depender de rodar no SO real
      (`tests/unit/core/cwd-normalization.test.ts`, ambas as dicas de plataforma exercitadas
      explicitamente). `npm run verificar` verde; `npm run verificar:linux` verde (medido 4 de 6
      execuções verdes — ver Q-030a para as duas vermelhas, sem relação com a asserção da própria
      tarefa). `core/` 100%, `application/` 100% linhas (96,2% branches, agregado — ver Q-030 item
      1 sobre a leitura de `process.platform`), `cli/` 100% linhas (96,79% branches, agregado).

- [x] **S3-T6 — Formatação da saída do `start-day`.** Aprovada pelo mantenedor em 2026-08-30
      ("achei confuso demais"), com a saída real do primeiro uso como evidência. **Não é o
      PowerShell — é o nosso formatador**, em `core/consolidated-plan.ts`:
      (1) `pendingItems` e `tomorrowPlan` são **listas** e viram uma linha corrida só, coladas
      com `join('; ')` — cinco itens num parágrafo único, ilegível;
      (2) o cabeçalho envolve o `cwd` em **crase de markdown** numa saída que é texto
      puro de terminal, então a crase aparece literal na tela;
      (3) não há linha em branco separando o plano da pergunta do seletor.
      *Escopo:* item por linha, sem markdown em saída de terminal, e respiro antes da pergunta.
      *Fora de escopo:* a redundância entre `pending` e `plan` observada na mesma saída — ela vem
      do modelo, não do formatador, e tende a diminuir sozinha quando a D-011 for reavaliada sob
      a D-031 (captura profunda dá ao modelo a conversa inteira, em vez de dez prompts do
      usuário). Não vale remendar no formatador o que é escassez de evidência na captura.

      **Acréscimo do mantenedor, mesma tarefa, 2026-08-30:** resposta inválida no seletor
      interativo agora diz também que nada foi retomado e aponta `seeya start-day --help` para
      `--all`/`--session` — as duas informações que `parsed.reason`
      (`start-day-selection.ts`) deixava implícitas. Sem laço de nova tentativa (mantido de
      S3-T3); código de saída continua 0. Escolhas registradas em `docs/QUESTOES.md` Q-031.

- [x] **S3-T7 — Mensagem de falha do fallback com o argv, e build que limpa o destino.** Saída da
      Q-029, aprovada em 2026-08-30. **O problema, hoje:** se o
      `--append-system-prompt-file` sumir ou mudar de nome numa versão futura — e o mantenedor
      está certo de que isso é questão de tempo —, o `claude` recusa o argumento, sai rápido com
      código ≠ 0, e o `adapters/resumption/resumer.ts` lança com a mensagem *"Check that
      `claude` is on PATH and that `<cwd>` still exists"*. **Que estaria errada.** O binário está
      no PATH e o `cwd` existe; o que sumiu foi o flag. Mandar investigar o lugar errado é pior
      que não dizer nada.
      *Escopo:* a mensagem carrega o argv de fato tentado, para que a causa apareça sozinha. Vale
      olhar se o mesmo vale para o caminho do `--resume` primário.
      *Por que isto e não mais teste de contrato:* o teste da S3-T4 mede o modo `-p` e o fallback
      roda interativo — ele nunca vai cobrir o caminho real. A escolha registrada na Q-029 é
      seguir com `--append` até quebrar; esta tarefa é o que garante que, quando quebrar, dê para
      saber por quê em vez de caçar PATH.

      *Segunda parte, aprovada junto em 2026-08-30: o `build` precisa limpar o destino antes de
      compilar.* Hoje o script é só `tsc -p tsconfig.build.json`, e o `tsc` escreve por cima sem
      apagar o que sobrou. A tradução do projeto para inglês deixou `dist/adaptadores`,
      `dist/aplicacao`, `dist/nucleo` e `dist/agendador` convivendo com os diretórios atuais por
      duas semanas, na máquina do mantenedor, sem ninguém ver.
      **O que torna isto mais que arrumação:** o `package.json` declara `files: ["dist"]`, então
      um `npm publish` empacota **o que estiver ali** — código morto em português iria junto, num
      projeto que vai abrir o código. O mantenedor já limpou à mão; isto é o que impede a sobra
      de voltar na próxima renomeação.
      *Escopo:* apagar `dist/` antes de compilar, de forma que funcione nos três SOs — `rm -rf`
      não serve, e a preferência do projeto é não acrescentar dependência (produção tem só
      `commander` e `zod`; `node:fs`+`rmSync` resolve). Confirmar que `npm run verificar` e o CI
      seguem verdes, e que o e2e continua achando o binário compilado.

---

## Sprint 4 — Automatizar

**Estado do sprint, corrigido em 2026-09-10.** Todas as tarefas abaixo marcadas `[x]` foram
revisadas, mescladas e publicadas pelo PO à medida que voltaram — mas o plano ficou com `[~]` em
27 delas, porque a revisão mesclava e esquecia de marcar. Ninguém lendo este arquivo saberia
que o sprint estava fechado no código. É o risco que a `docs/V2-RUMO.md` descreve (documento
desatualizado afirma o falso com confiança), observado aqui antes de ser teoria. **Exceção:**
a S4-T0i (idioma do conteúdo gerado, D-033) não foi feita. **Sprint aceito pelo mantenedor em
2026-09-10**, com base no daemon rodando de verdade em 06 e 07/09 (captura agendada disparando
sozinha, avisos prévios, nenhuma janela) e na retomada com `start-day` em 08/09. A S4-T0i fica
como tarefa aberta, já decidida, fora do aceite.

- [x] **S4-T00 — Medir se a captura pega carona no cache.** Aprovada pelo mantenedor em
      2026-08-30 ao fechar a Q-032: "acho importante saber disso desde já". **Vem antes da
      S4-T0 e da S4-T1** porque é a resposta que decide a forma do daemon.
      *O que medir, e só isto por enquanto:* o custo de uma captura profunda **logo depois** de
      um turno da sessão, contra a mesma captura horas depois. Isola o efeito do relógio, que
      provavelmente decide antes da identidade de prefixo — cache com validade de minutos a uma
      hora torna irrelevante qualquer prefixo numa captura às 19h sobre sessão parada desde as
      10h.
      *Por que importa:* se a diferença for grande, o daemon deixa de ser "acorda no horário e
      captura tudo" e passa a ser "acompanha as sessões e captura cada uma quando esfria", com o
      fim do dia virando **consolidação** do que já foi capturado. Não são variações de
      implementação, são formas diferentes. O Spike I mostra que o próprio Claude Code resolve o
      mesmo problema assim: o away summary dispara por **ociosidade de 5 minutos**, não por
      horário.
      *Fora de escopo:* identidade de prefixo e validade efetiva (itens 2 e 3 da Q-032) — só
      valem a pena se o item 1 mostrar diferença.
      *Cuidado (D-001):* perseguir o cache reproduzindo o prefixo da sessão viva chega perto de
      "gerar por dentro". Qualquer desenho que saia daqui precisa mostrar que não gasta o
      contexto da sessão viva nem interrompe o turno dela.

- [x] **S4-T00b — Qual dos três flags quebra a identidade de prefixo?** Aprovada pelo mantenedor
      em 2026-08-31, saída do Spike J. **Pode dissolver a Q-034 em vez de forçar a escolha.**
      *O que o Spike J não isolou:* ele comparou **os três flags juntos** (`--tools ""`,
      `--system-prompt` próprio, `--json-schema`) contra **nenhum deles**. A Q-034 só é um dilema
      se os três forem igualmente culpados — e há evidência de que não são: o **Achado 4** mediu
      a configuração atual lendo **70.260 tokens de cache** quando a hipótese era zero. Reuso
      grande acontece mesmo com os três presentes, e isso não bate com "os três quebram".
      *A hipótese a testar:* o culpado é o `--system-prompt` sozinho, por ficar no começo absoluto
      do prefixo. Se for, dá para **manter a saída estruturada** e ainda assim acertar o cache —
      movendo a instrução de extração para o prompt do usuário em vez do prompt de sistema.
      *Escopo:* largar um flag por vez a partir da configuração atual, medindo `cache_read` e
      `cache_creation` (em `usage`, snake_case — ver Achado 1 do Spike J). Reaproveitar
      `scripts/spike-j-measure.mjs` em vez de escrever outro. Explicar, ou pelo menos delimitar,
      o Achado 4 — hoje é o único número do spike sem explicação, e é o que impede qualquer
      redesenho de saber de onde a captura parte.
      *Custo:* 3 a 4 chamadas. O Spike J inteiro custou US$ 0,048 com cinco.
      *Entrega:* atualizar o **Spike J** com uma seção nova, não criar um spike K — é a mesma
      pergunta, medida com mais resolução. E dizer, na Q-034, se a troca sobrevive ou não.
      **Medido em 2026-08-31 (`docs/spikes/J-cache-na-captura.md`, seção "S4-T00b", 6 chamadas
      reais, US$ 0,2245).** Hipótese **refutada**: largar só o `--system-prompt` leu **zero**
      cache contra a sessão viva — o mesmo resultado que largar só `--tools ""` ou só
      `--json-schema` também produziu. Um braço de controle (os três largados) confirmou que o
      mecanismo de cache estava funcionando normalmente na mesma janela — os zeros são sinal
      real. O Achado 4 foi parcialmente delimitado: o bloco grande de tokens não é gatilhado pelo
      `--json-schema` (removê-lo muda o total por ~150 tokens, do tamanho do próprio schema); o
      peso está em `--system-prompt`/`--tools ""` e numa interação não-aditiva entre os dois
      (Q-035, nova, aberta). **A Q-034 sobrevive** como escolha real entre barato e estruturado —
      não é um dilema falso.

- [x] **S4-T00c — O modo enxuto para de jogar fora o texto do assistente.** Saída da reavaliação
      da **D-011** sob a **D-031**, em 2026-08-31. **É o conserto do defeito que o primeiro teste
      real expôs.**
      *O defeito:* `buildLeanPrompt` manda ao modelo projeto, `cwd`, última atividade, **os dez
      últimos prompts do usuário** e arquivos tocados. O `processAssistantEntry`
      (`adapters/transcript/reader.ts`) extrai das entradas do assistente **só** timestamp e
      caminhos de arquivo — o **texto** do assistente é descartado e nunca chega a existir em
      `SessionFacts`. Foi por isso que a captura perdeu o "4 concluídas, 6 pendentes": a frase
      estava lá, dita pelo modelo, num turno de assistente. O modelo da captura não falhou —
      foi honesto sobre evidência que não tinha (D-025).
      *Escopo:* o texto do assistente passa a ser extraído e a chegar ao prompt do enxuto.
      *A parte que não pode ser chutada:* **quanto**. Mensagem de assistente é longa, e escolher
      "os últimos N" por analogia repetiria exatamente o erro que esta decisão já cometeu — a
      primeira D-011 estimou US$ 0,15 e a medição da S2-T2 achou US$ 0,08–0,09 e um
      `--json-schema` que **quintuplica** o piso, o oposto do suposto. **Meça o custo com e sem,**
      e escolha o volume com número na mão. O `scripts/spike-j-measure.mjs` já sabe ler
      `usage.cache_read_input_tokens`/`cache_creation_input_tokens` e custo por chamada.
      *Cuidado de privacidade:* texto de assistente é conteúdo de trabalho real. Ele já vai para
      o handoff em `~/.seeya/`, então não é fronteira nova — mas nada disso pode vazar para o
      repositório em fixture ou teste (o portão de termos locais existe para isso).
      *Aceite:* uma sessão onde o assistente diz o que fez e o usuário nunca repete produz
      handoff que registra o que foi feito — o caso exato que falhou no teste real.

- [x] **S4-T00d — A falha de geração precisa dizer o que o `claude` respondeu.** Achada pelo
      mantenedor em 2026-08-31, testando à mão a captura nova da S4-T00c. **Faça antes do daemon:**
      ele vai chamar a captura em laço, e uma falha cega repetida N vezes é pior que uma.

      **O que aconteceu.** A captura falhou e o handoff caiu para determinístico — a D-003
      funcionando, o dia não abortou. Mas o que ficou gravado foi:

      ```
      generationError: claude exited with code 1, expected 0. stderr: (empty)
      ```

      **A causa está no ordenamento, não numa mensagem mal escrita.** O `spawn-claude.ts` coleta
      `stdout` **e** `stderr`. Mas o ramo `nonZeroExit` de `errors.ts` monta a mensagem só com o
      `stderr` — e a chamada usa `--output-format json`, onde o `claude` reporta erro **no stdout**,
      como envelope com `is_error`/`subtype`/`result`. Saída ≠ 0 faz o código pegar o ramo cego e
      **descartar o envelope antes de olhar para ele**.

      **O conserto usa maquinaria que já existe.** `GenerationFailureReason` já tem a variante
      `modelReportedError` (`subtype` + `result`), que é muito mais informativa. Em saída ≠ 0,
      **tente ler o stdout como envelope primeiro**; se ele trouxer `is_error`, reporte
      `modelReportedError`. Só quando o stdout não for envelope válido caia no `nonZeroExit` — e aí
      **incluindo o stdout bruto**, como o ramo `invalidJson` já faz com o dele.

      *Cuidado de tamanho:* `result` pode carregar saída do modelo. Limite o que entra na mensagem —
      ela vai para `generationError`, que **é gravado no handoff em disco**.
      *Cuidado de privacidade:* essa mesma superfície já existe (o handoff guarda conteúdo de
      trabalho), então não é fronteira nova — mas nada de stdout real em fixture do repositório.

      *Aceite:* falha com saída ≠ 0 **e** envelope no stdout produz mensagem que nomeia o
      `subtype` e o `result`, não "(empty)". Teste com os dois casos: envelope presente e stdout
      ilegível.

      *Fora de escopo:* descobrir **por que** aquela chamada específica falhou. A hipótese é
      orçamento — `captureModel` tem default `sonnet` e `budgetPerSessionUsd` default US$ 0,25, e
      a S3-T4 mediu que `--model sonnet` dispara um classificador haiku interno antes do turno
      real, cobrando os dois. **Mas é hipótese**, e é exatamente o que esta tarefa existe para
      tornar visível na próxima vez. Se os defaults precisarem mudar, isso é decisão de produto
      com a evidência na mão, não palpite agora.

      **Implementado em 2026-08-31.** `run-generation.ts#runGeneration`, em saída ≠ 0, tenta ler o
      `stdout` como o envelope `--output-format json` (`tryParseClaudeOutput`, que não lança) antes
      de desistir; se ele trouxer `is_error`, a rejeição vira `modelReportedError` (mesma função
      `modelReportedError` usada pelo caminho de saída limpa, agora carregando também o `exitCode`
      real observado). Só quando o `stdout` não é o envelope válido cai para `nonZeroExit`, que
      ganhou um campo `stdout` com o texto bruto — mesmo tratamento que `invalidJson#raw` já dava
      ao dele. O corte de tamanho do `result` (500 caracteres) mora em `errors.ts#describe()`, não
      na construção do `reason`: `error.reason.result` continua íntegro para quem faz
      pattern-matching programático, só a mensagem renderizada (a que vai para `generationError`
      no handoff em disco) fica limitada. `tests/fixtures/generation/fake-claude.mjs` ganhou a
      capacidade de escrever `FAKE_CLAUDE_STDOUT` também no modo `nonzero` (reaproveitado, não
      duplicado), o que permite reproduzir as duas formas de falha em
      `tests/integration/generation/lean-generator.test.ts`: saída ≠ 0 com envelope `is_error`
      válido → `modelReportedError`; saída ≠ 0 com `stdout` ilegível → `nonZeroExit` com o `stdout`
      bruto anexado. Três escolhas sem resposta literal na tarefa, e um achado à parte não
      consertado (o `timeout` de `spawn-claude.ts` descarta o mesmo tipo de evidência, só que no
      caminho de timeout) registrados na Q-039.

- [x] **S4-T00e — Captura que falhou não pode bloquear a retentativa do dia.** Achada pelo
      mantenedor em 2026-08-31, testando à mão. **Antes do daemon**, que vai chamar a captura em
      laço e multiplicar o efeito.

      **O que aconteceu.** A primeira captura falhou (orçamento) e caiu para determinístico —
      D-003 funcionando, o dia não abortou. Na segunda tentativa, com o problema já corrigido, a
      sessão veio **inelegível por `duplicateToday`** e o comando gravou **0 handoffs**. Para
      testar de novo foi preciso **apagar `~/.seeya/days/<dia>/` na mão**.

      **A causa.** `application/eligibility-assembly.ts` lê o handoff anterior do dia
      (`Storage.readHandoff`) e compara assinaturas de evidência (D-026) **sem olhar o campo**
      `source`. Um handoff `deterministic` — onde o modelo **não rodou** — conta como "já
      capturado hoje".

      **É o mesmo raciocínio da Q-026, uma camada acima.** Lá, `pendingItems` vazio num handoff
      determinístico não podia contar como "nada pendente", porque ausência de análise não é
      veredito. Aqui, um handoff determinístico não pode contar como "já capturado", **pela mesma
      razão**: ele é o registro de que a análise **não aconteceu**. Tratá-lo como conclusão
      transforma ausência em estado concluído — D-025 aplicado à elegibilidade.

      **E o custo real é maior que o incômodo do teste.** Em produção, uma falha passageira —
      orçamento, rede, modelo indisponível — consome em silêncio a única captura daquela sessão no
      dia. O fallback da D-003 existe para o dia não se perder; do jeito que está, a **camada de
      entendimento** se perde de qualquer forma, até amanhã.

      *Escopo:* só handoff com `source: "model"` bloqueia por duplicidade. `deterministic` e
      `noTranscript` deixam a sessão elegível de novo — a retentativa só pode melhorar o que está
      lá. A comparação de assinatura (D-026) continua igual; o que muda é **quais handoffs
      anteriores contam**.

      *Cuidado que não pode ser ignorado:* o daemon chama isto **em laço**. Se o modelo estiver
      falhando de forma persistente, "determinístico não bloqueia" vira retentativa a cada ciclo,
      gastando dinheiro sem melhorar nada. **Esta tarefa não resolve isso** — o limite de
      retentativas por sessão por dia é do daemon (S4-T3), e precisa estar escrito lá antes de o
      laço existir. Registre a dependência nas duas pontas.

      *Aceite:* sessão com handoff determinístico do mesmo dia e evidência inalterada volta a ser
      elegível; com handoff `model` e evidência inalterada, continua `duplicateToday`.

      **Implementado em 2026-08-31.** `core/eligibility.ts#PreviousCaptureToday` ganhou um campo
      `source: HandoffSource`; a condição 5 (`duplicateToday`) só dispara quando
      `previousCaptureToday.source === 'model'`. `application/eligibility-assembly.ts` só repassa
      o `source` do handoff lido, sem decidir nada — a regra de quais handoffs contam como
      "já capturado" mora inteira no núcleo, junto das outras quatro condições. `noTranscript`
      recebeu o mesmo tratamento de `deterministic` (não uma regra distinta): os dois significam
      "o modelo não analisou", por motivos diferentes, mas nenhum é veredito (D-025). A comparação
      de assinatura (D-026) não mudou. Onde o limite de retentativas do daemon (S4-T3) deveria
      encaixar, registrado sem implementar, em Q-040.

- [x] **S4-T0b — Implementar a D-031: capturar o que está vivo, listar o que foi fechado.**
      A **D-031** foi decidida em 2026-08-30 e **nunca implementada** — o código continua
      capturando sessão fechada, que é exatamente o que ela tira de escopo. **Antes do daemon
      (S4-T3)**, para ele nascer laçando o escopo certo em vez de ser corrigido depois.

      **As três populações, e o sinal que as separa** (medido no Spike E: o registro é apagado na
      saída graciosa; entrada obsoleta sobrevive só a terminação anormal):

      | situação | significado | escopo |
      |---|---|---|
      | registro + PID vivo (`alive`/`idle`) | sessão viva | **captura** |
      | registro + PID morto (`ended`) | morreu **sem** sair graciosamente | **captura** |
      | só transcript, sem registro (`unknown`) | saiu graciosamente: a pessoa fechou | **lista** |

      A segunda linha não é concessão: terminal fechado no braço, máquina que suspendeu, `claude`
      que caiu — a pessoa **perdeu** aquilo sem escolher, que é quando um handoff mais serve.

      **A listagem só se justifica se identificar a sessão para um humano.** "code-6d, fechada
      17h" não diz nada. Use **`aiTitle` + último prompt**, medidos no Spike I: `ai-title` e
      `last-prompt` são entradas do transcript que o Claude Code já grava, **já estão em
      `KNOWN_ENTRY_TYPES`** e hoje não são lidas. **Custo zero de modelo.** E moram no transcript,
      não no registro — sobrevivem justamente na população que esta listagem descreve.

      *Ressalva:* `ai-title` é entrada interna não documentada. Ausente vira **listagem sem
      título**, nunca título inventado (D-025). Se valer teste de contrato, abra questão.

      **O que isto custa, e está na D-031:** o varrimento de transcript também encontra sessões
      **vivas que não se registraram** (D-018), e sem registro elas não têm PID — caem no mesmo
      `unknown`. Não há como separar das fechadas com carinho. A captura sai para as duas; o
      **aviso** da D-018 continua.

      *Onde o corte mora, e é preferência com motivo:* a **S4-T00e roda em paralelo e é dona de**
      **`core/eligibility.ts` e `application/eligibility-assembly.ts`**. Ponha o corte de escopo
      **antes** da elegibilidade — as cinco condições dela falam de uma sessão que **já está** em
      escopo. Se não couber assim, **pare e reporte** em vez de invadir.

      *Aceite:* sessão só-transcript não é capturada e **aparece na listagem** com título e último
      prompt; sessão com registro e PID morto **é** capturada; briefing do dia mostra as duas
      coisas sem confundi-las.

      **Implementado em 2026-08-31:** `core/capture-scope.ts#isCaptureCandidate` — o corte é
      exatamente `session.hasPid`, sem campo novo: `SessionWithPid` (viva ou `ended`) sempre foi o
      único formato com registro; `SessionWithoutPid` sempre foi só-transcript (Q-041 item 1).
      Aplicado em `application/end-day.ts` antes de `evaluateCheapEligibility`, sem tocar
      `core/eligibility.ts`/`application/eligibility-assembly.ts` (S4-T00e). Sessão fora de escopo
      vira `core/types.ts#SessionListing` (`sessionId`, `cwd`, `name`, `aiTitle`, `lastPrompt`),
      montada por `application/session-listing.ts` a partir de `TranscriptReader.readListingInfo`
      (porta nova, `core/ports.ts`) — leitura dedicada de `ai-title`/`last-prompt`
      (`adapters/transcript/listing.ts`, `adapters/transcript/schemas.ts`), mantendo o último valor
      visto (ambos são regravados conforme a sessão evolui, Spike I). A listagem aparece em seção
      própria, nunca misturada com handoffs, tanto em `core/briefing.ts#generateBriefingMarkdown`
      (`summary.md`) quanto em `cli/format-end-day.ts` (relatório do terminal) — **não persistida**:
      recalculada a cada `end-day`, ao contrário dos handoffs (Q-041 item 4). O aviso da D-018
      (`core/early-warnings.ts`) não foi tocado e continua funcionando — ele opera sobre a
      descoberta completa, de fora do corte de escopo. Sete escolhas registradas em **Q-041**.

- [x] **S4-T0c — O artefato do dia precisa dizer quando foi um recorte.** Saída da Q-041,
      levantada pelo mantenedor em 2026-09-01 a partir do teste à mão. **Antes do daemon.**

      **O defeito.** `core/briefing.ts` não tem noção de ter sido uma execução filtrada. Um
      `seeya end-day --session X` produz um `summary.md` **indistinguível** de um dia completo que
      por acaso tinha uma sessão só.

      **Por que isso é D-025 no nível do dia.** Quem abrir aquele arquivo amanhã vê um handoff e
      conclui que o dia teve uma sessão relevante — quando cinco sessões vivas podem nunca ter
      sido olhadas. Ausência de handoff passa a ler como "aquela sessão não tinha nada", e o
      correto é **"ninguém olhou"**. O mesmo erro que a Q-026 corrigiu dentro de um handoff,
      agora um nível acima.

      **Como a pergunta apareceu, porque o caminho importa.** O mantenedor perguntou se a
      listagem de sessões fechadas deveria ser estreitada por `--session`. Estreitar daria quase
      sempre **vazio** — o valor casa com a sessão selecionada, que por estar em escopo de captura
      nunca aparece na listagem. Nenhuma das duas opções óbvias servia, e foi investigando isso
      que o defeito de verdade apareceu: a listagem é a **única parte do documento que se comporta
      como visão do dia inteiro**, dentro de um documento que é recorte e não se declara recorte.

      *Escopo 1:* o `summary.md` (e a saída do `end-day`) registram quando a execução foi
      recortada, e por qual valor de `--session`. A **listagem continua completa** — com o recorte
      declarado ela vira contexto do dia claramente rotulado, em vez de contradição.

      *Escopo 2, mesma tarefa porque é o mesmo raciocínio:* hoje "`(no title)`" na listagem
      significa **duas coisas diferentes** — não havia `ai-title`, ou a **leitura falhou**. Achatar
      as duas é o que o D-025 proíbe, e só a segunda pede ação de alguém. Separe (mesmo espírito
      da D-022: rejeição visível e contável).

      *Fora de escopo:* estreitar a listagem por `--session` (decidido: não), persistir a listagem
      por dia (decidido: não, D-027 — e sumir da listagem quando a sessão volta a ser capturável é
      o comportamento certo), e teste de contrato para `ai-title` (decidido: não agora — se sumir,
      degrada para sem título e nada quebra).

      *Aceite:* rodar `end-day --session X` e um `end-day` completo no mesmo dia produz dois
      `summary.md` **distinguíveis por leitura**, sem precisar comparar contagens. E falha de
      leitura da listagem aparece diferente de ausência de título.

      **Implementado em 2026-09-01:** `core/types.ts#EndDayScope` (união discriminada, `fullDay` |
      `singleSession` com o valor CRU de `--session`, nunca o `sessionId` resolvido) viaja opcional
      em `EndDayOptions.scope`, resolvido dentro de `endDay()` (`options.scope ?? { kind:
      'fullDay' }`) e devolvido, sempre presente, em `EndDayResult.scope`. `core/briefing.ts#
      generateBriefingMarkdown` recebeu um sexto parâmetro `scope` (default `fullDay`, mesmo
      padrão de `listedSessions`) e imprime `renderScopeNote` logo após o timestamp, afirmando os
      dois casos por igual — um dia completo agora diz "full day" explicitamente, nunca por
      omissão. `cli/format-end-day.ts#formatScopeLine` repete a mesma informação no relatório do
      terminal. Nada disso é persistido: recalculado a cada execução, igual à listagem (Q-041 item
      4) — uma execução completa mais tarde no mesmo dia sobrescreve a nota de escopo da anterior.
      Separadamente, `core/types.ts#SessionListing.aiTitle`/`lastPrompt` viraram
      `SessionListingInfo` (união discriminada: `{ kind: 'read', aiTitle, lastPrompt }` ou `{ kind:
      'unreadable', reason }`, embutida em `SessionListing.info`), fechando a lacuna em que uma
      falha real de leitura (`application/session-listing.ts`) degradava para o mesmo `{ aiTitle:
      null, lastPrompt: null }` de um `ai-title` simplesmente ausente. `core/briefing.ts#
      formatSessionListingLine`/`countUnreadableListings` (exportados, reaproveitados por `cli/
      format-end-day.ts`) tornam a falha visível linha a linha ("title unavailable — could not
      read the transcript (motivo)") e contável (nota agregada na seção "Not captured" quando
      houver ao menos uma), sem alarmar sessões ordinariamente sem título. Seis escolhas
      registradas em **Q-042**.

- [x] **S4-T0d — A nota de recorte precisa trazer o número que já está em mãos.** Emenda pequena
      à S4-T0c, apontada pelo mantenedor em 2026-09-01. **Erro meu, não do agente que a
      implementou** — ele obedeceu uma premissa que eu escrevi errada na Q-041.

      **A premissa errada.** Eu afirmei que o comando "não sabe quais sessões deixaram de ser
      capturadas por causa do filtro, só que houve filtro". Verificado no código:
      `application/end-day.ts#applyCaptureScope` calcula `captureCandidates` e `sessionsInScope`
      **na mesma função, lado a lado**. As duas listas estão em mãos no instante do filtro — o
      total, quantas sobraram, e por diferença **quantas** e **quais** foram descartadas.

      **O que saiu disso.** A nota diz *"Other sessions discovered today **may not** have been
      looked at"*. "May not" onde existe número disponível é vago sem necessidade, e soa como
      incerteza técnica quando é só a nota não contar o que já foi contado. **É o inverso do erro
      que este projeto persegue:** em vez de afirmar o que a evidência não sustenta, deixar de
      afirmar o que ela sustenta.

      *Escopo:* a nota de recorte no `summary.md` e na saída do `end-day` traz o número. Forma
      sugerida, não obrigatória: "1 de 4 candidatas foi considerada; 3 descartadas pelo filtro".

      **A aritmética é a parte fácil de errar.** O denominador é **candidatas a captura**
      (`isCaptureCandidate`, D-031), **não** "sessões descobertas". Descobertas inclui as fechadas,
      que vão para a listagem e **não** foram descartadas pelo filtro — eram outra população desde
      o começo. Usar o número errado faria a nota mentir na direção oposta. **Teste um caso com
      as três populações ao mesmo tempo** (viva capturada, viva descartada pelo filtro, fechada
      listada), que é onde a conta errada apareceria.

      *Fora de escopo:* **listar quais** sessões o filtro descartou. Pode virar ruído, e
      `--session` costuma ser deliberado. Se você achar que vale, **abra questão**, não implemente.

      *Aceite:* execução recortada informa quantas candidatas havia e quantas foram descartadas;
      dia completo continua dizendo que foi completo, sem número inventado onde não há descarte.

      **Implementado em 2026-09-01:** `core/types.ts#ResolvedEndDayScope` — tipo NOVO, irmão de
      `EndDayScope`, não o mesmo tipo esticado. `EndDayScope` (entrada de `EndDayOptions.scope`,
      inalterado) continua só `kind` + `sessionValue`, porque `cli/end-day-command.ts` monta esse
      valor **antes** de `endDay` rodar sua própria descoberta — as contagens não existem ainda
      nesse instante, e dar ao tipo de entrada um campo `captureCandidateCount` obrigatório
      forçaria um placeholder (`0`? `undefined`?) que pareceria dado real sem ser (o mesmo erro do
      D-025, aplicado à forma do próprio escopo). `ResolvedEndDayScope.singleSession` carrega
      `captureCandidateCount` (D-031, antes de `--session`) e `consideredCount` (depois,
      `sessionsInScope.length`) — só `EndDayResult.scope` e quem o renderiza
      (`core/briefing.ts#renderScopeNote`, `cli/format-end-day.ts#formatScopeLine`) veem esse
      tipo. `application/end-day.ts#applyCaptureScope` passou a devolver também
      `captureCandidateCount` (o `captureCandidates.length` que já calculava, só nunca tinha
      saído da função); uma função nova, `resolveScope`, faz a costura `EndDayScope` →
      `ResolvedEndDayScope` dentro de `endDay()`, chamada depois de `applyCaptureScope` (antes,
      era antes — a ordem inverteu porque agora o escopo resolvido depende do resultado do corte).
      O texto virou "N of M capture candidates considered; K discarded by the filter." nas duas
      superfícies (`summary.md` e terminal), substituindo o "may not have been looked at" da
      S4-T0c. Dia completo não ganhou nenhum número novo: `renderScopeNote`/`formatScopeLine`
      continuam com um `if (scope.kind === 'fullDay')` que retorna a mesma frase de sempre, sem
      tocar `captureCandidateCount`/`consideredCount` — o tipo nem permite ler esses campos nesse
      ramo (união discriminada). Teste das três populações ao mesmo tempo (viva considerada, viva
      descartada pelo filtro, fechada listada) em `tests/unit/application/end-day.test.ts`
      ("endDay — scope note reports the discard count (S4-T0d)") e a mesma prova na função pura em
      `tests/unit/core/briefing.test.ts`: `discoveredCount` fica 3, `captureCandidateCount` fica
      2 — a diferença é exatamente a sessão fechada, que nunca foi candidata. Escolhas registradas
      em **Q-043**.

- [x] **S4-T0e — O prompt de captura precisa proibir identificador inventado.** Achado pelo
      mantenedor em 2026-09-02, num `end-day` real sobre a própria sessão de trabalho. **Trataria
      como mais urgente que o daemon:** este defeito corrompe o artefato **em silêncio**.

      **O que aconteceu.** A captura saiu boa — `source: model`, entendimento de 2043 caracteres
      que acerta o trabalho do dia. Mas o terceiro `pendingItem` nomeia **cinco worktrees por ID**:
      `agent-a3a7d78489e5801f0`, `agent-a55122566d4a0061c`, `agent-ab7a6b01cb4e42ea3`,
      `agent-a1b18309afddc9a9e`, `agent-acf95a5b3de591220`. **Nenhuma das cinco existe.** Há 25
      worktrees em disco e nenhuma bate com nenhum desses identificadores.

      **A forma do erro é a pior possível.** A afirmação é **verdadeira** — há worktrees mescladas
      precisando de limpeza — e **cada identificador é inventado**. Frase certa decorada com
      especificidade falsa, que é justamente o que a faz parecer verificada. Quem ler amanhã vai
      procurar diretório que nunca existiu.

      **É o D-025 acontecendo pelo modelo, não pelo código** — primeira vez que pegamos isso neste
      projeto. Todo o resto que a gente consertou (mensagem cega, ramo errado, ausência virando
      afirmação) deixava rastro. Este **não deixa**: produz texto plausível.

      **A lacuna, no `adapters/generation/system-prompt.ts`.** O prompt diz *"if the context has
      nothing substantive, say so plainly instead of inventing activity"* — proíbe **inventar
      atividade** e não diz nada sobre **inventar identificadores dentro de uma atividade real**.
      O modelo viu caminhos sob `.claude/worktrees/` nos 47 `touchedFiles`, deduziu a categoria,
      e preencheu os nomes.

      *Escopo:* instrução específica para a forma observada, não um "não alucine" genérico —
      **quando só dá para ver que uma categoria de coisas existe, mas não quais, diga isso em vez
      de enumerar**. "Várias worktrees mescladas" é honesto; nomear as que não recebeu, não.

      *Honestidade sobre o aceite:* é mudança de prompt, e o efeito **não é verificável por teste
      de unidade** — depende do modelo. Não finja que é. O que dá para fazer: cobrir o texto do
      prompt por teste (a instrução está lá) e registrar na questão que a validação real é
      observar capturas reais. **Não invente um teste que aparenta provar o que não prova.**

      *Candidato registrado, NÃO para agora:* verificação mecânica — conferir se identificadores
      na saída aparecem na entrada. É tentador e arriscado (paráfrase legítima viraria falso
      positivo, e reprovar handoff bom é pior que o defeito). Se o problema reaparecer depois
      desta emenda, aí sim vale medir. Registre a ideia; não construa.

      **EMENDA (2026-09-02): duas falhas, dois modelos, mesma raiz — a instrução precisa cobrir
      as duas.** O mantenedor repetiu a mesma captura trocando sonnet por haiku. O haiku **não
      inventou identificador nenhum** — e produziu outra coisa, pior de detectar:

      > *"Background search confirmed the IDs the user suspected as hallucination were **actually
      > introduced by the user's own documentation, not found in the codebase before**."*

      **Conclusão invertida.** A busca achou os IDs no `PLANO-DE-ENTREGA.md` porque **eu os
      escrevi lá**, citando-os como invenções. O modelo leu o resultado e concluiu o oposto: que
      não eram alucinação. Quem ler esse handoff amanhã recebe o achado de cabeça para baixo.

      **E é pior que a invenção do sonnet, por assimetria de verificação:** um identificador
      inventado é **conferível** — um `ls` resolveu em cinco linhas. Uma conclusão invertida se
      apresenta como resultado de investigação e destrói o achado real em silêncio, sem nada para
      conferir contra.

      *Escopo ampliado:* a instrução cobre **as duas formas** — não enumerar itens de uma
      categoria que só se sabe existir, **e** não afirmar conclusão sobre algo visto pela metade.
      Quando a evidência estiver incompleta, **dizer que está** é a resposta certa (D-025), e vale
      tanto para identificador quanto para veredito.

      *Observação que muda a leitura:* a previsão de que o modelo mais barato falharia no caso
      difícil **estava errada**. No caso fácil (checklist) o haiku perdeu o item de julgamento; no
      caso difícil (sessão discursiva) ele **pegou** o item de julgamento e não inventou nada.
      Não há aqui uma ordenação simples de "modelo melhor" — há formas de erro diferentes, e a
      instrução tem que fechar as duas portas.

      *Ver também:* **Q-044**, sobre o truncamento em 500 caracteres ter cortado justamente a
      conclusão da mensagem que originou a inversão.

      **Implementado em 2026-09-03:** `GENERATION_SYSTEM_PROMPT`
      (`src/adapters/generation/system-prompt.ts`) ganhou duas frases, uma por forma medida —
      "name the category, not invented items" para a forma do sonnet (item nomeado a partir de
      categoria só deduzida), "say it is partial instead of stating what it proves" para a forma
      do haiku (conclusão sobre busca/mensagem cortada). Nenhuma cita os IDs reais nem o incidente
      — texto de produção, não registro (AGENTS.md § Comentários). Prompt cresceu de 463 para 701
      caracteres (+51%); D-011 pede atenção a cada caractere aqui, então o comentário acima da
      constante e um teste-tripwire (`length < 1000`) ficam como aviso para quem adicionar mais.
      Teste novo, `tests/unit/adapters/generation/system-prompt.test.ts`, cobre que as duas frases
      existem na constante e que é exatamente essa string que `args.ts` manda em `--system-prompt`
      — **não** que o modelo obedece, o que nenhum teste de unidade prova. Candidato mecânico
      (conferir identificador da saída contra a entrada) registrado e **não** construído — risco
      de falso positivo em paráfrase legítima. Validação real (observar capturas de verdade) ainda
      **não aconteceu** — registrado em **Q-045**, em aberto para o mantenedor decidir quando.

- [x] **S4-T0 — A evidência não pode ficar presa ao `cwd` de lançamento.** Aprovada pelo
      mantenedor em 2026-08-30. **O problema, observado no primeiro teste real:** a sessão subiu
      de `C:\Users\<usuario>` e o trabalho aconteceu numa pasta criada durante a conversa. O
      `GitReader` olhou para o diretório pessoal — que não é repositório — e não achou nada, então
      o handoff não soube dizer se havia diretório associado nem se havia git. **O modo profundo
      não conserta isso:** a evidência de git é atrelada ao `cwd` independentemente do modo.
      *A raiz é mais ampla:* o `cwd` faz **três trabalhos ao mesmo tempo** — identidade da sessão
      (`--session`, `projectPolicy`), local do trabalho (evidência de git) e agrupamento na
      exibição. Para quem lança do diretório pessoal, ele erra nos três.
      *Escopo sugerido:* derivar diretórios candidatos a partir de `touchedFiles` (que já traz
      caminhos reais, extraídos dos blocos de tool-use) e rodar o `GitReader` também contra eles,
      reportando por diretório em vez de um só. Manter D-025: diretório que não é repositório é
      ausência de evidência, nunca "sem mudanças".
      *Por que aqui e não na S3:* depende da reavaliação da **D-011** sob a **D-031**. Com captura
      profunda o modelo lê a conversa, que **nomeia** o diretório de trabalho — isso não entrega
      fatos de git, mas muda o que esta tarefa precisa consertar. Especificar antes disso seria
      desenhar contra um alvo que está se movendo.

      **EVIDÊNCIA REAL (2026-09-02), que substitui o caso sintético.** Um `end-day` sobre a própria
      sessão de trabalho do mantenedor devolveu:

      ```
      sources: ["transcript","registry"]     facts.git: null
      ```

      A sessão foi lançada de `C:code`, que **não é repositório**. O trabalho todo aconteceu em
      `C:codesee-you-tomorrow-ai` — 8 commits só no dia anterior, e dezenas na semana. O handoff
      tem **zero** fatos de git.

      Isto é melhor evidência que o caso do `seeya-todo-test`, que nem repositório era: aqui o
      repositório **existe**, tem histórico denso, e a evidência não chega porque o `cwd` de
      lançamento é o **pai** dele. Vale reavaliar o escopo desta tarefa com este caso na mão.

      **ESCOPO FECHADO (2026-09-02) pela D-032.** A tarefa deixa de ser "derivar diretórios
      candidatos e ver no que dá" e passa a ter forma decidida:

      1. **A evidência de git segue os `touchedFiles`, não o `cwd` de lançamento.** Sobe de cada
         arquivo até achar um `.git`, desduplica pela raiz.
      2. **`HandoffFacts.git` vira lista**, com os fatos completos de cada repositório.
      3. **Migração obrigatória, e é a parte que não pode ser esquecida.** Handoff versão 1, com
         `git` singular, é lido como lista de um elemento. Sem isso, subir o `HANDOFF_SCHEMA_VERSION`
         torna **ilegível todo handoff já gravado** — o `resolveSchemaVersion` **lança**, não
         degrada — e o `seeya start-day` lê exatamente isso.
      4. **Normalizar a raiz antes de desduplicar**, reusando `core/cwd-normalization.ts` (S3-T5).
         Sem isso os mesmos caminhos com maiúscula diferente viram dois repositórios — aconteceu
         na medição que originou a D-032.
      5. **Arquivos fora de qualquer repositório são contados e declarados** (12 de 47 na sessão
         medida). Sumir com eles esconde atividade.
      6. **O `cwd` de lançamento continua valendo quando for repositório.**
      7. **Limite de quantos repositórios visitar, rotulado no código como E/S e não julgamento de
         produto**, com o excedente declarado — mesma distinção da Q-025.

      *Aceite:* uma sessão lançada de fora de qualquer repositório, que tocou arquivos em **dois**
      repositórios diferentes, produz handoff com os dois — e um handoff **versão 1 já em disco**
      continua sendo lido sem erro. **Os dois casos com teste**; o segundo é o que protege o
      histórico de quem já usa.

      *Fora de escopo:* mudar o que o `--session`/`ignore` fazem com caminho (já resolvido na
      S3-T5 — **reuse**, não reescreva), e qualquer tentativa de adivinhar um repositório
      "principal" para voltar ao singular.

      **Implementado em 2026-09-03.** `core/types.ts#RepositoryGitFacts` (`GitFacts` + `root`)
      substitui `GitFacts | null` em `HandoffFacts.git`, que vira `readonly
      RepositoryGitFacts[]`; `filesOutsideRepository`/`reposNotVisited` entram como `number | null`
      no mesmo tipo, `null` reservado para handoff migrado de schemaVersion 1 (D-025: uma versão
      antiga nunca mediu nenhum dos dois, e `0` alegaria uma medição que não existiu).
      `core/ports.ts#GitReader` ganha `readEvidenceAcrossRepos(cwd, touchedFiles)`, devolvendo
      `GitEvidenceAcrossRepos`. A descoberta de raiz é I/O puro em
      `adapters/git/repo-roots.ts#findRepoRoot` (`fs.stat` de `.git`, subindo diretório por
      diretório — nunca `git rev-parse --show-toplevel` por arquivo, mais caro à toa) e a
      orquestração — desduplicar por `core/cwd-normalization.ts` (S3-T5, reusado sem alteração),
      manter a raiz do `cwd` sempre em primeiro no corte do limite (item 6), e aplicar
      `MAX_GIT_ROOTS_TO_VISIT` (8, exportado e com parâmetro de override pelo mesmo motivo de
      `findPendingBriefing#maxScanDays`: teste não precisa criar 9 repositórios reais em disco) —
      vive em `adapters/git/git-adapter.ts#GitAdapter.readEvidenceAcrossRepos`.
      `application/evidence-gathering.ts#gatherEvidence` deixou de rodar transcript e git em
      paralelo: git agora depende de `touchedFiles`, que só existe depois que o transcript (ou seu
      padrão vazio) resolve — sequencial por necessidade, não por descuido, comentado no código.
      `git` continua em `sources[]` sempre que **ao menos um** repositório respondeu (item 7 do
      escopo/D-013).
      **Migração:** `adapters/storage/handoff-schema.ts` sobe `HANDOFF_SCHEMA_VERSION` de 1 para 2
      e registra `HANDOFF_SCHEMA_MIGRATIONS` (mecanismo de `schema-version.ts`, até agora vazio em
      produção — esta é a primeira migração real do projeto). A migração mora no schema, não em
      `resolveSchemaVersion` nem numa função de leitura separada: `resolveSchemaVersion` já existia
      genérico exatamente para receber uma tabela por documento, e `adapters/storage/index.ts`
      passa `HANDOFF_SCHEMA_MIGRATIONS` só nos dois pontos que leem handoff
      (`readHandoff`/`listHandoffs`), sem tocar `readConfig`/`readEarlyWarningState`/
      `readResumedSessionIds`. A migração **nunca reescreve o arquivo em disco** — só traduz em
      memória a cada leitura — porque `resolveSchemaVersion` é puro (recebe o documento parseado,
      devolve outro objeto) e `StorageAdapter` nunca chama uma escrita depois de uma leitura; isso
      cai de graça a favor do `--dry-run` (que já não grava nada) e de quem lê o mesmo handoff duas
      vezes no mesmo dia (`listHandoffs`, chamado de novo a cada `seeya end-day --session`
      subsequente): a segunda leitura migra de novo, do mesmo arquivo v1 inalterado, para o mesmo
      resultado — testado explicitamente (`tests/integration/storage/handoff.test.ts`, "reading the
      same v1 file twice produces the identical result... no write-on-read"). O `root` do
      repositório único de um documento v1 é preenchido a partir do `cwd` de topo do próprio
      documento (era exatamente essa a leitura implícita antes de existir `root`).
      **Testado:** os dois casos do aceite têm teste de integração dedicado — dois repositórios
      git reais em `tmpdir`, com um `cwd` fora dos dois, em
      `tests/integration/git/git-adapter.test.ts` (mais o caso do item 6: raiz do `cwd` mantida
      mesmo sem `touchedFiles` nela; o caso do item 5: arquivo fora de qualquer repo contado; e o
      caso do item 7: excedente do limite declarado, via o parâmetro de override); e um documento
      v1 **bruto** (JSON escrito à mão, nunca via `serializeHandoff`, que só escreve a versão atual)
      em `tests/integration/storage/handoff.test.ts`, describe "D-032 migration from schemaVersion
      1" — cobre `readHandoff`, `listHandoffs`, `git: null` migrando para `[]`, e a idempotência da
      leitura. Toda fixture/duplo que construía `HandoffFacts`/`Handoff` literalmente foi atualizada
      para a forma nova (lista + dois campos novos) nos testes já existentes.
      **Verificado, não só assumido:** `npm run verificar` e `npm run verificar:linux` verdes,
      `core/` e `application/` em 100% (o piso de S1-T12 continua valendo por diretório, não só no
      agregado).
      **Questão registrada:** `docs/QUESTOES.md` **Q-046** — nomes novos que ainda não estão no
      glossário do `AGENTS.md` (`RepositoryGitFacts`, `readEvidenceAcrossRepos`,
      `GitEvidenceAcrossRepos`, `filesOutsideRepository`, `reposNotVisited`) e o valor de
      `MAX_GIT_ROOTS_TO_VISIT`, para confirmação do mantenedor.

- [x] **S4-T0f — Teste de unidade que spawna processo real está na faixa errada.** Achado em
      2026-09-04, investigando um vermelho no CI de Windows.

      **O que falhou.** `tests/unit/adapters/process/proc-start.test.ts`, caso
      *"win32: recheck says the PID is gone"*, com `Test timed out in 5000ms` — **primeira vez em
      oito execuções**. Rerun do mesmo commit passou, então é contenção, não defeito
      determinístico.

      **Mas a fragilidade é estrutural, não azar.** Esse teste chama a plataforma `win32` de
      verdade: ele **spawna `powershell.exe`**. Medido nesta máquina, quente: 500–880ms por
      chamada, duas por arquivo. E o `docs/TESTES.md` define a faixa assim:

      > *"unidade — core/ e transcript/ — **sem I/O, sem relógio real**"*

      **Um teste que spawna processo está na faixa que proíbe I/O.** Ele usa o default de 5000ms
      do vitest porque **ninguém lhe deu orçamento** — e ninguém deu porque a faixa promete que
      não precisa. Ele é frágil **por construção**.

      **A pista do conserto está no próprio docstring dele:** o PID é impossível de propósito,
      para a busca falhar em qualquer plataforma, e o que se afirma é **só a rotulagem**
      (`processGone` × `unavailable`), decidida pelo `recheck` **injetado**. O spawn real é
      **incidental** — o teste não precisa do powershell para responder, precisa que a captura
      falhe.

      *Escopo:* tornar o teste genuinamente puro, injetando a falha de captura em vez de
      provocá-la com processo real. O projeto já injeta `platform` e `recheck` exatamente para
      isso — a costura existe, falta usá-la aqui.

      *Alternativas descartadas, e por quê:* **subir o timeout** trata o sintoma e deixa I/O numa
      faixa que promete não ter; **mover para `tests/integration/process/`** é honesto mas mantém
      processo real para testar lógica pura — e a cobertura real daquela função contra processo
      de verdade **já existe** em `tests/integration/process/liveness.test.ts`, com orçamento.

      *Enquanto estiver aí:* varra `tests/unit/` atrás de **outros** testes que fazem I/O. Se
      houver mais, **liste na Q-047** em vez de consertar todos — quero decidir o alcance.

      *Aceite:* o caso `win32` não spawna processo nenhum, e a asserção sobre a rotulagem
      continua valendo.

- [x] **S4-T0g — O CI de Windows *pareceu* quadruplicar com a S4-T0 — e não foi isso.** Achado na mesma

      > **CORREÇÃO (2026-09-05, medido — a premissa desta tarefa era minha e estava errada).**
      > Eu li a **duração total do job** e atribuí ao código. Medindo **por passo**, em 7
      > execuções do `windows-latest`, o passo de teste/build ficou entre **95 e 135s em todas
      > elas**, antes e depois da S4-T0 — crescimento de 15% a 40%, coerente com os 1,4x de
      > testes, **não** com 4,3x.
      >
      > Os 582s vieram **73% de um `npm ci` que travou por ~7 minutos**, com cache quente, sem
      > erro registrado e com o `package-lock.json` inalterado naquele commit — ruído de
      > infraestrutura, sem relação com código deste repositório.
      >
      > **A hipótese do `createGitFixture` caiu.** Por arquivo, no CI real:
      > `tests/integration/git/` = **~6,6%** do tempo agregado (~10,6s). O peso está em
      > `tests/integration/guards/` = **~81%** (~130s de 161s), que roda `eslint` e
      > `dependency-cruiser` como processos reais — custo **pré-existente desde o Sprint 0**, já
      > documentado na Q-025/Q-030a, e **não** regressão da S4-T0.
      >
      > **Nenhum código foi mudado, e essa é a entrega certa.** Otimizar o `createGitFixture`
      > trocaria cobertura real de git por ~10s num job que já estava na ordem de grandeza
      > esperada em 6 de 7 execuções medidas. O agente mediu antes de mexer, como a tarefa
      > exigia, e a medição disse para não mexer.
      >
      > **Fica registrado como o erro que foi:** medir tempo de parede e chamar de regressão de
      > código é a mesma classe de engano que a S2-T8 e a Q-030a já tinham nomeado — atribuir
      > causa antes de isolar variável. Ver **Q-048** para as tabelas.
      investigação, e é o achado maior.

      **Medido**, duração do job `windows-latest` nas últimas oito execuções verdes:

      ```
      582s  merge: S4-T0          <- 
      144s  merge: S4-T0e
      121s  docs: D-032
      130s  docs: amend S4-T0e
      157s  docs: plan S4-T0e
      137s  merge: S4-T0d
      138s  docs: correct Q-041
      134s  merge: S4-T0c
      ```

      De ~2min15 para **9min42**. Os testes cresceram **1,4x** (de ~800 para 1124); o tempo
      cresceu **4,3x**. A desproporção é o ponto — não é "mais testes", é outra coisa.

      **Suspeita principal, a confirmar medindo:** as suítes novas criam **repositórios git reais**
      em `tmpdir` (`createGitFixture`), e operação de git no Windows é cara. **Meça por arquivo
      antes de mexer** — a S2-T8 já ensinou que a causa provável pode não ser a causa.

      **Por que isto importa mais que o número:** este é o portão que se espera antes de publicar.
      Quadruplicar a espera muda como se trabalha, e o efeito **piora sozinho** conforme a suíte
      cresce. Foi também o que encheu o runner o bastante para a S4-T0f aparecer.

      *Direções possíveis, nenhuma decidida:* reusar um repositório por **arquivo** em vez de por
      teste; pagar a criação uma vez em `globalSetup`, como já se fez com o shim do `csc.exe`
      (S2-T8); ou reduzir o que precisa de repositório real. **Escolha com a medição na mão.**

      *Aceite:* o job de Windows volta para a ordem de grandeza anterior **sem** perder cobertura
      real de git — e o relatório diz onde estava o tempo, não só que melhorou.

- [x] **S4-T0h — A saída do `end-day` mostra a prosa e esconde a lista.** Achado pelo mantenedor
      em 2026-09-05, com captura de tela de uma execução real. **É a S3-T6 outra vez, no outro
      comando** — aquele conserto nunca atravessou para cá.

      **O que a tela mostra.** Por sessão capturada, o `cli/format-end-day.ts` imprime
      `mode/source/terminated` e depois o **`Understanding` inteiro, sem quebra**. Numa execução
      com sonnet isso deu **1682 caracteres** correndo até a largura do terminal — parede única.

      **E o que ele NÃO imprime:** `pendingItems` e `tomorrowPlan`. Quem acabou de encerrar o dia
      recebe a **narrativa** e não recebe **a lista do que ficou pendente** — que é a parte curta,
      acionável, e a razão de rodar o comando. **Isso não é formatação ruim, é a informação
      errada.** A prosa faz sentido no `summary.md`, que existe para ser lido com calma; o
      terminal é o lugar da lista.

      *Escopo 1:* a lista pendente aparece no terminal, item por linha. O `core/consolidated-plan.ts`
      já tem `renderItemList` fazendo exatamente isso para o `start-day` (S3-T6) — **avalie
      reusar em vez de escrever outro**, com o cuidado de não arrastar `core/` para uma
      responsabilidade de `cli/`.

      *Escopo 2:* a prosa para de ser parede. Quebra em coluna legível — e **considere se ela
      deve aparecer inteira**, dado que já está no `summary.md`. Um resumo curto, ou nada, pode
      ser melhor que 1682 caracteres. **Decida e explique**; não é obrigatório mantê-la.

      *Cuidado:* o `end-day` também imprime seções que **não** podem sumir — inelegíveis com
      motivo, falhas, avisos de terminação (Q-007), limpeza de forks, e a nota de escopo
      (S4-T0c/S4-T0d). Legibilidade não pode virar omissão: a D-022 e a D-025 valem aqui, e
      **nenhum balde pode ser silenciosamente descartado**.

      *Fora de escopo:* o idioma. Ver o item próprio abaixo.

      *Aceite:* uma execução com duas sessões capturadas cabe na tela sem rolagem infinita, e
      **a lista de pendências é visível sem abrir arquivo nenhum**.

      **Implementado em 2026-09-05.** `core/consolidated-plan.ts#renderItemList` virou export
      (só isso — mesma assinatura, mesmo comportamento) e `cli/format-end-day.ts` passou a
      chamá-lo para `pendingItems`/`tomorrowPlan` na seção `Captured:`, mesmo formato item-por-
      linha que o `start-day` já usa (S3-T6): rótulo com 4 espaços, item com 6. Gate em
      `source === 'model'` para a lista aparecer — um handoff `deterministic`/`noTranscript`
      nunca teve o modelo confirmando "nada pendente" (D-003), e imprimir uma lista vazia (ou o
      aviso "nothing pending recorded") ali misturaria "falhou" com "checou e não achou nada",
      mesma disciplina que `renderSessionPlanLine` já aplica ao `start-day`. `Understanding`
      passou a ser um resumo de até 200 caracteres (`excerptUnderstanding`, corta em fim de frase
      quando cabe no orçamento, senão no último espaço, nunca no meio de palavra), com
      `(…, full text in summary.md)` quando corta — decisão explicada na Q-050: quebra de linha
      pura não resolve "N sessões encher a tela", só transforma uma parede de 1682 caracteres em
      várias linhas; um resumo curto com aviso explícito resolve e não descarta nada em silêncio
      (D-025), porque o texto inteiro continua intacto no `summary.md`
      (`core/briefing.ts#renderTextBlock`, não tocado por esta tarefa). Nenhuma seção existente
      foi removida ou reordenada — inelegíveis, falhas, avisos de terminação, limpeza de forks e
      a nota de escopo continuam todas presentes, testado explicitamente. Teste com o caso real
      pedido pelo aceite: duas sessões capturadas, uma com `understanding` de exatamente 1682
      caracteres (o tamanho medido do achado original) e várias pendências, a outra uma sessão
      curta comum — nenhuma linha do relatório resultante passa de 300 caracteres, e a lista de
      pendências aparece item por linha sem abrir o `summary.md`
      (`tests/unit/cli/format-end-day.test.ts`). Três escolhas registradas em Q-050 para
      confirmação do PO (reuso do `renderItemList`, o corte em 200 caracteres em vez de quebra de
      linha, e o gate por `source`). `npm run verificar` e `npm run verificar:linux` verdes;
      `core/` 100% linhas, `cli/` 100% linhas.

- [x] **S4-T0i — Tornar deliberado o idioma do conteúdo gerado (D-033).** Revisada e mesclada em 2026-09-11; validação real fica para o próximo `end-day` com sessões de idioma misto.
      Observado na mesma captura de tela: a sessão do projeto saiu **em português** e a
      `seeya-todo-test` **em inglês**, no mesmo relatório.

      **Decidida desde 05/09: a D-033 fixa que a moldura é inglesa e o conteúdo gerado espelha o
      idioma da sessão. Falta só implementar** — uma frase no `GENERATION_SYSTEM_PROMPT`, dentro do
      teto de 1000 caracteres que um teste já vigia. O texto abaixo é de antes da decisão e ficou
      desatualizado; a sessão limpa do spike K foi induzida a erro por ele (2026-09-10).

      *Texto original:* **Não é defeito de código — é decisão de produto que ninguém tomou.** O modelo espelha o
      idioma da sessão capturada, e num dia com sessões mistas o `summary.md` e o terminal ficam
      bilíngues. A **D-028** fixa inglês para o que é **público** (CLI, docs), e o conteúdo
      gerado a partir da conversa do usuário nunca foi classificado.

      *As opções, e nenhuma é obviamente certa:* espelhar o idioma da sessão (o que já acontece,
      por acidente); fixar um idioma no prompt de captura; ou tornar isso configurável.
      Espelhar tem argumento real — o handoff é lido por quem escreveu a sessão. Fixar tem outro
      — um briefing consolidado com quatro sessões em três idiomas é pior que qualquer escolha
      única.

      **Não implemente antes de decidir.** Abra a questão com as opções e o custo de cada uma; a
      escolha é do mantenedor.

      **Feito (2026-09-11).** Uma frase acrescentada ao `GENERATION_SYSTEM_PROMPT`
      (`src/adapters/generation/system-prompt.ts`), entre a instrução de responder só com o JSON
      pedido e as instruções de não inventar (D-025) já existentes desde a S4-T0e:

      > `Mirror the session's predominant language in the field values, not just its latest
      > message.`

      **Medido: 701 caracteres antes, 793 depois** — dentro do teto de 1000 do teste-tripwire, com
      folga de 207. "Field values" restringe a instrução ao conteúdo dos campos do JSON
      (`understanding`, `pendingItems`, `tomorrowPlan`); não menciona `key` nem formato, então não
      dá margem para o modelo ler "responda no idioma da sessão" como cobrindo a moldura (chaves,
      texto do CLI, títulos do `summary.md`), que continua em inglês por D-028 e não foi tocada. O
      comentário do módulo cita D-033 e S4-T0i para o porquê; o comentário do teste novo faz o
      mesmo.

      Teste novo em `tests/unit/adapters/generation/system-prompt.test.ts`: asserção de conteúdo
      (a frase existe, verbatim, na string exportada) mais o tripwire de 1000 caracteres já
      existente, agora provando 793 < 1000. **Inferido, não medido: que o modelo de fato espelha
      o idioma predominante em vez do idioma da última mensagem** — nenhum teste de unidade prova
      isso (é prosa gerada), e não escrevi teste que aparente provar mais do que "a instrução
      existe no prompt enviado". **O que o mantenedor precisa ver à mão:** o próximo `end-day` real
      com sessão de idioma misto — confirmar que os campos gerados seguem o idioma predominante da
      sessão e não o da última mensagem digitada.

      `npm run verificar` verde: 133 arquivos de teste, 1441 testes passando (3 skipped),
      cobertura 97,05% statements / 92,65% branches / 98,2% funcs / 97,29% lines — acima dos
      mínimos de `AGENTS.md`. `npm run verificar:linux` verde.

      **Medido (Q-048): a hipótese do `createGitFixture` caiu, e a "desproporção" some quando o
      job é separado por etapa.** Isolando `Instala as dependências` (`npm ci`) de `Roda o portão`
      (tsc+lint+depcruise+build+cobertura) em 7 execuções reais do `windows-latest`
      (`gh run view --log`), o passo que roda teste de verdade ficou entre **95s e 135s em todas
      elas**, antes e depois da S4-T0 — um crescimento de +15% a +40%, proporcional ao 1,4x de
      testes, não 4,3x. Os 582s inteiros vieram **73% de um único `npm ci`** que travou por 7
      minutos com cache já restaurado e nenhum erro no log — infraestrutura do runner, não código
      deste projeto (`package-lock.json` não mudou nesse commit). No log verboso da execução
      seguinte (já com os 1124 testes), `tests/integration/guards/` (spawns reais de
      `eslint`/`dependency-cruiser`, existente desde o Sprint 0, já custoso — Q-025, Q-030a) é
      **~81%** do tempo agregado de teste no Windows; `tests/integration/git/` (o suspeito) é
      **~6,6%**. **Nenhum código foi alterado** (nem `_fixtures.ts`, nem `vitest.config.ts`): a
      medição não sustenta um problema ali para consertar, e mexer seria trocar cobertura real de
      git por uma economia de ~10s num job já na ordem de grandeza esperada em 6 das 7 execuções.
      Detalhe completo, tabelas e as três medições (local, por etapa de CI, por arquivo no runner
      real) em `docs/QUESTOES.md` Q-048.

- [x] **S4-T1 — `adapters/notification`** conforme o Spike B, com a cadeia de fallback e o
      contrato mínimo **sem ações**. Validação manual do `activationType="protocol"` com esquema
      `seeya://` no Windows; se não se provar, o produto segue sem ações clicáveis e nada quebra.
      **Q-007:** quando `canTerminate: true` estiver ligado e a terminação não acontecer (depois da
      S1-T2b: quando não há console para anexar), o aviso diz **qual sessão não foi encerrada e por
      captura — o handoff foi gravado; só a terminação não ocorreu.
- [x] **S4-T2 — `core/schedule`.** Puro: dado config + estado + agora, o que deve acontecer.
      É aqui que moram os testes de horário de verão e de máquina suspensa.
      **Implementado em 2026-08-31:** `src/core/schedule.ts` — `resolveEndOfDayInstant` (a
      conversão `"HH:MM"` + dia + fuso, D-019, delegando DST inteiramente à plataforma: hora
      inexistente na entrada do horário de verão normaliza para depois do buraco, hora ambígua na
      saída resolve para a ocorrência mais cedo — os dois medidos com `TZ=America/New_York`,
      2026-03-08/2026-11-01, ambos documentados no comentário da função e na Q-037 item 1/2, nunca
      uma tabela de transições própria), `computeEffectiveEndOfDay` (soma o adiamento acumulado,
      `null` quando `endOfDayTime` é `null`), `emptyDayState`/`applySnooze`/`applySkipToday` (D-006,
      cumulativos, resetando por `core/day.ts#localDayString` na virada de dia) e `decideSchedule`
      — a união discriminada `ScheduleDecision` (D-024) com seis casos (`disabled`, `skipped`,
      `alreadyEnded`, `waiting`, `leadTimeWarning` com qual antecedência, `endOfDay` com `delayMs`
      bruto em vez de um `late: boolean` que apagaria a distinção que a spec pede, Q-037 item 3) e
      `nextState` (mesmo padrão de `core/early-warnings.ts`: a marca de "já notificado"/"já
      encerrado" volta junto da decisão, e só o caller persiste depois de agir de verdade). `DayState`
      (`core/types.ts`) é só o tipo de domínio — nenhum método novo em `Storage`/`core/ports.ts`,
      por pedido explícito da tarefa (a persistência real é S4-T3/S4-T4). Seis escolhas sem resposta
      literal na spec registradas em `docs/QUESTOES.md` Q-037 (resolução das duas transições de
      horário de verão, `delayMs` em vez de booleano, ordem de prioridade quando duas antecedências
      vencem juntas após suspensão, `alreadyEnded` permanente mesmo com adiamento pedido depois, e o
      reset de virada de dia vivendo no `core/` em vez de esperar a chave de disco de S4-T3/S4-T4).
      29 testes em `tests/unit/core/schedule.test.ts`, incluindo os dois dias de virada de horário
      de verão com `TZ` forçado e restaurado. `npm run verificar` e `npm run verificar:linux` verdes.
- [x] **S4-T3 — Daemon.** Loop, lockfile de instância única, recuperação de disparo atrasado.
      **Sobe desanexado do shell que o chamou** (D-005, emendado): `detached` + `stdio` ignorado
      + `unref()`. Não é comando em segundo plano — sobrevive a fechar a janela e a deslogar.
      No Windows isso significa **console nenhum**, e é o que torna o daemon inalcançável pelo
      Ctrl+Break que ele mesmo gera ao encerrar sessões (S1-T2b).
      *Aceite:* subir o daemon, **fechar o terminal**, e ele continua vivo e disparando.
      **Q-024: os avisos precoces (S1-T7) são ligados aqui.** Estão prontos e desligados desde o
      Sprint 1. Não pertencem ao `end-day` (aviso que chega à noite sobre um problema da manhã é
      autópsia, não aviso) nem ao `seeya sessions` (sob demanda: quem nunca roda nunca é avisado,
      e a especificação diz que aquele comando não escreve nada). O daemon é a única coisa que vê
      sessões **continuamente**, que é o que o D-018 quer dizer com "assim que a sessão é vista".
      Ver `src/adapters/discovery/early-warnings.ts`.

      **ATUALIZAÇÃO (2026-09-05): esta entrada é do Sprint 0, e cinco coisas mudaram desde
      então. Leia isto antes do texto acima.**

      **1. A decisão de agenda já existe e é pura.** A S4-T2 entregou `core/schedule.ts`, que
      devolve **união discriminada de seis variantes** (`disabled`, `skipped`, `alreadyEnded`,
      `waiting`, `leadTimeWarning`, `endOfDay`) mais um `nextState`. O daemon **consome**, não
      redecide. E o `nextState` só deve ser persistido **depois** de a ação ter sucesso — a
      função pura nunca assume que o efeito aconteceu.

      **2. O `DayState` ainda NÃO é persistido, e persistir é desta tarefa.** A S4-T2 entregou o
      tipo de domínio de propósito sem disco, deixando a forma para quem fosse gravar. O
      `AGENTS.md` § Idioma **já reserva** `estado.json` e `Storage.saveState` — use esses nomes.
      **D-027: chave que vai para disco é barata agora e cara depois.**

      **3. O limite de retentativa mora aí, e a Q-040 já disse por quê.** A S4-T00e fez handoff
      determinístico **deixar de bloquear** nova captura no mesmo dia — correto para uso à mão, e
      em laço vira retentativa a cada ciclo se o modelo estiver falhando de verdade, gastando
      dinheiro sem melhorar nada. A contagem **não** pode ser reconstruída dos handoffs
      (`saveHandoff` **sobrescreve**, não acumula), então ela mora no `DayState`.

      **4. A cadência foi resolvida por medição, e o resultado é o mais simples.** O Spike J
      mediu que o cache de prompt vive na faixa de **uma hora** (quente aos 18 minutos, tier de
      1h em toda escrita). Isso **derrubou** o argumento — vindo do Spike I, por analogia com o
      away summary — de que o daemon precisaria de detecção fina de ociosidade de 5 minutos.
      **O desenho segue o da especificação:** laço de 30s decidindo por relógio de parede,
      captura no horário efetivo. Não construa captura contínua.

      **5. Notificação e escopo já existem.** A S4-T1 entregou a porta `Notifier` e a cadeia de
      fallback (primeiro disponível vence; nenhum disponível cai para stderr **sem lançar**). A
      D-031 já está implementada no `endDay`, então o daemon herda o escopo certo — captura o
      que está vivo e o que morreu por acidente, lista o que foi fechado.

      **Um cuidado que só aparece em laço:** o `end-day` à mão é uma execução por dia; o daemon
      chama a captura **repetidamente**. Tudo que é aceitável uma vez — falha de geração, sessão
      inelegível, notificação que não sobe — passa a acontecer N vezes. **Nada disso pode virar
      enxurrada de aviso nem de gasto.** Pense em quem deixa a máquina ligada no fim de semana.

      **Implementado em 2026-09-05.** `src/scheduler/` (novo): `poll.ts#pollOnce` — um ciclo,
      chamado a cada 30s por `loop.ts#runDaemon` via `Clock.sleep` (D-019: porta ganhou `sleep`,
      nenhum `setTimeout` fora de `adapters/relogio`). Avisos precoces (Q-024) rodam em **todo**
      ciclo, antes da decisão de agenda — `discoverEarlyWarnings` já deduplica sozinho, então
      "sem repetir para a mesma sessão" vem de graça. `decideSchedule` é consumida, nunca
      redecidida; `nextState` só é persistido depois da ação ter sucesso.

      **Retentativa de turno ativo (5 min) sai do MESMO laço de 30s, sem laço novo.** Enquanto uma
      sessão capturada vier com `capturedDuringActiveTurn: true`, o poll grava tudo MENOS
      `endOfDayFired` — o próximo ciclo pergunta a mesma coisa de novo, e `endDay` naturalmente só
      recaptura quem ainda está em turno (D-026 já barra o resto). Finaliza quando ninguém mais
      está em turno ativo OU o orçamento de 5 min estoura (mesmo `delayMs` que decide "atrasado").

      **`DayState.captureAttemptsToday`** (campo novo, `core/types.ts`) é o limite de retentativa
      da Q-040 item 3: `core/capture-retry.ts` conta, por `sessionId`, toda captura que **não**
      terminou com `source: "model"` (falha total ou `deterministic`/`noTranscript`) e exclui
      quem chega a **3 tentativas** (`MAX_CAPTURE_ATTEMPTS_PER_SESSION_PER_DAY`, justificado no
      comentário: conservador, sem base numérica na spec, e ainda assim engatilha antes do teto
      natural de ~10 polls da janela de 5 min). `scheduler/capture-filter.ts` vira isso num
      `EndDayOptions.sessionFilter` — a peça que a S4-T00e já tinha apontado como o encaixe.

      **Persistência.** `Storage` ganhou `readState`/`saveState` (`~/.seeya/estado.json`, D-006,
      arquivo único na raiz — não um por dia, porque `DayState.day` já se autodetecta como
      obsoleto, ver Q-037 item 6) e `readDaemonLock`/`writeDaemonLock`/`clearDaemonLock`
      (`~/.seeya/daemon.lock`, D-005). Ambos seguem o padrão versionado já usado por
      `config.json`/`early-warnings.json` (`adapters/storage/state-schema.ts`,
      `daemon-lock-schema.ts`).

      **Instância única (D-005).** `core/daemon-lock.ts#decideLockAcquisition` é pura: lock
      ausente ou com PID morto → adquire; PID vivo → recusa, nomeando quem segura. **Sem
      desempate por `procStart`** — risco aceito e documentado no próprio arquivo (PID reciclado
      recusaria por engano um daemon legítimo; consequência pequena e reversível, ao contrário do
      registro de sessões do Claude Code). Checado duas vezes: o lançador confere antes de
      spawnar (feedback imediato, sem gastar um processo à toa); o worker confere de novo com o
      próprio PID, e essa é a checagem que vale de verdade.

      **Subida desanexada (D-005).** `adapters/process/daemon-launch.ts#spawnDetachedDaemon`:
      `detached: true` + `stdio: 'ignore'` + `.unref()`. `seeya daemon` sem a variável de ambiente
      `SEEYA_DAEMON_CHILD` é o **lançador** (verifica o lock, spawna o worker com essa variável
      setada, imprime o PID e sai); com ela, é o **worker** (o laço de verdade, sem console — daí
      não haver flag `--run` escondida no `--help`: uma variável de ambiente já carrega o mesmo
      sinal "isto não é para um humano digitar" que o D-017 usa na outra direção).

      **Como o desanexamento foi testado.** `tests/integration/process/daemon-launch.test.ts` e
      `tests/integration/cli/daemon-command.test.ts` spawnam um processo real (reaproveitando o
      fixture `graceful-child.mjs` do S1-T2) e confirmam que ele fica vivo, é alcançável e
      responde a sinal — prova que a chamada produz um processo real, não uma simulação. Nenhum
      teste AUTOMATIZADO prova sobrevivência ao fechamento do terminal (exigiria o processo de
      teste morrer e algo de fora checar depois), mas a verificação manual foi feita, e mediu o
      que o aceite pede: `npm run build` seguido de `node dist/cli/index.js daemon` numa invocação
      do Bash tool (com `USERPROFILE` apontado para uma pasta descartável — `HOME` é bloqueado
      neste ambiente por motivo de isolamento de git, `USERPROFILE` não), e o PID relatado
      (437448) checado vivo por `tasklist` **numa segunda invocação do Bash tool** — cada chamada
      é um processo de shell novo, que nasce e morre sozinho, então se o daemon estivesse preso
      àquele shell já teria morrido junto. `daemon.lock` confirmado em disco com o mesmo PID; uma
      terceira invocação tentando `seeya daemon` de novo recusou com "already running (pid
      437448)" — o guarda de instância única também medido contra o binário real, não só contra
      fakes. Processo encerrado e pasta descartável removida ao final. Isto é uma janela de shell
      terminando, não uma janela de terminal interativa sendo fechada por um humano — mas o
      mecanismo que garante os dois (processo pai morre, filho `detached`/`unref` continua) é o
      mesmo, e é isso que estava em teste.

      **Cobertura:** `core/` 100% (`capture-retry.ts`, `daemon-lock.ts` novos, 100% cada);
      `scheduler/` 98.85%/97.82%/95%/100%. `npm run verificar` e `npm run verificar:linux` verdes
      (medido nesta máquina via Docker Desktop, container Linux real, não emulado).

      **Não implementado nesta tarefa, por estar fora do escopo que o plano já separa:**
      `seeya daemon --stop/--status` é a S4-T5; `seeya snooze`/`skip-today`/`config` são a S4-T4
      (o daemon já lê `estado.json`/`config.json` a cada ciclo, então uma dessas escritas
      concorrentes já é visível no próximo poll, sem mudança nenhuma aqui). Registro de
      diagnóstico (o daemon roda com `stdio: 'ignore'` — uma falha de poll é engolida, sem log em
      lugar nenhum) e a legibilidade de `captureModel`/`budgetPerSessionUsd` ficarem presos ao
      valor do início do daemon (ao contrário de `relevanceHours`, que é relido a cada ciclo)
      estão registrados na Q-049 para o mantenedor decidir, não decididos aqui.
- [x] **S4-T3e — O `fake-claude.mjs` vaza processo, e isso envenena toda medição de tempo.**
      Achado em 2026-09-05, investigando um vermelho do portão que não era do código.

      **O sintoma.** Havia **365 processos node** vivos na máquina do mantenedor, acumulados por
      semanas. Depois de matar os 334 antigos, o portão passou de primeira, 1218 testes, **sem
      tocar em código**. Os 31 restantes eram **todos** do nosso próprio fixture:

      ```
      14  tests/fixtures/generation/fake-claude.mjs -p --...   (checkout principal)
       7  .claude/worktrees/agent-.../tests/fixtures/...
       5  ...                                                  (e outras worktrees)
      ```

      **O mecanismo, e ele explica por que ninguém percebeu.** O fixture lê stdin com
      `readFileSync(0, 'utf8')` — leitura **síncrona e bloqueante**. Ela só retorna quando o
      stdin fecha. Se quem spawnou some sem fechar o cano — e o `spawnClaude` aborta por
      `AbortSignal.timeout`, além de haver testes que spawnam direto —, **o filho fica preso para
      sempre**. Não é processo lento; é processo que nunca mais recebe EOF.

      **E um cão de guarda não salvaria:** `readFileSync` trava o event loop, então nenhum
      `setTimeout` dispara. O fixture **não tem como se autodestruir** enquanto ler assim.

      *Escopo:* as duas pontas, provavelmente. **(a)** o fixture lê stdin de forma que permita um
      limite próprio de vida; **(b)** quem spawna garante fechar o stdin do filho, inclusive no
      caminho de abort. A (a) é local e defensiva; a (b) ataca a origem e depende de acertar
      todos os pontos de chamada. **Meça qual caminho vaza antes de consertar os dois.**

      *Aceite:* rodar a suíte inteira duas vezes seguidas e **a contagem de processos node não
      cresce**. Esse é o teste — não uma asserção de unidade, mas a verificação que prova o
      conserto. Diga a contagem antes e depois no relatório.

      **Por que vale mesmo não sendo urgente para o produto:** processo acumulado **envenena toda
      medição de tempo**. Já custou duas investigações — a Q-030a tratou como contenção e seguiu,
      e a S4-T0g gastou uma tarefa inteira procurando regressão no CI que não existia, porque o
      runner do GitHub nasce limpo e o problema era só local. Ver `docs/TESTES.md` § "Suíte lenta
      ou instável".

      **Medido em 2026-09-05, e o mecanismo real não era o hipotetizado acima (Q-052 tem os
      números completos).** `spawn-claude.ts` já fecha o stdin do filho de forma incondicional e
      síncrona logo após o `spawn()`, em todo caminho — inclusive abort — então o `readFileSync(0)`
      do fixture já recebia EOF quase de imediato mesmo no modo `'hang'`; o travamento eterno vinha
      de **depois** disso, do `setInterval` que o próprio modo `'hang'` arma de propósito. Contando
      `node.exe` desta worktree por `CommandLine` (`Get-CimInstance Win32_Process`, não
      `Get-Process`, que não expõe o comando): baseline 0; só o teste `-t "hangs"` deixa **1**
      processo; a suíte `tests/integration/generation` inteira (24 testes) deixa **exatamente 2** —
      o mesmo número das duas únicas ocorrências de `FAKE_CLAUDE_MODE = 'hang'` em todo o
      repositório. Nenhum teste spawna o fixture diretamente (grep confirmou); a frase "há testes
      que spawnam direto" não se sustentou aqui. A causa real: no Windows,
      `tests/integration/generation/_fixtures.ts` compila um `.exe` em C# como *launcher* (workaround
      do EINVAL de `.cmd`/`.bat`, CVE-2024-27980) — dois saltos de processo
      (`spawnClaude` → shim → `node fake-claude.mjs`). O `AbortSignal.timeout` mata só o PID
      imediato (o shim); no Windows isso não afeta o neto, que fica órfão sem sinal nenhum. No
      POSIX o launcher usa `exec`, que troca a imagem do processo mantendo o PID — aí matar o
      imediato mata o real, sem órfão. **Só (a) foi implementado.** `spawn-claude.ts` não tem bug
      de stdin para corrigir (medido), e a causa do órfão é específica do shim de teste do Windows,
      não da produção — atacar (b) (ensinar o arnês a matar a árvore inteira) seria escopo maior
      que o problema medido pede. `tests/fixtures/generation/fake-claude.mjs`: `readFileSync(0)`
      síncrono virou leitura assíncrona por `process.stdin`, preservando o `captureFile` idêntico
      (D-015/D-017 continuam provados pelo mesmo instrumento); um cão de guarda (`setTimeout` de
      5000ms, 17x o menor timeout real usado com `'hang'`, 300ms) mata o processo sozinho se nada
      mais o fizer. Contagem depois da correção: a suíte inteira de `generation` ainda deixa 2
      processos no instante em que o `vitest` retorna (o cão de guarda ainda não disparou), e cai
      para **0** dentro dos 6 segundos seguintes, medido por polling a cada 750ms — nunca mais
      cresce. Detalhes completos, incluindo os números passo a passo, em Q-052.

- [x] **S4-T3b — O daemon precisa deixar rastro quando falha, e o lock precisa desempatar PID.**
      Saída da **Q-049**, respondida em 2026-09-05. **Antes da S4-T5**, que vai querer ler as duas
      coisas.

      **Parte 1 — erro de ciclo vira estado, não fluxo.** Hoje o `scheduler/loop.ts` tem um
      `catch {}` deliberado: o daemon engole erro de ciclo. Um processo de fundo que falha sem
      rastro **fica vivo, parece saudável e não faz nada** — a pessoa descobre no dia seguinte,
      quando o briefing não existe, e não há o que investigar.

      **Logger está descartado:** o daemon sobe desanexado com `stdio` ignorado (D-005) — não tem
      para onde escrever —, e arquivo de log traz rotação, tamanho, retenção: várias chaves em
      disco (D-027) para um problema com solução menor.

      *Escopo:* gravar no `estado.json` **que já existe** o último erro e a **contagem de ciclos
      consecutivos que falharam**. O que a pessoa precisa não é "o que deu errado às 14h32", é
      **"faz três horas que não consigo trabalhar"**.

      *E uma notificação, uma só:* se o daemon falhar em **todos** os ciclos por um período longo,
      isso é acionável e merece **um** aviso — não um por erro. Mesmo padrão que o **D-018** já usa
      nos avisos precoces. **Notificar por ciclo é a enxurrada que o brief da S4-T3 proibiu.**
      Escolha o período e **justifique**; se não houver base, escolha o mais conservador e diga.

      **Parte 2 — o lock desempata por `procStart`.** Hoje ele guarda só o PID. **PID reciclado faz
      um lock morto parecer vivo** → o segundo daemon recusa subir → **nenhum daemon roda**, e a
      pessoa acha que está ligado. O erro oposto (dois daemons) é ruim mas **barulhento**; este é
      silencioso, e o D-025 existe contra ausência parecendo presença.

      *A maquinaria já existe:* a S1-T13 fez `ProcessControl.isAlive(pid, procStart)` exatamente
      para isso, e o `adapters/process/proc-start.ts` já captura o valor. O lock grava o
      `procStart` na escrita e compara na leitura. **Não construa maquinaria nova.**

      *Cuidado do D-025, que o `resolveIsAlive` já tem:* `procStart` que não pode ser capturado ou
      comparado (`unavailable`) **não** significa "morto" — cai para a checagem básica e o lock
      **continua respeitado**. Ausência de evidência não vira licença para subir um segundo daemon.

      *Aceite:* daemon que falha em vários ciclos deixa rastro legível no estado do dia e avisa
      **uma** vez; lock apontando para PID reciclado é reconhecido como morto; lock cujo
      `procStart` é indisponível **continua sendo respeitado**. **Os três com teste** — o terceiro
      é o que impede o conserto de virar o defeito oposto.

      **Implementado em 2026-09-05.** `core/daemon-health.ts` (novo) é a decisão pura: dado o
      `DaemonHealth` atual (`{ lastCycleError: { message, at } | null, consecutiveCycleFailures
      }`, campo novo em `DayState`), a mensagem de erro e o instante, devolve o próximo estado e se
      esta é a ÚNICA passagem que deve notificar — `consecutiveCycleFailures ===
      NOTIFY_AFTER_CONSECUTIVE_CYCLE_FAILURES` (120 ciclos = 1h a 30s/poll, reaproveitando a ordem
      de grandeza que o Spike J já tinha fixado, em vez de um terceiro número solto — justificado
      no comentário e na Q-053 item 2). `scheduler/health.ts` (novo) é a casca de I/O chamada do
      `catch` de `scheduler/loop.ts#runDaemon` — lê `estado.json`, grava o resultado, notifica só
      quando `shouldNotify`; um sucesso limpa a sequência só quando havia algo para limpar (sem
      escrita em `estado.json` no caminho saudável comum). `scheduler/notices.ts` ganhou
      `buildDaemonUnhealthyNotice`, reportando minutos estimados pela contagem de ciclos (sem
      `Clock` dentro de `core/`, D-019) e o último erro.

      **`daemonHealth` é o único campo de `DayState` que sobrevive à virada de meia-noite** —
      `core/schedule.ts#resetIfNewDay` ganhou uma exceção explícita e comentada: sem isso, um
      daemon quebrado desde antes da meia-noite pareceria "saudável" no dia seguinte, exatamente o
      oposto do que esta tarefa existe para resolver (Q-053 item 1, com teste dedicado provando os
      dois lados: campos por dia resetam, `daemonHealth` não).

      **Lock:** `core/daemon-lock.ts#DaemonLockInfo` ganhou `procStart: string | undefined`; o
      comentário de topo do arquivo (que afirmava a limitação como aceita) foi reescrito, não
      deixado desatualizado. `scheduler/lock.ts#checkDaemonLock` passa `existing.procStart` para
      `ProcessControl.isAlive`, reaproveitando o desempate que a S1-T13 já construiu — nenhuma
      lógica de comparação nova. `acquireDaemonLock` ganhou parâmetro `procStart`, gravado junto
      com o lock. **A premissa da Q-049 item 6 (de que a autodescrição do próprio `procStart` não
      era possível) não se sustentou ao encostar no código** — `captureObservedProcStart` não se
      importa de quem é o `pid`, então `cli/index.ts` chama a mesma função já existente sobre o
      próprio `process.pid` do worker, logo após ele subir, e passa o valor adiante como dado
      pronto (nunca I/O dentro de `scheduler/`) — ver Q-053 para o relato completo.

      **PID reciclado, testado com processo real** (`tests/integration/scheduler/lock.test.ts`,
      novo): reaproveita a técnica de `tests/integration/process/liveness.test.ts` — um filho real
      genuinamente vivo, lock gravado com `procStart` deliberadamente errado, produz exatamente a
      mesma evidência que uma reciclagem de PID produziria; `checkDaemonLock` devolve `'acquire'`
      mesmo com o PID vivo. Caso irmão com o `procStart` real confirma `'refuse'`. `procStart`
      ausente no lock (formato antigo) também testado de ponta a ponta: `'refuse'`, nunca tratado
      como morto (D-025).

      **Migração:** os dois documentos (`estado.json`, `daemon.lock`) ganharam campos `.optional()`
      dentro da MESMA versão de schema, sem bump — mesmo precedente que `captureAttemptsToday` já
      tinha aberto em `state-schema.ts`. Testado escrevendo documentos à mão (nunca via
      `serializeState`/`serializeDaemonLock`) sem as chaves novas e confirmando que a leitura
      devolve os defaults (`EMPTY_DAEMON_HEALTH`/`procStart: undefined`) em vez de rejeitar o
      arquivo (`tests/integration/storage/state.test.ts` e `daemon-lock.test.ts`).

      **Sete escolhas sem resposta literal no despacho da tarefa, registradas em Q-053** (onde
      `daemonHealth` mora, o limite de 120 ciclos, a estimativa de minutos por contagem em vez de
      tempo real, a constante `POLL_INTERVAL_MS` repetida em vez de importada — evita ciclo de
      import dentro de `scheduler/` —, ausência de bump de `schemaVersion`, onde o `procStart`
      próprio é capturado, e o alcance do teste de "procStart indisponível"). `docs/TESTES.md`
      ainda descreve o lock sem desempate — não editado por mim (não é documento que o dev altera),
      sinalizado na Q-053 para o PO atualizar.

      Cobertura: `core/` 100% (`daemon-health.ts`/`daemon-lock.ts` inclusos); `scheduler/` 98,14%
      statements/98,27% branches/92,59% funções/100% linhas. `npm run verificar` e `npm run
      verificar:linux` verdes (medido nesta máquina, o segundo via Docker Desktop, container Linux
      real).

- [x] **S4-T3c — Persistir o `assistantMessages` no handoff.** Decisão do mantenedor ao fechar a
      **Q-036**, em 2026-09-05.

      **Por que muda.** O `understanding` é **derivado** do texto do assistente. Sem ele em disco,
      o handoff **não é auditável** — não dá para saber, relendo, se o modelo leu ou inventou. E
      este projeto já pegou as duas coisas: identificador fabricado (sonnet, 02/09) e conclusão
      invertida (haiku, 02/09). **Guardar a evidência é o que permite conferir em vez de confiar.**

      **O argumento que sustentava não persistir caiu, e a medição é simples:**

      ```
      assistantMessages : 10 mensagens × 500 caracteres  → teto ~5 KB
      lastPrompts       : 10 prompts   × SEM LIMITE      → sem teto
      ```

      O campo que não era gravado é **o único dos dois com teto**. "Volume muito maior que os
      prompts" era o meu argumento, e é o inverso da verdade.

      *Escopo:* `assistantMessages` entra no `handoffFactsSchema` e no `serializeHandoff`; o
      `parseHandoffFacts` **deixa de devolver `[]` fixo** e passa a ler do disco.

      **Migração obrigatória — `schemaVersion` 2 → 3.** Documento v2 volta a ser lido com
      `assistantMessages: []`, porque um handoff v2 **nunca mediu isso** e `[]` é o valor honesto
      (D-025). Mesma disciplina da D-032, que já provou valer: os quatro dias reais do mantenedor
      foram lidos com o código novo **antes** de a mudança ser aceita. **Faça o mesmo** — e diga
      no relatório que fez.

      *Cuidado de privacidade, e ele não é bloqueante:* isto aumenta o conteúdo de trabalho real
      em `~/.seeya/`. Nada disso pode aparecer em fixture do repositório — o portão de termos
      locais existe para isso e **já recusou um commit** nesta sessão.

      *Fora de escopo:* dar teto ao `lastPrompts` (**Q-051**). Truncar prompt do usuário pode
      piorar a captura e é decisão de outra natureza; juntar faria uma tarefa carregar dois riscos.

      *Aceite:* handoff novo grava e relê o texto do assistente; **handoff v2 já em disco
      continua legível**, com `[]`. Os dois com teste.

      **Implementado em 2026-09-06:** `HANDOFF_SCHEMA_VERSION` 2 → 3
      (`src/adapters/storage/handoff-schema.ts`). `assistantMessages` entrou no
      `handoffFactsSchema` (`z.array(z.string())`), `serializeHandoff` passou a escrevê-lo, e
      `parseHandoffFacts` deixou de devolver `[]` fixo — lê `raw.assistantMessages` do documento já
      migrado. `migrateHandoffV2ToV3` acrescenta `assistantMessages: []` a um documento v2
      (que nunca escreveu essa chave), registrada em `HANDOFF_SCHEMA_MIGRATIONS[2]` — mesmo
      mecanismo de `resolveSchemaVersion` que a D-032 já validou, encadeando 1→2→3 automaticamente
      para um documento v1. `core/types.ts#SessionFacts.assistantMessages` teve o docstring
      atualizado: a frase que dizia "deliberately NOT added to `handoffFactsSchema`" (verdadeira
      até esta tarefa) foi substituída pela descrição do novo comportamento. Limites
      (`MAX_ASSISTANT_MESSAGES`/`MAX_ASSISTANT_MESSAGE_CHARS`) e o teto do `lastPrompts`
      **não foram tocados** (Q-051 segue fechada como estava).

      **Diferença de padrão em relação à D-032, registrada e justificada (Q-055):** os campos de
      D-032 (`filesOutsideRepository`/`reposNotVisited`) migram para `null`, para distinguir "não
      medido" de "medido, deu zero" — são contagens. `assistantMessages` migra para `[]`, não
      `null`, porque o **tipo** já era `readonly string[]` antes desta tarefa: "nenhuma mensagem
      encontrada" sempre foi `[]`, medido ou não, e dar `null` ao campo exigiria mudar o tipo de
      `SessionFacts` para acomodar uma distinção que ele nunca precisou fazer. Segui a letra da
      tarefa (`[] é o valor honesto`) em vez do precedente de D-032 — os dois casos parecem iguais
      e não são.

      **Migração testada em dois níveis, como o aceite pede:**
      1. `tests/integration/storage/handoff.test.ts`, novo describe "S4-T3c migration from
         schemaVersion 2" — documento v2 **bruto** (JSON escrito à mão, nunca via
         `serializeHandoff`) sem a chave `assistantMessages` é lido sem erro, como `[]`;
         `filesOutsideRepository`/`reposNotVisited` já migrados de D-032 continuam corretos depois
         do passo v2→v3; `listHandoffs` migra transparentemente; ler duas vezes não reescreve o
         arquivo. Mais um teste no describe de D-032 provando que um documento v1 encadeia as duas
         migrações (1→2→3) e chega em `assistantMessages: []`. E o teste antigo que provava a
         **exclusão** de Q-036 foi invertido: agora prova que um handoff com texto real do
         assistente é **persistido** e volta idêntico (round-trip).
      2. **Verificação manual contra os handoffs reais do mantenedor**, pedida explicitamente no
         despacho (mesma disciplina da D-032): script só-leitura com o `StorageAdapter` do build
         novo contra `~/.seeya/days/` desta máquina. **Medido:** 8 diretórios de dia (incluindo
         três backups de `2026-09-02` e um de `2026-09-05`), 12 handoffs, mistura real de
         `schemaVersion` 1 (8 arquivos) e 2 (4 arquivos). Todos os 12 leram sem erro, zero
         rejeitados, todos com `assistantMessages: []` (nenhum foi capturado com o código novo,
         então nenhum tinha o campo — `[]` é o valor certo para os 12). Os campos de D-032
         continuaram corretos (inclusive um `filesOutsideRepository: 14` real). Conferido por
         `grep` depois que os 12 arquivos em disco **não mudaram** de `schemaVersion` — a leitura
         não reescreve nada. Detalhe completo e a diferença de padrão registrados na Q-055.

      `npm run verificar` e `npm run verificar:linux` verdes (medidos nesta máquina, o segundo via
      Docker Desktop). Cobertura: `core/` 100%, `adapters/storage` 97,92% statements/90,29%
      branches/98,03% funções/98,42% linhas — acima do piso de 80% do diretório.

- [x] **S4-T3d — Quatro números para a config (D-035) e o agendamento vencido (D-036).**
      Saída da varredura de questões com o mantenedor, em 2026-09-05.

      **Parte 1 — D-035.** Quatro números viram chave de `config.json`, **com o valor atual como
      default**, então nada muda de comportamento:

      | de | default | por quê é preferência, não fato técnico |
      |---|---|---|
      | `MAX_GIT_ROOTS_TO_VISIT` | 8 | depende do arranjo de pastas da pessoa |
      | limite de retentativa de captura | 3 | depende do quanto ela topa gastar |
      | `MAX_BRIEFING_SCAN_DAYS` | 30 | quem volta de um mês fora quer mais |
      | limiar de disparo obsoleto | 5 min | quanta obsolescência ela tolera (D-036) |

      **Leia a D-035 antes de escolher os nomes** — ela tem o critério, e a lista do que
      **continua constante** e por quê. Não mova nada além destes quatro.

      **Parte 2 — D-036, e é mudança de comportamento.** Emenda a `docs/ESPECIFICACAO.md`, que
      mandava o encerramento acontecer ao acordar "com aviso de que houve atraso". Passa a ser:

      1. **Dia local diferente → não dispara, nunca.** Notifica que o encerramento daquele dia
         não aconteceu e precisa ser feito à mão.
      2. **Mesmo dia, atrasado além do limiar → captura, mas NÃO encerra.** Aviso diz que rodou
         atrasado e que a terminação foi pulada.
      3. **Mesmo dia, dentro do limiar → normal.**

      **Por que a assimetria:** capturar tarde é quase inofensivo — a captura fotografa as sessões
      como estão. **Encerrar tarde pode destruir trabalho:** com `canTerminate: true`, uma máquina
      que acorda às 8h faria um agendamento de ontem **matar as sessões abertas hoje**.

      *O `core/schedule.ts` não muda:* ele continua devolvendo `delayMs` cru e **não** escolhe
      limiar (Q-037 item 3). Quem decide é o daemon, agora lendo a config.

      *Aceite:* dia virado **não** dispara e notifica; mesmo dia atrasado captura e **não**
      encerra, mesmo com `canTerminate: true`; dentro do limiar tudo normal. **Os três com
      teste** — o segundo é o que protege trabalho de quem deixa a máquina suspender.

      *Cuidado:* `docs/ESPECIFICACAO.md` é documento de autoridade. **Atualize o texto dela**
      apontando para a D-036, em vez de deixar a spec contradizendo o código.

      **Implementado em 2026-09-06.** Os quatro números viraram campos de `Config`
      (`core/types.ts`), opcionais em `configFileSchema` e com o valor atual como default em
      `CONFIG_DEFAULTS` (`adapters/storage/config-schema.ts`): `maxGitRootsToVisit` (8),
      `maxCaptureAttemptsPerSessionPerDay` (3), `maxBriefingScanDays` (30) e
      `overdueFireThresholdMinutes` (5). As constantes antigas (`MAX_GIT_ROOTS_TO_VISIT`,
      `MAX_CAPTURE_ATTEMPTS_PER_SESSION_PER_DAY`, `MAX_BRIEFING_SCAN_DAYS`) continuam existindo,
      agora documentadas como "o default que a config espelha" — `core/` não pode importar
      `adapters/storage/config-schema.ts` (matriz de camadas), então cada uma pina o mesmo literal
      de novo, o mesmo padrão que `POLL_INTERVAL_MS` já usava em `scheduler/`.

      **Threading até o uso real.** `GitReader.readEvidenceAcrossRepos` (`core/ports.ts`) ganhou
      `maxRootsToVisit?: number`; `application/evidence-gathering.ts#gatherEvidence` repassa
      `config.maxGitRootsToVisit`, chamado por `application/capture-session.ts` (usado tanto por
      `seeya end-day` quanto pelo daemon). `scheduler/capture-filter.ts#buildRetryFilter` e
      `core/capture-retry.ts#sessionsExhaustedToday` ganharam `maxAttempts` opcional, alimentado
      por `config.maxCaptureAttemptsPerSessionPerDay` em `scheduler/poll.ts`.
      `application/find-pending-briefing.ts#findPendingBriefing` já aceitava `maxScanDays` desde a
      S3-T3 — só precisou de um chamador real: `cli/composition.ts#buildStartDayContext` **passou
      a ler `config.json`**, coisa que evitava de propósito antes (comentário antigo removido,
      motivo em Q-054 item 3).

      **D-036, as três regras, em `scheduler/poll.ts`.** Caso 1 (dia virado):
      `pollOnce` compara `estado.json` (`stored.day`) com o dia local de `now` **antes** de chamar
      `decideSchedule` — `core/schedule.ts#resetIfNewDay` foi **exportado** (não alterado de
      contrato) para o daemon reaproveitar a mesma comparação em vez de duplicá-la. Se o dia virou
      e o fechamento de ontem nunca disparou (`!endOfDayFired`) nem foi pulado (`!skipped`) com
      `endOfDayTime` ligado, notifica **uma vez** (`scheduler/notices.ts#buildMissedEndOfDayNotice`)
      e grava o estado resetado imediatamente — é essa gravação que move `stored.day` para hoje e
      impede o mesmo aviso de repetir a cada poll de 30s enquanto a pessoa não interage (o mesmo
      padrão "avisa uma vez" que `core/daemon-health.ts`/S4-T3b já tinha estabelecido, reaproveitado
      como o brief pediu). Casos 2/3 (mesmo dia): `runEndOfDay` compara o `delayMs` cru que
      `core/schedule.ts` já devolvia (Q-037 item 3, contrato **não** alterado) contra
      `config.overdueFireThresholdMinutes`; se vencido, chama `endDay` com o novo
      `EndDayOptions.skipTermination: true` (`application/types.ts`), que
      `application/capture-session.ts#captureSession` transforma em
      `policy.canTerminate && !skipTermination` — o handoff é gravado e verificado normalmente
      (D-002 continua valendo), só a terminação é pulada. Dentro do limiar, `skipTermination` é
      `false` e o comportamento é idêntico ao de antes desta tarefa.

      **O teste que protege trabalho real** (`tests/unit/scheduler/poll.test.ts`, describe "D-036
      case 2/3"): uma sessão com `canTerminate: true` e um `ProcessControl.terminateGracefully` que
      **lança exceção se for chamado** (prova mais forte que um contador — se a terminação fosse
      tentada, `pollOnce` teria rejeitado e o teste teria falhado); poll 15 minutos depois do
      `endOfDayTime` configurado, sessão capturada com sucesso (handoff existe em disco), aviso
      diz "delayed"/"no session was terminated", e a promessa `pollOnce(...)` resolve sem lançar —
      prova que `terminateGracefully` nunca foi invocado. Um segundo teste espelha o mesmo cenário
      **dentro** do limiar (5s de atraso) com um `ProcessControl` real que registra a chamada, e
      confirma que a terminação ACONTECE normalmente — sem o par positivo, o primeiro teste só
      provaria "meu guarda reprova", não "meu guarda reprova o caso certo" (AGENTS.md: "teste o
      caso permitido, não só o proibido").

      **O caso 1 também tem os dois lados testados:** dia virado com fechamento nunca disparado
      notifica uma vez e não repete num segundo poll no mesmo dia; dia virado com fechamento **já
      disparado**, ou explicitamente **pulado** (`skip-today`), ou com `endOfDayTime: null`
      (agendamento desligado) — nenhum desses notifica, provando que o aviso não é automático só
      porque o dia mudou.

      **Seis escolhas sem resposta literal no despacho da tarefa, registradas em Q-054** — os
      quatro nomes (em especial `overdueFireThresholdMinutes`, escolhido para nomear o FATO, não a
      consequência), o acoplamento (deliberado, sob o default) entre este limiar e a janela de
      retentativa de turno ativo (as duas usam 5 minutos por construção, não coincidência — mesma
      lógica que a Q-049 item 5 já tinha adotado para a versão só-texto deste número), a leitura
      nova de `config.json` em `seeya start-day`, o uso da config ATUAL (não a de ontem) para
      decidir se um dia perdido merece aviso, a redação do aviso do dia perdido (não promete refazer
      o fechamento — não existe `--day` no `seeya end-day`), e `docs/ARQUITETURA.md` § "Config" não
      atualizado com os quatro campos (mesmo gap já existente para `forkCleanupDays`).

      **Migração testada:** `tests/integration/storage/read-config.test.ts` escreve um
      `config.json` no formato EXATO de antes desta tarefa (sem as quatro chaves novas) e confirma
      que a leitura devolve os quatro defaults em vez de rejeitar o arquivo; um segundo teste
      confirma que um `config.json` com as quatro chaves presentes honra cada uma.

      Cobertura, `npm run cobertura` (Windows, esta máquina): geral 97,87%/93,50%/98,51%/98,04%
      (statements/branches/functions/lines); dentro do container Linux
      (`npm run verificar:linux`, `node:22-bookworm`): 97,92%/93,67%/98,64%/98,04% — as duas acima
      dos mínimos do `AGENTS.md`. `core/` 100% em statements/functions/lines nas duas máquinas,
      99,06% branches (`briefing.ts`, não tocado por esta tarefa, é a única linha de branch
      faltante ali). `scheduler/` 98,29%/100%/93,1%/100%
      (`poll.ts`/`capture-filter.ts`/`notices.ts` 100% nas quatro métricas; o único gap de funções
      em `scheduler/` é `loop.ts`, não tocado por esta tarefa). `npm run verificar` e
      `npm run verificar:linux` verdes, códigos de saída lidos separadamente do comando, nunca
      encadeados com commit.

- [x] **S4-T4 — `seeya snooze`, `seeya skip-today`, `seeya config`.**
      `docs/ESPECIFICACAO.md` § "seeya snooze..."/"seeya config" (D-006, D-027, D-035).

      **`snooze`/`skip-today` construíram zero regra nova** — tudo já existia em `core/schedule.ts`
      desde a S4-T2 (`applySnooze`/`applySkipToday`/`resetIfNewDay`). `src/cli/snooze-command.ts`
      só resolve `today` pelo `Clock` injetado (D-019), lê/grava `Storage.readState`/`saveState`, e
      renderiza a confirmação re-chamando `decideSchedule` **só de leitura** (o `nextState` dessa
      segunda chamada nunca é persistido) — a mensagem nunca inventa uma segunda interpretação do
      estado, ela pergunta à mesma função que o daemon vai perguntar no próximo poll.
      `+15m`/`+30m`/`+1h` é o único enum aceito, igual ao texto que
      `scheduler/notices.ts#buildLeadTimeNotice` já sugeria.

      **`seeya config`** tem três sub-ações: `get [key]` / `set <key> <value>` (toda chave escalar
      de `Config` — horário, antecedências, modelo, todos os limites incluindo os quatro da D-035)
      e `policy <cwd> [--can-terminate <bool>] [--deep-capture <bool>]` (a única categoria indexada
      por `cwd`, não escalar). A spec nomeia categorias, não subcomandos literais — desenho
      registrado em `docs/QUESTOES.md` Q-056. Validação em `adapters/storage/config-schema.ts`
      reaproveita o `configFileSchema` já existente campo a campo
      (`configFileSchema.shape[key].safeParse(...)`), nunca uma cópia da regra: mudar o regex de
      `endOfDayTime` num lugar já muda o outro. `Storage` ganhou `saveConfig` (D-027: `config.json`
      era só-leitura em produção desde a S1-T5 — esta é a primeira escrita real).

      **A chave e o valor são validados ANTES de escrever (D-027).** Chave inexistente ou valor que
      o schema recusaria nunca chega a `writeFileAtomic` — provado por teste: um `set` inválido
      nunca cria `config.json` do zero nem sobrescreve um já existente.

      **Adiar acumula, pular depois de adiar mantém o adiamento gravado, e a virada de meia-noite
      zera tudo menos `daemonHealth`** — os cinco casos obrigatórios de `docs/TESTES.md`, cada um
      com teste próprio em `tests/unit/cli/snooze-command.test.ts`, mais o espelho em
      `tests/integration/cli/snooze-command.test.ts` contra um `StorageAdapter` real: uma escrita
      por uma instância e uma leitura por uma instância **completamente nova**, sem estado
      compartilhado nenhum — a prova de "funciona com ou sem o daemon rodando" que a spec pede.

      **A corrida de escrita concorrente foi medida, não suposta.** `adapters/storage/atomic-write.ts`
      já registrava que não havia, até esta tarefa, um segundo escritor/leitor concorrente de
      `config.json` para justificar medir — e que `estado.json` ganharia o mesmo problema quando
      `seeya snooze` chegasse. Dois testes de integração
      (`tests/integration/storage/state-concurrent-write.test.ts`,
      `config-concurrent-write.test.ts`) martelam 300 iterações de leitura/escrita concorrentes via
      `StorageAdapter` real. **Medido nesta máquina (Windows): ~18-20% das escritas colidem com
      `EPERM`** (o risco que `atomic-write.ts` já documentava, nunca um modo de falha novo);
      **0/300 leituras, em seis execuções, viram documento corrompido** — a garantia "nunca
      parcial" do `writeFileAtomic` se sustentou sob carga real. Não implementei retry nem lock —
      o despacho da tarefa pediu explicitamente para não inventar travamento; a escolha e as
      opções ficam registradas em Q-056 para o mantenedor decidir.

      **Não tocado, fora do escopo dos três comandos:** `seeya status` continua sem mostrar
      `skipped`/`snoozeMinutesTotal`/daemon rodando (a Q-015 já esperava isso até S4-T3/S4-T4
      existirem — ambas prontas agora, mas mexer em `status-command.ts` não foi pedido por esta
      tarefa; registrado em Q-056 para o mantenedor abrir como tarefa própria se quiser).

      **Cobertura, medida nesta máquina:** agregado 97,53%/93,13%/98,58%/97,67%
      (statements/branches/functions/lines) — acima dos mínimos do `AGENTS.md`. `core/` 100%
      statements/functions/lines, 99,06% branches (não tocado por esta tarefa).
      `adapters/storage/` 94,93%/88,55%/98,38%/95,31%; `cli/` 97,39%/96,03%/97,43%/97,33% — os dois
      arquivos novos (`snooze-command.ts`, `config-command.ts`) e o `config-schema.ts` estendido
      todos acima de 80%. `npm run verificar` e `npm run verificar:linux` verdes, códigos de saída
      lidos separadamente do comando, nunca encadeados com commit.
- [x] **S4-T4b — Escrita concorrente não pode virar stack trace no `snooze`.** Saída da medição
      da S4-T4, em 2026-09-06.

      **Medido**, 300 iterações concorrentes de leitura/escrita, 3 execuções cada:

      ```
      ~18-20%  das ESCRITAS rejeitadas com EPERM no rename (Windows)
        0/300  das LEITURAS viram documento corrompido — em nenhuma das 6 execuções
      ```

      **A garantia do rename atômico segura inteira** — nenhum leitor vê arquivo partido, e o
      `atomic-write.ts` já documentava esse risco desde a S1-T5, sem ninguém poder medir porque
      não havia escritor. Quem perde é a **promessa do escritor**.

      **O problema:** ninguém captura essa rejeição. Um `seeya snooze` no instante infeliz falha
      com **stack trace e código 1** — embora o arquivo em disco permaneça válido.

      **E o motivo de não esperar relato de usuário, que os números escondem: a colisão não é
      uniformemente distribuída.** O daemon escreve a cada 30 segundos, e o `snooze` é justamente
      o comando que se roda **no momento do encerramento** — o instante em que o daemon está mais
      ativo. O relato seria *"o snooze quebrou às 19h30, quando eu precisava dele"*.

      *Escopo:* retentativa **limitada** dentro do `atomic-write.ts`, que conserta os dois
      escritores de uma vez (o comando e o daemon), **mais** mensagem legível quando a
      retentativa esgota — nunca stack trace para o usuário (AGENTS.md § "Mensagens de erro").

      *Cuidados:*
      **(a)** retentativa **limitada**, não infinita — problema real de permissão (antivírus
      segurando o arquivo, por exemplo) precisa continuar aparecendo, não virar travamento;
      **(b)** `atomic-write.ts` é adapter, então dormir ali é permitido — o **D-019 proíbe ler o
      relógio**, não esperar. Mas se você precisar de `Clock`, diga em vez de improvisar;
      **(c)** a medição existente (`state-concurrent-write.test.ts`,
      `config-concurrent-write.test.ts`) é o seu instrumento — **rode antes e depois** e mostre os
      dois números.

      *Aceite:* a taxa de escrita rejeitada **cai de forma medida**, e o que restar sai como
      mensagem, não como stack trace. **A garantia de leitura não pode regredir**: 0 documento
      corrompido continua sendo 0.

      **Implementado:** retentativa limitada dentro de `writeFileAtomic`
      (`adapters/storage/atomic-write.ts`), só no passo de `rename` e só para `EPERM` (o único
      código já observado nas duas medições). Entre tentativas, um turno do event loop
      (`setImmediate`) — não `Clock`/`setTimeout` — porque a corrida é de ordenação do event loop
      (o leitor concorrente precisa terminar `open`+`read`+`close`), não de tempo relógio; ver
      Q-058 para a análise completa de por que `Clock` injetado teria custo desproporcional aqui
      (~100 call sites de `StorageAdapter` em teste). `MAX_RENAME_ATTEMPTS = 8`, escolhido testando
      1/5/8/10 tentativas com o mesmo instrumento até o ponto de retorno decrescente. Ao esgotar as
      tentativas, a mensagem nomeia o arquivo e diz que ele continua travado, com o erro original
      em `.cause` — nunca mais o texto cru do Node. Como o fix mora dentro de `writeFileAtomic`,
      conserta os dois escritores (`seeya snooze`/`config` e o daemon) sem tocar
      `snooze-command.ts`, `config-command.ts` nem `scheduler/`.

      **Medido nesta máquina (Windows), 300 iterações/3 execuções, mesmo instrumento antes e
      depois:**

      ```
      estado.json  antes: 60/300, 64/300, 56/300 (~19-21%)   depois: 3/300, 5/300, 1/300 (~0.3-1.7%)
      config.json  antes: 63/300, 63/300, 55/300 (~18-21%)   depois: 7/300, 1/300, 1/300 (~0.3-2.3%)
      leituras     antes: 0/300 corrompidas (todas as execuções)   depois: 0/300 (todas as execuções)
      ```

      A garantia de leitura não regrediu (0 continua 0), e a taxa de escrita rejeitada caiu cerca
      de 10-60× dependendo da execução — sem eliminá-la por completo, o que é esperado: um leitor
      ainda pode, em tese, vencer as 8 tentativas seguidas.

      **Cobertura, medida nesta máquina:** agregado 97,5%/93,02%/98,58%/97,64%
      (statements/branches/functions/lines). `core/` 100% statements/functions/lines, 99,06%
      branches (não tocado por esta tarefa). `adapters/storage/` 94,86%/88,06%/98,48%/95,2%,
      `atomic-write.ts` 92,59%/83,33%/80%/96% — acima do mínimo de 80% do `AGENTS.md` para fora de
      `core/`. `npm run verificar` e `npm run verificar:linux` verdes, códigos de saída lidos
      separadamente, nunca encadeados com commit.

      Q-058 registra a tensão entre o despacho ("dormir ali é permitido... se precisar de `Clock`,
      diga") e o guard de lint (`no-restricted-globals` bane `setTimeout`/`setInterval` em todo
      `src/**` fora de `adapters/clock/`, sem exceção por intenção), e por que a solução escolhida
      foi `setImmediate` sem `Clock` em vez de expandir a assinatura de `StorageAdapter`.

- [x] **S4-T5 — `seeya daemon --stop/--status`.** Fecha o Sprint 4.
      *Aceite do sprint:* e2e 6, 7 e 8 passam. Um dia inteiro de uso real sem intervenção.

      **Implementado em 2026-09-06.** `src/cli/daemon-command.ts` ganhou `runDaemonStatus` e
      `runDaemonStop`, ambos sobre um único `checkLiveLock` que lê `daemon.lock` e desempata
      liveness com o `procStart` que a S4-T3b já construiu (`ProcessControl.isAlive(pid,
      procStart)`) — os dois comandos nunca podem discordar sobre qual dos quatro estados (D-024)
      estão vendo, porque leem exatamente a mesma decisão.

      **Os quatro estados, nunca achatados.** `LiveLockCheck` é uma união discriminada:
      `noLock` (nunca subiu, ou já saiu limpo), `dead` (lock existe, PID confirmado morto pelo
      desempate — "não rodando", mas com texto diferente de `noLock` para um crash não parecer algo
      "atualmente errado"), `alive` (lock existe, PID confirmado vivo), e `unknown` (a própria
      checagem de liveness **lançou** — `adapters/process/liveness.ts#interpretExistenceCheckError`
      se recusa a adivinhar um código de erro desconhecido, e nem `--status` nem `--stop` fingem
      saber "rodando" ou "não rodando" nesse caso, D-025). `--status` mostra, junto: `DayState.
      daemonHealth` (o ponto inteiro da S4-T3b — reaproveita `buildDaemonUnhealthyNotice` para o
      texto/estimativa de minutos, nunca recalculando a aritmética uma segunda vez, e destensa a
      frase — presente quando o daemon está vivo, passado quando não está, "status atual
      desconhecido" no caso `unknown` — para nunca afirmar "ainda falhando" sobre um processo que já
      não existe), e o estado de agenda de hoje via `decideSchedule` (nunca uma releitura própria de
      `skipped`/`endOfDayFired`, mesma disciplina que `cli/snooze-command.ts#renderSnoozeConfirmation`
      já usa — o texto não pode discordar do que o próximo poll real faria). `--status` é read-only:
      nunca escreve `daemon.lock` nem `estado.json`, nem quando encontra lock obsoleto.

      **A premissa do brief ("SIGTERM entre processos no Windows não roda o handler JS") já estava
      medida, não precisou de medição nova.** `tests/integration/process/daemon-launch.test.ts`
      (S4-T3) já documentava isso no próprio comentário, ao explicar por que
      `termination-windows.ts` existe. Conferido de novo aqui só para ter certeza de que a leitura
      não mudou.

      **Por que o Windows é necessariamente abrupto, e o texto do `--stop` diz isso em vez de
      fingir simetria.** Duas medições, nenhuma nova: (1) o Spike G mediu que `AttachConsole` falha
      com erro 6 contra um processo sem console — e o daemon sobe exatamente assim, de propósito
      (D-005, `DETACHED_PROCESS`), então `CTRL_BREAK_EVENT` nunca alcança o worker. (2) a S4-T3b
      mediu que `process.kill(pid, 'SIGTERM')` entre processos no Windows chama `TerminateProcess`
      na hora, sem rodar handler nenhum. As duas medições juntas fecham a pergunta: não existe
      **nenhum** caminho gracioso para o daemon no Windows, nem o que já existia
      (`terminateGracefully`) nem um `SIGTERM` cru. `runDaemonStop` no Windows pula direto para o
      abrupto e diz por quê na própria mensagem, em vez de tentar `terminateGracefully` primeiro só
      para observar o "no-console" de sempre.

      **Novo primitivo, deliberadamente fora de `ProcessControl`:**
      `adapters/process/termination.ts#terminateAbruptly(pid)` — `SIGKILL`/`TerminateProcess`
      incondicional, tolerando `ESRCH` (já morto), relançando qualquer outro erro. **Nunca** usado
      em sessão descoberta (D-002 seguiria proibindo kill forçado ali); existe só para o `seeya`
      encerrar o próprio daemon. Não entrou na porta `ProcessControl` porque nenhum chamador em
      `scheduler/`/`application/` precisa dele — só `cli/daemon-command.ts`, que já importa função
      de adapter diretamente noutros pontos (`spawnDetachedDaemon`, `captureObservedProcStart`),
      então isto segue o mesmo precedente em vez de inchar um contrato cruzado por uma única chamada.

      **Quem limpa o lock — respondendo à pergunta do brief.** `runDaemonStop` **sempre** confirma a
      morte primeiro e **sempre** limpa o lock depois, em qualquer caminho (grácil, abrupto, ou lock
      já obsoleto) — nunca confia só no próprio `clearDaemonLock()` do daemon ao sair
      (`scheduler/loop.ts`), porque essa confiança já provou ser furada no Windows (não há saída
      graciosa) e não é garantida nem no POSIX (o processo pode cair entre o sinal e a própria
      escrita de limpeza). O `clearDaemonLock()` do daemon continua existindo como segunda linha de
      defesa para um `--stop` que ele **não** disparou (um `kill -TERM` de fora, por exemplo) — as
      duas coisas convivem, mas `--stop` nunca depende da segunda. A limpeza só acontece com
      **evidência positiva** de morte (D-025): se o `SIGKILL` não pôde nem ser enviado (erro de
      permissão) ou o PID ainda aparece vivo depois de reconferido, o lock fica como está e a
      mensagem manda checar à mão — soltar um lock cujo PID pode continuar vivo arrisca dois daemons
      simultâneos, o defeito que o resto do D-005 existe para evitar.

      **Achado ao construir, corrigido no mesmo commit: `scheduler/loop.ts` só notava um `--stop`
      depois de até 30s dormindo.** `runDaemon`'s laço só checava `shouldStop` antes/depois de cada
      poll e de UM sleep de `POLL_INTERVAL_MS` inteiro — um `SIGTERM` real chegando logo no início
      da soneca ficava sem efeito prático por quase 30s. `sleepUntilNextPollOrStop` (novo,
      `scheduler/loop.ts`) fatia a mesma espera em pedaços de 1s, checando `shouldStop` entre eles —
      o tempo total dormido não muda (ainda `POLL_INTERVAL_MS` quando ninguém pede parada), só a
      **reação** a um pedido de parada, que cai de "até 30s" para "cerca de 1s". Medido pelo próprio
      e2e novo (item 8, abaixo): a jornada inteira — dois daemons reais, `--status`, `--stop`,
      terceiro daemon — roda em ~2-3s, não nos 30s+ que o `GRACEFUL_STOP_DEADLINE_MS` sozinho
      pediria sem essa mudança. Sem essa correção, `--stop` continuaria correto, só lento; com ela,
      fica rápido no caso comum e ainda correto no raro.

      **Números escolhidos sem base na spec, registrados em Q-057:**
      `GRACEFUL_STOP_DEADLINE_MS` (15s) e `ABRUPT_STOP_CONFIRM_MS` (2s).

      **Testes.** Unidade (`tests/unit/cli/daemon-command.test.ts`): os quatro estados de
      `--status` (incluindo a checagem que lança), a diferença de tempo verbal saudável/vivo vs.
      obsoleto/desconhecido na saúde, a nota de agenda (desabilitado, pulado, com adiamento
      acumulado), e os ramos de `--stop` que não tocam processo real (sem lock, lock obsoleto —
      limpo —, checagem que lança — lock intocado). Integração
      (`tests/integration/process/termination.test.ts`): `terminateAbruptly` contra um processo
      real — mata sem rodar o handler grácil (a prova de que é abrupto), e tolera PID já morto;
      medido que a confirmação de morte **precisa** de uma espera curta (o Linux do CI mostrou
      `isAlive` ainda `true` no instante seguinte ao `SIGKILL`, sob carga — corrigido com o mesmo
      padrão de espera-e-reconfere que `waitForExit`/`waitForExitWindows` já usam). Integração
      (`tests/integration/cli/daemon-command.test.ts`): `runDaemonStop`/`runDaemonStatus` contra
      processo real e `ProcessControl` real — parada graciosa POSIX de verdade (marcador escrito,
      handler rodou), parada abrupta com plataforma forçada para `'win32'` **em qualquer host**
      (prova a seleção do ramo — nunca tenta gracioso no Windows — de forma portátil; a chamada de
      SO por baixo, `SIGKILL` vs. `TerminateProcess`, difere por host, mas a alegação sob teste —
      "abrupto, handler nunca roda, morte confirmada, lock limpo" — vale para as duas, e é isso que
      o teste prova), lock obsoleto limpo. E2e novo (`tests/e2e/daemon.test.ts`, item 8): segunda
      instância recusa; `--status` vê o mesmo lock real, vivo e depois morto; `--stop` sem forçar
      plataforma (o único teste do repositório que exercita o despacho real, não forçado); terceira
      instância sobe limpa — a prova direta do aceite "o lock não fica para trás".

      **Itens 6 e 7 do e2e continuam sem teste, e não é descuido — o motivo já registrado pela
      S4-T3/S4-T4 não mudou.** Item 6 precisa de um ponto de injeção de relógio no binário
      compilado, que não existe (`cli/index.ts` sempre monta `systemClock` real) — construir isso
      agora seria escopo além desta tarefa, e sem ele o teste exigiria minutos de relógio real por
      execução. Item 7 foi deixado agrupado com 6 e 8 de propósito pela S4-T3/S4-T4, para nascerem
      juntos como uma jornada "dia inteiro" coerente quando o 6 deixasse de estar bloqueado — isso
      não mudou aqui. Entregue o que ficou novo e possível: o item 8, agora provado ponta a ponta
      **com** `--stop`/`--status`, não uma peça isolada.

      **Cobertura:** medida via `npm run cobertura` (Windows) e dentro do container Linux
      (`npm run verificar:linux`) — `core/` 100% nas duas máquinas; `scheduler/` 98,4%
      statements/100% branches/93,33% funções/100% linhas (o único gap de função é `loop.ts`'s
      `sleepUntilNextPollOrStop` sendo uma função só, contada uma vez, sem nada a mais para cobrir);
      `adapters/process/` 91,61%/81,33%/93,02%/92,56% no Windows e 89,71%/81,35%/92,85%/90,38% no
      Linux — as duas acima do piso de 80% do `AGENTS.md` (precisou de um teste novo,
      `tests/unit/adapters/process/termination.test.ts`, mockando `process.kill` para exercitar o
      ramo de erro não-`ESRCH` de `terminateAbruptly`, que nenhum teste com processo real cobre por
      construção); `cli/` 95,25%/93,93%/95,45%/95,68% no Windows e 95,43%/94,27%/95,45%/95,87% no
      Linux. `npm run verificar` e `npm run verificar:linux` verdes, códigos de saída lidos
      separadamente do comando, nunca encadeados com commit — o segundo confirmado explicitamente
      por `; echo "EXITCODE=$?"` numa chamada própria, porque o texto final de resumo do `vitest`
      não sobreviveu à captura de saída do Docker neste ambiente (achado registrado, não um
      vermelho: a contagem de testes e a tabela de cobertura por diretório chegaram inteiras, só o
      bloco de resumo final some — o código de saída é a fonte de verdade de qualquer forma).

      Sete escolhas sem resposta literal no despacho da tarefa registradas em **Q-057**.

---

- [x] **S4-T6 — O daemon abre janelas de terminal na cara do usuário.** Saída do **primeiro
      ensaio real** (2026-09-06): daemon no ar, encerramento agendado para 14:30, sessões vivas de
      verdade. Disparou na hora, capturou as duas sessões e escreveu o `summary.md` — e revelou
      três defeitos que nenhum teste tinha como pegar.

      **Parte 1 — as janelas (o defeito grave).** O daemon roda **sem console** (D-005), e no
      Windows um programa de console lançado por quem não tem console **ganha uma janela nova**.
      Medido pelo mantenedor em uso real: a cada ciclo de 30s, uma janela **por sessão viva**
      (`adapters/process/proc-start.ts` chama `powershell.exe` via
      `adapters/process/spawn-stdout.ts` para cada `isAlive` com `procStart`), e **uma rajada no
      instante do encerramento** — um `claude` por sessão (`adapters/generation/spawn-claude.ts`) e
      um `git` por repositório (`adapters/git/run-git.ts`). A janela do modelo **fica visível pelo
      tempo inteiro da resposta** (~1 min no ensaio). Cada uma **rouba o foco do teclado e corta o
      que a pessoa está digitando**.

      Nunca apareceu em teste porque, rodando pelo terminal, o filho herda o console existente e
      não abre janela nenhuma. **Só o daemon sofre** — e o daemon é o modo normal de uso.

      `adapters/process/console-signal.ts` **já passa `windowsHide: true`** nos seus dois `spawn`;
      os outros quatro não. Nenhum dos quatro usa `detached`, então a opção se aplica limpa.

      *Aceite:* nenhuma janela aparece durante um ciclo de laço **nem durante um encerramento
      completo**, verificado com o daemon de verdade no Windows — não só com teste. O que os
      `spawn` devolvem (stdout, código de saída) não pode mudar.

      **Parte 2 — o aviso mente o tempo que falta.** `scheduler/notices.ts#buildLeadTimeNotice`
      escreve `closing in ${leadTimeMinutes} min`, que é o **nome da regra**, não o tempo restante.
      Medido: às 14:08, com encerramento às 14:30, o toast disse "closing in 30 min" — faltavam 22.
      Em operação normal os dois batem (o laço dispara dentro de 30s da marca); descola quando o
      daemon **sobe atrasado**, que é justamente quando a pessoa mais precisa do número certo. É a
      D-025 aplicada ao texto: dizer o que se sabe, não o rótulo mais próximo.

      *Aceite:* o texto informa o tempo real que falta, derivado de `effectiveEndOfDay` e do
      `Clock` (D-019), e a marca que disparou continua sendo registrada como disparada.

      **Parte 3 — `schemaVersion` não é chave desconhecida.** `seeya config get schemaVersion`
      responde `unknown config key "schemaVersion"`. Ela existe, é obrigatória, e é conferida em
      toda leitura — só não é editável. Chamar de desconhecida o que o próprio programa exige é
      afirmar o contrário do que se sabe.

      *Aceite:* a resposta distingue **chave inexistente** de **chave não editável**, e a segunda
      diz onde ela é usada. Vale para `get` e para `set`.

      **Implementado em 2026-09-06.** As três partes, separadas.

      **Parte 1 — `windowsHide: true` nos quatro `spawn` que faltavam.**
      `adapters/generation/spawn-claude.ts#spawnClaude`, `adapters/git/run-git.ts#runGit`,
      `adapters/process/spawn-stdout.ts#runForStdout` e
      `adapters/notification/backend.ts#spawnCommand` — exatamente os quatro que o texto desta
      entrada já apontava ("captura, evidência de git e notificação"). Não mexi nos outros três
      `spawn` sem a opção: `daemon-launch.ts#spawnDetachedDaemon` já usa `detached`+`stdio:'ignore'`
      (o próprio mecanismo do D-005 — não tem janela para esconder, o processo já nasce sem
      console); `termination-posix.ts` é POSIX-only por construção (S1-T12), `windowsHide` seria
      no-op sempre; `resumption/spawn-interactive.ts#runInteractive` usa `stdio: 'inherit'` de
      propósito (Spike H) — é o comando manual `seeya start-day`, com o console do usuário já
      presente, e esconder a janela ali esconderia a própria sessão interativa que o comando existe
      para abrir. Detalhe completo dos nove `spawn` e por que cada um ficou de um lado, em Q-059.

      **Não escrevi teste que aparenta provar esta parte — e essa ausência é a entrega, não uma
      lacuna (cuidado (a) do despacho).** O defeito só existe quando o processo pai não tem console
      (D-005); `vitest` sempre roda com console próprio, herdado pelo processo filho, então a MESMA
      suíte que teoricamente provaria "sem janela" não tem como reproduzir "com janela" para
      começo de conversa. Um `vi.mock('node:child_process')` provaria só que a chave está no objeto
      de opções, não que a janela some — e o projeto não usa `vi.mock` em lugar nenhum da suíte
      hoje (AGENTS.md: duplo é classe/objeto nomeado implementando a porta, não stub de módulo).
      Os testes de integração existentes contra processo real continuam verdes com a opção
      presente — provam que `stdout`/`stderr`/código de saída/erro não mudaram (cuidado (b)), não
      que a janela sumiu. Detalhe em `docs/TESTES.md`, entrada S4-T6.

      **MEDIDO PELO AGENTE: nenhuma regressão de contrato nos quatro `spawn`** — os testes de
      integração que já exercitavam processo real
      (`tests/integration/notification/spawn-command.test.ts`, `tests/integration/git/`,
      `tests/integration/generation/lean-generator.test.ts`,
      `tests/unit/adapters/process/proc-start.test.ts`) continuam verdes.
      **NÃO MEDIDO PELO AGENTE, e é o aceite real desta parte: nenhuma janela aparecendo com o
      daemon de verdade no Windows, durante um ciclo de laço e durante um encerramento completo.**
      Isto exige o mantenedor rodando o binário fora do terminal do agente — peço que ele confirme
      à mão antes de considerar esta parte fechada.

      **Parte 2 — o aviso agora reporta o tempo real, via `Clock`.**
      `core/schedule.ts#minutesRemaining(target, now)` — pura, dois `Date`, sem I/O — substitui o
      antigo "printa de volta o nome da regra configurada". `scheduler/poll.ts` calcula
      `minutesRemaining(decision.effectiveEndOfDay, now)` (o mesmo `now` já lido do `Clock`
      injetado, D-019) e passa o resultado para `buildLeadTimeNotice`, cuja assinatura mudou de
      `(leadTimeMinutes, day)` para `(minutesRemaining, day)`. **O que NÃO mudou (cuidado (e)):**
      `decideSchedule` continua decidindo QUANDO o aviso dispara e QUAL regra configurada disparou
      exatamente como antes; `firedLeadTimesInMinutes` continua gravando o valor configurado
      (`30`/`15`), nunca o tempo real. Só a frase mudou.

      Achado ao construir, registrado em Q-059 item 4 em vez de decidido: num atraso grande o
      bastante, a regra "de 30 min" pode disparar com menos tempo real do que a regra "de 15 min"
      teria dado se checada a tempo — a pessoa recebe o número certo agora, mas ainda associado ao
      nome da regra que dispara primeiro em ordem decrescente, não à mais próxima da realidade.
      Mudar essa ordem seria mudar o gatilho, o que o despacho pediu para eu não decidir sozinho.

      **Testes:** `tests/unit/core/schedule.test.ts` (`minutesRemaining`, incluindo o caso exato
      medido no ensaio real — 30 min configurados às 14:08, fim às 14:30, 22 min reais);
      `tests/unit/scheduler/notices.test.ts` (`buildLeadTimeNotice` renderiza o número recebido,
      singular/plural); `tests/unit/scheduler/poll.test.ts` — o teste que prova a composição e que
      **falha sem o conserto em `poll.ts`**: um poll às 19:10 com fim às 19:30 e
      `leadTimesInMinutes: [30, 15]` dispara a regra de 30 (é a próxima não disparada, em ordem
      decrescente) mas a notificação diz "20 min", nunca "30 min" — e `firedLeadTimesInMinutes`
      continua `[30]`.

      **Parte 3 — `schemaVersion` deixa de ser chamada de desconhecida.**
      `adapters/storage/config-schema.ts` ganhou `schemaVersionNotEditableMessage()`, função
      própria (não generalizei `unknownConfigKeyMessage` — `projectPolicy` continua no caminho
      antigo, fora do escopo desta tarefa). `cli/config-command.ts#runConfigGetCommand` responde
      `schemaVersion: 1` (o `CONFIG_SCHEMA_VERSION` do código, já que `schemaVersion` não é campo
      de `Config` — é removido antes de `configFileSchema` rodar, `resolveSchemaVersion`);
      `runConfigSetCommand` responde a mensagem nova, que nomeia a chave, diz que ela existe e é
      validada em toda leitura de `config.json` e de todo handoff, e nunca contém o texto que
      `unknownConfigKeyMessage` usa. Não a tornei editável (cuidado (f)). Testes:
      `tests/unit/adapters/storage/config-schema.test.ts`,
      `tests/unit/cli/config-command.test.ts` — nos dois sentidos (`get`/`set`), provando ausência
      do texto de "chave desconhecida".

      **Cobertura, medida separadamente nas duas máquinas** (`npm run cobertura` no Windows,
      `npm run verificar:linux` no container): 132 arquivos de teste, 1402 passaram + 3 pulados, as
      duas vezes. `core/` 100% nas duas; `scheduler/` 98,42% statements/100% branches/93,33%
      funções/100% linhas nas duas (idêntico — `loop.ts#sleepUntilNextPollOrStop`, função só,
      contada uma vez, é o único gap de função, já registrado na S4-T5); `adapters/storage/`
      94,88/88,06/98,5/95,21 no Windows e 93,7/86,93/95,52/94,02 no Linux; `cli/`
      95,28/94,01/95,45/95,71 no Windows e 95,47/94,35/95,45/95,9 no Linux — as duas acima do piso
      de 80%. `npm run verificar` e `npm run verificar:linux` verdes, códigos de saída lidos
      separadamente do comando (o container precisou de `; echo "EXITCODE=$?"` numa chamada à
      parte, mesma disciplina da S4-T5 — o processo rodou em segundo plano por passar de 120s, e o
      código de saída real foi conferido no arquivo de saída dedicado da própria ferramenta, não
      inferido do encadeamento).

      Cinco escolhas registradas em **Q-059**, nenhuma bloqueando o portão.

      **Verificado à mão pelo mantenedor em 2026-09-07, no Windows, com o daemon de verdade —
      a única prova que existe para a parte 1.** Ciclo de laço rodando desde ~09:06 e encerramento
      completo às 09:30 (~1 min de captura, `summary.md` escrito às 09:31): **nenhuma janela
      apareceu**, nem a piscada por sessão a cada 30s, nem a janela do modelo que antes ficava
      visível pelo tempo inteiro da resposta. A parte 2 tem evidência própria, também de uso real:
      às 09:06, com encerramento às 09:30, o toast disse `closing in 23 min` — no dia anterior, na
      mesma situação, teria dito `30 min`.

- [x] **S4-T7 — Notificação não pode virar ruído: histerese por tipo, e alertas precoces num
      aviso só.** Saída da **Q-059 item 4**, refinada pelo mantenedor em 2026-09-07.

      **Parte 1 — histerese por tipo de notificação.** Medido no uso real: o aviso prévio dispara
      **uma regra por volta do laço**, e as regras vencem por ordem, não por distância real ao fim
      do dia. Daemon subindo às 14:20 com encerramento às 14:30 e regras `[30, 15]` manda dois
      avisos com **30 segundos** de intervalo ("10 min" e depois "9 min").

      **A primeira proposta do PO — colapsar as regras vencidas — não cobria o caso, e o
      mantenedor achou o furo:** subindo às 14:14, a regra de 30 vence e dispara ("16 min"), e um
      minuto depois a regra de 15 dispara **legitimamente**, sem atraso nenhum. Colapsar vencidas
      não impede esse par. O que resolve os dois casos é medir **a distância entre avisos**, não o
      atraso da regra.

      **A regra:** um aviso não sai se **outro do mesmo tipo** saiu há menos de N minutos. O
      "mesmo tipo" é do mantenedor e é o que impede o efeito colateral grave: o resultado do
      encerramento ("2 sessions captured"), o aviso de encerramento perdido e os alertas precoces
      **nunca** podem ser calados por um aviso prévio recente — são classes diferentes, e o
      resultado é justamente o que não se pode perder.

      **Três definições, já decididas:** (a) o aviso engolido **não volta depois** — ele conta como
      dado e é marcado como disparado; entregar mais tarde só empurra o amontoado para frente, e o
      anterior já disse "vai encerrar logo" com o tempo real (S4-T6); (b) guardar **um carimbo de
      hora por tipo** no estado do dia, que já vai para o disco e já reseta na virada — **não** uma
      fila de entregas pendentes; (c) o número é **config com padrão de 3 minutos** (D-035:
      depende de quanto ruído a pessoa tolera, não de fato técnico).

      **Não mude quando as regras vencem.** `core/schedule.ts#decideSchedule` e
      `firedLeadTimesInMinutes` ficam como estão — isto decide se o aviso **sai**, não quando a
      regra vence.

      *Aceite:* daemon subindo atrasado manda **um** aviso, não dois; o primeiro aviso do dia nunca
      é engolido; e um encerramento que termina logo depois de um aviso prévio **continua
      notificando**.

      **Parte 2 — alertas precoces viram um aviso só.** `scheduler/poll.ts` hoje faz
      `for (const warning of warnings) notify(...)`: um toast por achado, em sequência, no mesmo
      ciclo. Histerese não serve aqui — calar alerta é **perder informação**. O certo é **juntar
      num aviso só**, dizendo quantos são e o suficiente para a pessoa agir, sem inventar o que não
      se sabe (D-025) e sem estourar o que o toast mostra.

      *Aceite:* N alertas no mesmo ciclo produzem **uma** notificação que declara os N; nenhum
      achado desaparece do texto sem estar contado.

      **Acréscimo à tarefa, aprovado pelo mantenedor em 2026-09-07, mesma área — Parte 3: prazo
      novo devolve os avisos daquele prazo.** `core/schedule.ts#findDueLeadTime` pula regras em
      `DayState.firedLeadTimesInMinutes`, que guardava só o número da regra, nunca o prazo a que
      ela se referia — um `snooze` ou uma mudança de `endOfDayTime` que move o prazo efetivo
      deixava a regra antiga marcada disparada para sempre, e a captura seguinte acontecia sem
      aviso nenhum. **A regra: "o aviso não é sobre a regra, é sobre o prazo. Prazo novo, aviso
      novo."** *Aceite:* depois de um `snooze` (ou de uma mudança de `endOfDayTime`), as regras
      voltam a poder disparar para o **novo** prazo; um prazo que não mudou não redispara nada.

      **Relatório (dev).**

      **Medido, contra o commit final (depois de dois refactors de tamanho de função — ver
      abaixo):** 133 arquivos de teste, 1424 testes passaram + 3 pulados (1427), `npm run
      verificar` verde (`format:check`, `tsc --noEmit`, `lint`, `dependencias` — 149 módulos/450
      dependências sem violação —, `build`, `cobertura`), medido nas duas máquinas separadamente
      (`npm run cobertura` no Windows, `npm run verificar:linux` no container
      `node:22-bookworm`), as duas rodando em segundo plano por passar de 120s, código de saída
      lido do arquivo de saída dedicado, nunca do encadeamento (mesma disciplina da S4-T5/S4-T6).
      Cobertura, Windows: geral 97,04%/92,77%/98,19%/97,28% (statements/branches/funcs/lines);
      `core/` 100/99,08/100/100 (piso 95%); `scheduler/` 98,54/100/93,93/100 (piso 80% — o único
      gap de função é `loop.ts#sleepUntilNextPollOrStop`, já registrado desde a S4-T5, não tocado
      aqui); `adapters/storage/` 94,53/88,23/98,52/94,86 (piso 80%; `config-schema.ts` sozinho
      fica em 85,48% — o switch de `applyConfigFieldUpdate` tem 13 ramos quase idênticos e só um
      é exercitado por teste desde antes desta tarefa, `leadTimeHysteresisMinutes` só herdou o
      mesmo padrão, não é regressão nova); `cli/` 95,28/94,01/95,45/95,71 (piso 80%). Cobertura,
      Linux (mesmo commit, `npm run verificar:linux`): geral 96,98%/92,83%/97,99%/97,19%; `core/`
      100/99,08/100/100 (idêntico ao Windows); `scheduler/` 98,54/100/93,93/100 (idêntico);
      `adapters/storage/` 93,35/87,16/95,58/93,67 (piso 80%, alguns pontos abaixo do Windows — a
      mesma faixa de diferença que a S4-T6 já registrou entre as duas máquinas, nunca diferença de
      comportamento); `cli/` 95,47/94,35/95,45/95,9 (piso 80%). As duas rodadas: 133 arquivos de
      teste, 1424 testes passaram + 3 pulados (1427), idêntico nas duas máquinas.

      **Dois refactors de limpeza, sem mudança de comportamento (cobertos pela suíte já
      existente):** `core/schedule.ts#decideAgainstDeadline` e `scheduler/poll.ts#pollOnce`
      passaram do piso de ~20 linhas (AGENTS.md § "Estilo de código") ao ganhar a parte 3/parte 1
      respectivamente — `decideLeadTimeOrWait` e `handleLeadTimeWarning` foram extraídas do mesmo
      jeito que `decideAgainstDeadline`/`runEndOfDay` já tinham sido extraídas antes, mesma razão.

      As três partes, mais o achado de reuso, medidos com testes que reproduzem os casos reais
      citados no despacho: o `daemon subindo atrasado às 14:20 com [30,15]` da parte 1
      (`tests/unit/scheduler/poll.test.ts`, "one notice, not two"); o `snooze de 14:30 para 18:00`
      da parte 3 (`tests/unit/core/schedule.test.ts`, "the measured bug: a snooze that moves the
      deadline..."); e a interação das duas, pedida explicitamente no cuidado (b) da parte 3
      (`tests/unit/scheduler/poll.test.ts`, "S4-T7 Part 1 + Part 3 interaction") — um `snooze`
      dado 15 segundos depois do primeiro aviso reabre a regra para o novo prazo mas NÃO gera um
      segundo aviso imediato, porque as duas partes vivem em campos independentes de `DayState` e
      a histerese (parte 1) nunca lê o carimbo de prazo (parte 3).

      **Inferido:** que o comportamento acima é exatamente o que o mantenedor vai observar rodando
      o daemon de verdade amanhã — não posso confirmar isso a partir daqui, só a lógica isolada.
      Também inferido: que `MAX_EARLY_WARNINGS_LISTED = 5` (parte 2, escolhido não medido, mesmo
      espírito do precedente de `UNDERSTANDING_EXCERPT_CHARS`) é um tamanho razoável para o corpo
      de um toast — não tenho como medir altura real de toast a partir daqui.

      **O que o mantenedor precisa ver à mão:** rodando o daemon de verdade, confirmar que **não
      aparecem mais dois avisos prévios em sequência rápida** (o "amontoado" original) e que um
      `seeya snooze` dado perto do fim ainda entrega o aviso seguinte, sem rajada — os dois só se
      provam com o relógio real e o SO real, do jeito que a S4-T6 já registrou para a supressão de
      janela de console.

      **Decisões registradas em Q-060:** a representação do "tipo" (campo dedicado
      `lastLeadTimeWarningNoticeAt` em `DayState`, não um campo genérico em `Notice` nem uma
      chave solta — cuidado (a)); onde mora a decisão pura (`core/lead-time-hysteresis.ts`, novo
      módulo, para não misturar com `decideSchedule`/`findDueLeadTime`, que ficam intocados —
      cuidado (b) e (d) das duas partes); os dois campos novos em `DayState`/`estado.json` sem
      migração, ausência lida como "nunca disparou"/"sem evidência de mudança de prazo" (D-025 —
      cuidado (d)/(e)); o desenho de `resolveFiredLeadTimes` e a alternativa descartada (forçar
      reset quando o carimbo de prazo é desconhecido, rejeitada por poder redisparar avisos já
      corretos contra o `estado.json` real do mantenedor); e os três nomes novos no glossário de
      `AGENTS.md` (`leadTimeHysteresisMinutes`, `lastLeadTimeWarningNoticeAt`,
      `firedLeadTimesEffectiveEndOfDay`).

- [x] **S4-T8 — A leva pequena: três mensagens que falam do mecanismo em vez de falar com a
      pessoa.** Todas saíram de uso real nos dias 06 e 07/09/2026, nenhuma de teste. Nenhuma muda
      comportamento — só o que o programa diz. A S4-T7 já aterrissou, então
      `config-schema.ts` está livre; roda em paralelo com a **S4-T9**, que não toca nenhum arquivo
      desta (conferido: uma mexe em mensagens de `cli/`+`config-schema.ts`, a outra nos `spawn` de
      `adapters/`).

      **1 — Zero à esquerda na hora.** `seeya config set endOfDayTime 9:30` é recusado pelo regex
      de `adapters/storage/config-schema.ts`. O mantenedor: *"eu não errei digitando uma letra ou
      algo inválido de verdade, 09 e 9 é basicamente a mesma coisa"*. Aceitar hora de um dígito e
      **normalizar na gravação** (`9:30` → `09:30` no arquivo), mantendo o minuto com dois dígitos
      — `9:5` ninguém escreve, e ali a ambiguidade seria real. O que fica no disco continua num
      formato só. E a mensagem de valor inválido de verdade deve trazer **exemplo**, sem o `✖` que
      hoje vaza a formatação da biblioteca de validação para a tela.

      **2 — `seeya daemon --stop` explica o mecanismo em vez de responder a pergunta.** Hoje
      devolve um parágrafo sobre por que o Windows não permite parada graciosa. Quem digitou
      `--stop` quer saber **"parou mesmo, e eu perdi alguma coisa?"** — e a resposta é "sim, parou"
      e "não perdeu nada", porque o daemon grava o estado a cada volta do laço. A explicação
      técnica fica no código, onde já mora.

      **3 — `projectPolicy` também é chamada de chave desconhecida.** Mesmo defeito que a S4-T6
      corrigiu para `schemaVersion`, e sobrou: a mensagem diz `unknown config key "projectPolicy"`
      e, na mesma frase, ensina a usar `seeya config policy <cwd>`. Dizer que não conhece e
      explicar como usar, no mesmo texto, é o programa se contradizendo.

      *Aceite:* as três falam com quem digitou. Nenhum comportamento muda; o valor gravado por (1)
      é sempre o canônico.

      **Implementado em 2026-09-07.**

      **Item 1.** `adapters/storage/config-schema.ts#configFileSchema.endOfDayTime` — regex
      `^([01]?\d|2[0-3]):[0-5]\d$` (hora de um ou dois dígitos; minuto sempre dois, sem afrouxar:
      `25:00`, `9:75`, `9:5`, `abc`, vazio continuam recusados) seguido de `.transform(normalizeEndOfDayTime)`.
      A normalização mora no SCHEMA, não no comando — `parseConfigFieldUpdate` (`seeya config set`)
      já reusa `configFileSchema.shape.endOfDayTime` diretamente, então colocá-la ali faz leitura de
      disco e escrita via CLI convergirem para o mesmo canônico num lugar só (justificativa completa
      em Q-061 item 1). Mensagem nova, com exemplo:
      `expected 24h local time "HH:MM" (e.g. "09:30" or "9:30")`. O `✖` saiu de
      `parseConfigFieldUpdate` inteiro (todo campo, não só a hora — Q-061 item 2), trocando
      `z.prettifyError` por `result.error.issues.map(i => i.message).join('; ')`.

      **Antes:** `seeya config set endOfDayTime 9:30` → `seeya config set: invalid value "9:30" for
      "endOfDayTime": ✖ expected 24h local time "HH:MM"`.
      **Depois:** `seeya config set endOfDayTime 9:30` → `endOfDayTime set to 09:30.` (grava
      `"09:30"` em `config.json`). Um valor de verdade inválido agora diz, por exemplo:
      `seeya config set: invalid value "9:75" for "endOfDayTime": expected 24h local time "HH:MM"
      (e.g. "09:30" or "9:30")` — sem `✖`.

      **Item 2.** `cli/daemon-command.ts#runDaemonStop`. Conferido em `scheduler/loop.ts#runDaemon`
      e `scheduler/poll.ts#pollOnce` (não só repetido do despacho, Q-061 item 3): cada poll lê
      `Config`/`DayState` do zero e persiste qualquer decisão antes de retornar — nada fica só em
      memória entre duas voltas do laço. Uma parada que caia NO MEIO de um poll em andamento (fim de
      dia em curso, `GRACEFUL_STOP_DEADLINE_MS` de 15s estourado ou o caminho sempre-abrupto do
      Windows) não corrompe nada, mas aquela tentativa específica não é contada e é retentada do
      zero pelo próximo daemon — registrado honestamente no comentário do código, não escondido.
      `WINDOWS_ABRUPT_REASON` (a explicação de por que o Windows não tem parada graciosa) deixou de
      ser impressa na tela; o texto inteiro continua como comentário, agora colado ao branch
      `platform === 'win32'` de `runDaemonStop` (cuidado (d): a informação mudou de lugar, não
      sumiu).

      **Antes (Windows/forçado):** `Stopped the daemon (pid 4242) — stopped abruptly: Windows has
      no way to ask a console-less, detached process (D-005) to shut down on its own, and a
      cross-process signal there terminates immediately without running its own shutdown code.`
      **Depois (Windows/forçado):** `Stopped the daemon (pid 4242) forcibly. Nothing was lost: it
      saves its state after every poll cycle, so the next "seeya daemon" picks up exactly where
      this one left off.`
      **Antes (POSIX gracioso):** `Stopped the daemon (pid 4242) gracefully.`
      **Depois (POSIX gracioso):** `Stopped the daemon (pid 4242) gracefully. Nothing was lost: it
      saves its state after every poll cycle, so the next "seeya daemon" picks up exactly where
      this one left off.`

      **Item 3.** `projectPolicyNotEditableMessage()` nova em `adapters/storage/config-schema.ts`,
      mesmo padrão de `schemaVersionNotEditableMessage` (S4-T6/Q-059 item 5) — função dedicada, não
      generalização de `unknownConfigKeyMessage`. Interceptada em
      `cli/config-command.ts#runConfigSetCommand`, antes de `parseConfigFieldUpdate`, no mesmo lugar
      e ordem da checagem de `schemaVersion`. `seeya config get projectPolicy` já funcionava antes
      desta tarefa; o defeito era só em `set` (Q-061 item 5). `projectPolicy` **não** virou editável
      por `config set` — continua fora de `EDITABLE_CONFIG_KEYS`, só com comando próprio.

      **Antes:** `seeya config set projectPolicy '{}'` → `seeya config set: unknown config key
      "projectPolicy". Expected one of: ... (for "projectPolicy", use "seeya config policy <cwd>"
      instead).`
      **Depois:** `seeya config set projectPolicy '{}'` → `seeya config set: "projectPolicy"
      exists, but "seeya config set" cannot write it — it is keyed by project (cwd), not a single
      scalar value, so it has its own sub-action: "seeya config policy <cwd>" to set it, or "seeya
      config get projectPolicy" to read it.`

      **Cuidado (f):** nenhuma asserção existente foi apagada para a suíte passar. O único teste
      que mudou de SENTIDO (não só de texto) foi o caso `endOfDayTime` de um dígito no `it.each` de
      valores inválidos de `config-schema.test.ts` — deixou de ser inválido por definição da própria
      tarefa, então foi trocado por dois casos que continuam genuinamente inválidos (minuto de um
      dígito, hora fora do intervalo). Os textos de `runDaemonStop` que os testes fixavam foram
      atualizados com asserções adicionais provando a ausência do mecanismo na tela
      (`not.toContain('Windows')`/`not.toContain('console')`), não só a presença do texto novo.
      Um teste de unidade planejado para o caminho de parada forçada foi descartado a tempo (Q-061
      item 7): `finishAbruptStop` chama `terminateAbruptly` direto, fora de `DaemonControlDeps`, e
      um PID inventado mandaria um sinal real de morte de processo na máquina do teste — o caminho
      já é coberto com segurança em `tests/integration/cli/daemon-command.test.ts`, contra um
      processo fixture real.

      **Cobertura e portão:** `npm run verificar` (Windows) — 133 arquivos de teste, 1434 passaram
      (3 skipped), `core/` 100%, `adapters/storage` 94,98% linhas / 87,43% branches, `cli` 95,73%
      linhas / 94,05% branches (piso de 80% por diretório respeitado, números batem os do S4-T7).
      `npm run verificar:linux` — mesmos 133 arquivos, 1434 passaram (3 skipped), `adapters/storage`
      94,98% linhas / 87,43% branches, `cli` 95,91% linhas / 94,38% branches (pequena variação de
      cobertura entre plataformas, já vista em tarefas anteriores, sem cair abaixo do piso nos
      dois). Os dois códigos de saída lidos separadamente do `tail`, nunca encadeados com o commit.
      Detalhes completos, incluindo os cuidados (a)-(f) um a um, em `docs/QUESTOES.md` **Q-061**.

- [x] **S4-T9 — Um `spawn` só, invisível por padrão, com a exceção declarada (D-038).** Fecha a
      **Q-059 item 3**, decidida pelo mantenedor em 2026-09-07. Roda em paralelo com a **S4-T8** — a
      sequência que este plano afirmava antes estava errada: conferido arquivo a arquivo, as duas
      não se cruzam.

      Refatoração, **não conserto**: o comportamento de hoje já está certo desde a S4-T6 (verificada
      à mão, nenhuma janela apareceu). O que falta é impedir que volte a estar errado.

      Um `spawn` interno do projeto que **sempre** passa `windowsHide: true`, aceitando as opções
      que variam entre os call sites (`stdio` completo, `ignore` parcial, `AbortSignal.timeout`,
      herança de `env`). Os seis `spawn` que hoje escondem passam por ele. Os três que não escondem
      **declaram por quê no próprio call site**: `daemon-launch.ts` (`detached`, console nenhum —
      mecanismo diferente, mesmo resultado), `termination-posix.ts` (POSIX, a opção é no-op) e
      `resumption/spawn-interactive.ts` (**a exceção da D-038**: a janela é o produto).

      **A guarda é a entrega, não o embrulho.** Importar `spawn` de `node:child_process` direto vira
      erro de lint fora do embrulho e das exceções declaradas — mesma técnica que já banisce
      `new Date()` fora de `adapters/clock/` (D-019). Sem isso, a próxima pessoa esquece de novo, que
      é exatamente o que já aconteceu uma vez.

      *Aceite:* nenhum comportamento muda (os testes de integração contra processo real continuam
      verdes, sem alteração de stdout, código de saída ou erro); um `spawn` novo escrito fora do
      embrulho **falha no portão**; e o `start-day` interativo continua abrindo a janela de verdade
      — verificado à mão, porque é o único jeito.

      **Implementado em 2026-09-07.** `src/adapters/process/spawn.ts#spawnHidden`: passa-adiante
      fino para `node:child_process.spawn`, forçando `windowsHide: true` por cima de qualquer opção
      recebida (spread de `options` primeiro, override depois — nenhum call site consegue
      reativar a visibilidade por acidente). A assinatura replica os overloads que o próprio
      `spawn(command, args, options)` do Node declara (`stdio` em tripla, sem `stdio`, e o geral),
      em vez de um `SpawnOptions` genérico — decisão registrada em Q-062 item 2: um tipo genérico
      teria forçado quatro dos seis call sites a ganhar checagem de nulo em `child.stdout`/
      `child.stderr` que não tinham antes, exatamente o "forçar assinatura pobre" que o cuidado (d)
      do despacho pediu para evitar.

      Os seis `spawn` que já escondiam a janela passam a importar `spawnHidden` de
      `adapters/process/spawn.ts`: `adapters/generation/spawn-claude.ts`, `adapters/git/run-git.ts`,
      `adapters/process/spawn-stdout.ts`, as duas chamadas de `adapters/process/console-signal.ts`
      e `adapters/notification/backend.ts`. Nenhuma lógica de leitura de stream mudou — só a linha
      de import e a chamada `spawn(...)` → `spawnHidden(...)`, com o comentário de medição da S4-T6
      preservado (AGENTS.md § "Comentários") e reescrito só na frase final ("esta opção esconde a
      janela" → "o embrulho força esta opção agora"). As três exceções mantêm o import direto de
      `node:child_process`, cada uma com um comentário novo no próprio `import`, não só no
      comentário de módulo já existente, citando D-038 e o motivo: `daemon-launch.ts` (`detached`+
      `stdio:'ignore'` já é console nenhum, nada para o wrapper esconder), `termination-posix.ts`
      (POSIX-only, `windowsHide` seria no-op) e `resumption/spawn-interactive.ts` (a própria exceção
      da D-038 — `stdio: 'inherit'`, a janela é o produto).

      **A guarda.** `eslint.config.js` ganhou um bloco `no-restricted-imports` (`paths`,
      `importNames: ['spawn']`) escopado a `src/**/*.ts`, com `ignores` listando os quatro arquivos
      pelo caminho exato (o embrulho + as três exceções) e, **também**, `src/core/**/*.ts` — essa
      última exclusão não é sobra, é necessária: `core/` já não pode importar NENHUM `node:*` (bloco
      já existente), e como o flat config do ESLint resolve regras por "o último config que casa o
      arquivo vence" (sem merge), um bloco novo cujo `files` é superset de `src/core/**/*.ts` e que
      declarasse a MESMA chave de regra (`no-restricted-imports`) SEM excluir `core/` teria
      silenciosamente SUBSTITUÍDO a proibição ampla por uma que só bane `spawn` — testado na prática
      (Q-062 item 1): sem a exclusão, o teste de guarda já existente "rejects node:* imported in
      src/core/" fica vermelho. Com a exclusão, os dois blocos coexistem sem conflito, e confirmei
      manualmente rodando eslint contra um fixture `node:fs` em `src/core/` (continua rejeitado) e
      contra um `spawn` em `src/adapters/generation/` (rejeitado, mensagem cita `spawnHidden`/D-038).

      **Onde o embrulho mora, conferido contra a matriz antes de escrever (cuidado (e)).**
      `adapters/process/` — os três chamadores que precisam dele (`adapters/generation`,
      `adapters/git`, `adapters/notification`) são adapters diferentes importando de outro adapter.
      A tabela de `docs/ARQUITETURA.md` marca a diagonal `adapters` → `adapters` como "—" (fora dos
      20 pares ordenados, não um dos proibidos) e `.dependency-cruiser.cjs` não tem regra
      `adapters-does-not-import-adapters` — só `adapters-does-not-import-application-cli-or-scheduler`.
      Confirmado contra o portão real, não só a leitura da tabela: `depcruise src` aprovou os seis
      imports novos sem violação (151 módulos/452 dependências). Detalhe completo em Q-062 item 1.

      **Testes.** `tests/integration/guards/eslint-restrictions.test.ts` ganhou um describe novo
      com seis casos (rejeita `spawn` comum e com alias — `importNames` casa o nome original
      exportado, não o alias local; aprova `spawnHidden` importado em outro lugar; aprova os quatro
      arquivos reais da exceção, apontando eslint para o CAMINHO REAL de cada um, porque a exclusão
      é por arquivo exato, não por diretório — uma fixture em `_guard-eslint/` nunca poderia provar
      a isenção). Nenhum teste de comportamento novo nos seis call sites: continuam cobertos pelos
      MESMOS testes de integração contra processo real de antes (Q-059 item 1), rodados antes e
      depois da troca sem alteração de asserção. Detalhe em `docs/TESTES.md`, entrada S4-T9.

      **MEDIDO PELO AGENTE.** `npm run verificar` verde (`format:check`, `tsc --noEmit`, `lint`,
      `dependencias` — 151 módulos/452 dependências sem violação —, `build`, `cobertura`): 133
      arquivos de teste, 1429 passaram + 3 pulados (1432). Cobertura geral 97,04/92,77/98,19/97,28
      (statements/branches/funcs/lines); `core/` 100/99,08/100/100 (piso 95%); `scheduler/`
      98,54/100/93,93/100 (piso 80%, mesmo gap de função já registrado desde a S4-T5,
      `loop.ts#sleepUntilNextPollOrStop`, não tocado aqui); `adapters/process/` 91,66/81,57/93,18/
      92,61 (piso 80% — os seis call sites tocados ficam dentro do rollup do diretório; nenhum
      arquivo individual precisa bater 80% sozinho, só o diretório); `adapters/generation/`
      96,12/93,33/100/96,06; `adapters/git/` 98,02/83,6/100/97,97; `adapters/notification/`
      100/93,47/100/100; `adapters/storage/` 94,53/88,23/98,52/94,86; `adapters/resumption/`
      98,36/91,3/100/98,36; `cli/` 95,28/94,01/95,45/95,71 — todos acima do piso de 80%.
      `npm run dependencias`: 151 módulos, 452 dependências, zero violações (os seis imports
      adapter-para-adapter novos incluídos). Guarda de lint provada na prática, três vezes: (1)
      fixture com `spawn` de `node:child_process` em `src/adapters/generation/` → eslint reprova
      com a mensagem citando `spawnHidden`/D-038 (exit 1); (2) fixture equivalente em
      `src/core/` com `node:fs` → continua reprovando com a mensagem original de `core/` (exit 1,
      prova que a nova regra não substituiu a antiga); (3) suíte de guarda automatizada
      (`eslint-restrictions.test.ts`), 14 testes no arquivo (8 pré-existentes + 6 novos), todos
      verdes.

      **NÃO MEDIDO PELO AGENTE, e é o único ponto que o mantenedor precisa conferir à mão: que o
      `seeya start-day` interativo continua abrindo a janela de verdade.** Nada mudou em
      `resumption/spawn-interactive.ts` além de um comentário — continua importando `spawn`
      diretamente de `node:child_process` com `stdio: 'inherit'`, exatamente como antes desta
      tarefa — e os testes de integração/unidade desse arquivo continuam verdes sem alteração. Mas
      "a janela ainda abre" é, pela própria natureza do defeito que a S4-T6 documentou, algo que
      nenhuma suíte automatizada consegue provar (o processo de teste sempre tem console próprio).
      A S4-T6 já teve esse ponto confirmado à mão pelo mantenedor uma vez; esta tarefa não muda
      código nesse call site além do comentário, então o risco de regressão é baixo, mas o pedido
      do despacho foi explícito nesse ponto e eu não tenho como verificar sozinho.

      **Cobertura e portão, medidos separadamente nas duas máquinas** (`npm run verificar` no
      Windows, `npm run verificar:linux` no container `node:22-bookworm`, ambos em segundo plano
      por passarem de 120s, código de saída lido do arquivo de saída dedicado — mesma disciplina
      da S4-T5/S4-T6/S4-T7). Linux (mesmo commit `5a5381d`): `npm run verificar:linux` verde de
      ponta a ponta (exit 0) — `format:check`, `tsc --noEmit`, `lint`, `dependencias`, `build`,
      `cobertura`, dentro do container. 133 arquivos de teste, 1429 passaram + 3 pulados (1432) —
      idêntico ao Windows. Cobertura geral 96,99/92,84/98/97,19 (statements/branches/funcs/lines,
      levemente diferente do Windows por linha específica, mesma faixa de diferença que a S4-T6/
      S4-T7 já registraram entre as duas máquinas); `core/` 100/99,08/100/100 (piso 95%,
      idêntico); `scheduler/` 98,54/100/93,93/100 (piso 80%, idêntico); `adapters/process/`
      89,81/81,66/93,1/90,47 (piso 80%; `spawn.ts`, o embrulho novo, 100/100/100/100 sozinho);
      `adapters/git/` 98,02/83,6/100/97,97; `adapters/notification/` 100/93,47/100/100;
      `adapters/storage/` 93,35/87,16/95,58/93,67; `adapters/resumption/` 98,36/91,3/100/98,36;
      `cli/` 95,47/94,35/95,45/95,9 — todos acima do piso de 80%. `dependencias`: mesmo resultado
      do Windows, zero violações. Suíte de guarda (`eslint-restrictions.test.ts`, incluindo os
      seis testes novos de D-038) verde no container.

- [x] **S4-T10 — O portão fica vermelho sem defeito nenhum: prazo fixo contra operação de custo
      variável.** Bloqueia a publicação da **S4-T9**, que está mesclada e **não publicada** por
      causa disto.

      **Medido em 2026-09-08, quatro rodadas.** `npm run verificar` falha com 2 a 3 testes
      estourando tempo — **sempre** os que lançam processo de verdade (`powershell.exe`, anexar
      console), e **o conjunto muda a cada rodada**. `terminateGracefully (Windows:
      CTRL_BREAK_EVENT via console attach)` falhou em todas.

      **Não é a S4-T9, e isto foi isolado, não suposto:** o portão foi rodado **no commit anterior
      a ela** (`8a6d71e`) e falhou igual, com três testes. Esse mesmo commit passou **verde ontem,
      nesta máquina**, duas vezes. **Não é carga do conjunto inteiro:** rodando só os dois arquivos
      que falharam, passam; rodando **só o projeto `integration`**, falham três — a contenção está
      dentro dele.

      **A causa provável, e ela está escrita como afirmação no `vitest.config.ts`.** O projeto
      `integration` declara que "não disputa nenhum recurso, então mantém o paralelismo padrão".
      Isso é falso para os testes de processo: eles disputam a capacidade do sistema de **lançar
      processos**, cujo custo o próprio projeto mediu como variável (500-880ms por `powershell.exe`,
      **quente** — `adapters/process/proc-start.ts`). Os prazos são fixos (5s e 8s). Ontem coube;
      hoje, com a máquina reiniciada, não cabe.

      *Aceite:* **o portão passa cinco vezes seguidas** nesta máquina. A correção não pode ser
      apenas aumentar prazo — prazo generoso demais deixa de pegar travamento de verdade, que é
      exatamente o que esses testes existem para pegar. Medir antes e depois, e dizer o custo em
      tempo total do conjunto.

      **Implementado em 2026-09-08.** Reproduzido antes de mexer em qualquer arquivo: contagem de
      processos node primeiro (`docs/TESTES.md` § "Suíte lenta ou instável"), **1** processo vivo
      nesta máquina — não é o caso das centenas acumuladas que aquela seção cobre, então a causa
      tinha que ser outra, e era a que a entrada da tarefa já apontava. Rodei `npm run verificar`
      uma vez no estado herdado (commit `da2ebfc`, antes de qualquer edição minha) para ter um
      "antes" medido, não só citado: **vermelho**, 128s de parede (`date` antes/depois), 3 arquivos
      falharam por timeout — `cli/composition.test.ts`, `cli/daemon-command.test.ts` (2 casos) e
      `process/termination.test.ts`. **`composition.test.ts` não estava na lista de "testes
      envolvidos" do despacho** (que citava só `termination`, `liveness`, `daemon-command`, `lock`),
      mas grepar por `captureObservedProcStart(` em `tests/` mostra que ele chama a mesma função
      real (`buildCliContext`'s teste "the real ProcessControl reports this test process itself as
      alive") — e foi exatamente esse o que estourou no meu "antes". Cinco arquivos, não quatro;
      registrado em **Q-063** e incluído na correção, porque a evidência (o próprio log de falha)
      é mais forte que a lista original.

      **A correção: separar os cinco num projeto vitest novo, serializado só entre eles.** Novo
      projeto `integration-process` (`vitest.config.ts`) com `include` explícito dos cinco arquivos
      e `fileParallelism: false` — só dentro dele, não no resto de `integration`. Os outros 36
      arquivos de `integration/` (isolados por tmpdir, nunca lançam processo real) continuam com o
      paralelismo padrão de sempre. O comentário falso no `integration` ("não disputa nenhum
      recurso") foi reescrito para dizer a verdade parcial que era: verdade para 37 de 42 arquivos,
      falsa para estes cinco.

      **Por que não foi só alargar o prazo (cuidado a do despacho).** Os prazos de
      `terminateGracefully` (5s Windows-console, 2s sem console) já carregam o orçamento interno da
      operação **mais** 3s de folga (comentário original de `termination.test.ts`, preservado) — se
      o processo alvo nunca reagir ao `CTRL_BREAK_EVENT` (travamento real, não custo de lançar
      `powershell.exe`), o teste ainda estoura essa folga e falha, porque a folga continua fixa e
      pequena. Alargar esses 5s/8s para "caber" a contenção também alargaria a folga sobre
      travamento real — exatamente a perda que o despacho pediu para evitar. A correção não tocou
      nenhum desses números.

      **Por que serializar só estes cinco, e não `integration` inteiro (cuidado c).** A
      `S1-T0` já registrou, no próprio `vitest.config.ts`, por que `fileParallelism: false` foi
      recusado em `guards/`: lá a serialização teria **escondido** uma corrida real em estado
      mutável compartilhado — o bug era a corrida, e paralelismo é o que a expõe. Aqui a disputa é
      por um recurso real e medido (capacidade do SO de lançar processo, 500-880ms por
      `powershell.exe` **quente**, `adapters/process/proc-start.ts`), não um artefato de fixture
      compartilhada — serializar estes cinco **remove** a disputa em vez de escondê-la. Medido, não
      só argumentado: rodando só os cinco isolados do resto da suíte, em paralelo entre si (sem
      `fileParallelism: false`, via `--fileParallelism` explícito), os cinco passam em 11,0s — a
      disputa entre eles sozinhos, sem o resto da suíte rodando junto, não é suficiente para
      estourar o prazo. É a carga do conjunto inteiro (os outros ~128 arquivos de teste competindo
      pelas 8 CPUs desta máquina ao mesmo tempo) que empurra o lançamento do `powershell.exe` para
      fora do orçamento — serializar estes cinco tira o pior caso (dois ou três lançamentos
      pesados simultâneos) sem impor custo algum aos 36 arquivos irmãos, que nunca tocam
      `powershell.exe`.

      **Custo medido da serialização:** os cinco arquivos, sozinhos, em série
      (`fileParallelism: false`, como ficou): 25,5s. Os mesmos cinco, sozinhos, em paralelo entre
      si: 11,0s. A diferença (~14,5s de trabalho que passou a ser sequencial) fica **dentro** da
      janela em que os outros 128 arquivos de `unit`/`integration`/`guards` já estão rodando em
      paralelismo pleno — não é um acréscimo que se soma ao tempo total da suíte, é trabalho que se
      sobrepõe a um tempo que já ia ser gasto de qualquer forma. Confirmado pelo número que importa,
      o tempo de parede da suíte inteira: **antes** (vermelho, uma medição) 128s; **depois** (verde,
      cinco medições) 126s/140s/129s/130s/131s, média 131s — mesma ordem de grandeza, sem regressão
      perceptível.

      **Aceite, medido cinco vezes seguidas nesta máquina, `npm run verificar`:**

      ```
      rodada 1: EXITCODE:0, 07:29:02–07:31:08 (126s), 133 arquivos, 1440 passaram, 3 pulados
      rodada 2: EXITCODE:0, 07:31:18–07:33:38 (140s), 133 arquivos, 1440 passaram, 3 pulados
      rodada 3: EXITCODE:0, 07:33:42–07:35:51 (129s), 133 arquivos, 1440 passaram, 3 pulados
      rodada 4: EXITCODE:0, 07:35:55–07:38:05 (130s), 133 arquivos, 1440 passaram, 3 pulados
      rodada 5: EXITCODE:0, 07:38:09–07:40:20 (131s), 133 arquivos, 1440 passaram, 3 pulados
      ```

      Cobertura (rodada 1, representativa — as cinco não divergem de forma relevante): geral
      97,05/92,65/98,2/97,29 (statements/branches/funcs/lines); `core/` 100%; `adapters/process/`
      dentro do piso de 80% (os cinco arquivos movidos continuam contando para o mesmo diretório,
      só mudou o projeto vitest que os roda, não o `include` de cobertura). `npm run verificar:linux`
      verde (container `node:22-bookworm`) — nesta plataforma os cinco arquivos não lançam
      `powershell.exe` (é Windows-only), então a disputa que motivou esta tarefa nunca existiu ali;
      a separação de projeto é inofensiva lá, só reduz paralelismo de 5 arquivos que já eram
      baratos nesse SO.

      **`docs/TESTES.md`** ganhou uma entrada nova documentando o método (contar node primeiro,
      depois checar se quem falhou lança processo real, depois checar se está sob paralelismo
      padrão do mesmo projeto vitest) — para o próximo vermelho sem defeito achar isto sem repetir
      a investigação. **Q-063** registra a divergência da lista de arquivos (o quinto arquivo) e o
      raciocínio completo dos cuidados (a)-(d).

- [x] **S4-T11 — A CI do Windows fica vermelha em push só de documentação: os testes de `git/` e
      `storage/` ficaram fora da S4-T10.** Proposta do PO em 2026-09-11.

      **Medido em dois pushes de oito desde 10/09, ambos só de documentação** (`4146faa` e
      `e9286a5`): o job `windows-latest` falha com 14 testes estourando `5000ms`, sempre nos
      mesmos arquivos — `tests/integration/git/git-adapter.test.ts` (12 dos 14 casos),
      `git/primitives.test.ts`, `storage/atomic-write.test.ts`, os dois
      `storage/*-concurrent-write.test.ts` e, uma vez, `discovery/transcript-scan.test.ts` em
      30 s. Junto, **`EBUSY: resource busy or locked, rmdir '...\seeya-git-...\main'`** na
      limpeza do diretório temporário do git. Ubuntu e macOS passam nas mesmas execuções. O
      portão local está verde (cinco rodadas seguidas depois da S4-T10).

      **Medido depois:** a reexecução do mesmo job (`gh run rerun --failed`), sem nenhuma mudança,
      **passou**. É variabilidade do runner; o defeito é os testes serem sensíveis a ela. Não
      procure defeito de código.

      **Hipótese, não medição:** é a mesma classe de problema da S4-T10 — prazo fixo contra
      lançamento de processo de custo variável — só que nos testes que lançam **`git`** (cada
      `createGitFixture` faz vários `git init`/`commit`/`worktree add` por caso) e nos que matam
      processo de verdade (`atomic-write`), todos ainda em paralelismo padrão porque a S4-T10
      serializou só os cinco arquivos que lançam `powershell.exe`. O `EBUSY` pode ser um `git`
      ainda vivo quando o `afterEach` apaga a pasta — o que seria defeito de higiene do teste, e
      não só de prazo.

      *O que fazer:* medir antes de mexer (tempo por arquivo e quantidade de processos lançados
      por caso), estender o método da S4-T10 ao que a medição apontar, e explicar o `EBUSY` em vez
      de contorná-lo. **Sem aumentar prazo sem medição** (mesma regra da S4-T10). Nada em `src/`.

      *Aceite:* explicação do `EBUSY`; os arquivos apontados com tempo por caso registrado; o
      portão local continua verde cinco vezes seguidas; e a CI do Windows verde nos **três pushes
      seguintes** à mesclagem — a única prova possível, porque o runner é o que não se reproduz
      aqui.

      **Aceita em 2026-09-12: os três pushes seguintes à mesclagem passaram no Windows** (`ce6005b`,
      `7629672`, `9230ab1`), sem reexecução. O residual da Q-064 (contenção de CPU entre os projetos
      `guards` e `integration` no runner) continua registrado, não resolvido.

      **Implementado em 2026-09-12.**

      **Método: log bruto da CI, não só o resumo do despacho.** `gh run list`/`gh api .../logs
      --allow-escape-sequences` (caminho completo do `gh.exe`, fora do PATH nesta máquina; rodado
      do PowerShell — o Git Bash deste ambiente recusa qualquer comando cujo nome não seja
      resolvido estaticamente como não-git) trouxe o log inteiro dos dois runs vermelhos
      (`4146faa` → job `103101075995`; `e9286a5` → o **attempt 1** do job, `103184429216`, já que
      esse run foi re-executado e o attempt 2, sozinho, mostra só o resultado verde do rerun).
      Isso mudou a investigação: o despacho falava em "14 testes"; o log do `e9286a5` mostra 15
      (1 + 2 + 12, três arquivos), o do `4146faa` mostra 14 (2 + 9 + 1 + 2, quatro arquivos) — **o
      conjunto de arquivos afetados muda a cada rodada**, mesma assinatura que a S4-T10 já
      registrou para os cinco arquivos de `powershell.exe`.

      **Explicação do EBUSY (medida, não suposta).** Toda ocorrência de `EBUSY` no log aparece
      **imediatamente depois** de `Error: Test timed out in 5000ms.` (ou `30000ms`, nos dois
      casos com orçamento explícito) para o MESMO teste — nunca sozinha, nunca associada a um
      teste diferente. Mecanismo: `git-adapter.test.ts`/`primitives.test.ts` chamam
      `GitAdapter.readFacts`, que dispara vários `runGit` em paralelo (`Promise.all`). Quando o
      vitest declara o teste estourado aos 5000ms, ele não cancela essa cadeia — os `git.exe` já
      lançados continuam vivos. O `afterEach` roda em seguida e tenta `rm(fixture.root, {
      recursive: true, force: true })`; no Windows, apagar um diretório com um processo ainda
      segurando um handle dentro dele (o `git.exe` órfão) devolve `EBUSY`. **É higiene de teste,
      como a hipótese do despacho apontou** — mas o gatilho é o próprio teste correndo contra seu
      próprio timeout, não uma corrida entre dois testes (cada `mkdtemp` já gera uma pasta única;
      os nomes `seeya-git-ZKL4ng`, `seeya-git-ksiq55` etc. no log confirmam isso — cada `EBUSY` é
      uma pasta diferente).

      **A hipótese do despacho ("mesma classe da S4-T10") só se sustenta em parte — dito
      explicitamente porque a medição não bate 100% com ela.** `atomic-write.test.ts > a normal,
      uninterrupted write replaces the target in full (control case)` — dois `writeFileAtomic`,
      **zero processos lançados**, 16ms nesta máquina — também aparece no log com `Test timed out
      in 5000ms.` na mesma rodada. Não há lançamento de processo para explicar isso. Correlação
      medida no próprio log: naquela janela, `guards/eslint-restrictions.test.ts` (ESLint real)
      levou 70155ms contra ~43321ms de uma rodada mais tranquila, e
      `dependency-cruiser.test.ts`/`layer-matrix.test.ts` levaram ~40-42s cada — tudo isso rodando
      **ao mesmo tempo** que o lote padrão de paralelismo do próprio projeto `integration`, em outro
      projeto vitest. Isso é contenção de CPU do runner inteiro, não (só) disputa pelo lançamento
      de um binário específico.

      **Dois mecanismos, não um, distinguidos pela forma do estouro:** os testes que lançam
      processo (e o "control case" de `atomic-write`) estouram bem próximo do limite exato
      (5002-5060ms contra 5000ms) — sinal de que pararam de progredir e só bateram no relógio
      (starvation de agendamento). Os dois testes de 30s (`state`/`config-concurrent-write`, 300
      escritas + 300 leituras reais cada) estouraram por pouco (30722ms/30105ms, ~2-3% acima) na
      MESMA rodada em que o ESLint levou 70s; o caso de 500 arquivos de `transcript-scan.test.ts`
      estourou por mais (39090ms contra 30000ms) na outra rodada. Esses progrediram, só que mais
      devagar — degradação de vazão de I/O real sob carga, não paralisação total.

      **A correção: dois grupos novos, com docstrings SEPARADOS, dentro do `integration-process`
      já existente.** `REAL_CHILD_PROCESS_GIT_AND_STORAGE_FILES` (git-adapter.test.ts,
      primitives.test.ts, atomic-write.test.ts — lançam processo real, mesma classe de recurso da
      S4-T10) e `REAL_FS_IO_HEAVY_INTEGRATION_FILES` (state-concurrent-write.test.ts,
      config-concurrent-write.test.ts, transcript-scan.test.ts — não lançam processo, mas fazem
      I/O real sustentado: 300+300 escritas/leituras reais ou 500 `mkdir`+`utimes` concorrentes).
      **Deliberadamente não foram agrupados sob uma única alegação de recurso**: chamar os seis de
      "process-heavy" seria repetir a generalidade falsa que a própria S4-T10 já corrigiu uma vez
      no comentário do `integration` project (AGENTS.md/D-025 aplicado a comentário). Os dois
      grupos entram no MESMO projeto vitest (`integration-process`, `fileParallelism: false`) —
      a serialização é a mesma ferramenta para os dois, mesmo com recursos diferentes por trás.

      **O que a correção explicitamente NÃO promete resolver**, registrado no próprio comentário
      do `vitest.config.ts`: ela remove a disputa que ESTES 11 arquivos geram entre si; não
      alcança a carga de CPU que `guards/eslint-restrictions.test.ts` e
      `guards/dependency-cruiser.test.ts` geram na mesma janela, num projeto vitest separado que
      este não agenda. Se o runner ficar mais ocupado por outro caminho, o mesmo sintoma pode
      voltar — mesmo residual que a Q-063 já registrou para a S4-T10, ainda em aberto.

      **Tabela de processos por caso, medida com `vi.mock('node:child_process')` interceptando
      `spawn`** (script de medição descartável, não commitado — 2026-09-12, esta máquina, sem
      carga concorrente):

      | bloco em `git-adapter.test.ts` | git.exe lançados | tempo local (`--reporter=verbose`) |
      |---|---|---|
      | fixture (`createGitFixture`+2 commits+1 worktree) | 6 | — |
      | `readFacts`, 1 outro worktree | 7 | — |
      | "cwd que não é repositório" | 1 | 66ms |
      | "main cwd: branch, dirty..." (fixture+1 readFacts) | 13 | 701ms |
      | "lista o outro worktree..." | 13 | 618ms |
      | "não duplica o próprio worktree..." | 13 | 903ms |
      | "do cwd do worktree vinculado..." | 13 | 714ms |
      | alias (symlink/junction) | 11 | 486ms |
      | "nunca escreve no repositório" (2×readFacts+4 snapshots) | 32 | 950ms |
      | D-032, 2 repos sem worktree, ambos visitados | 16 | 482ms |
      | D-032, cwd próprio incluído | 16 | 481ms |
      | D-032, arquivo fora de repo contado | 11 | 421ms |
      | D-032, tudo fora de repo (0 repos) | 6 | 323ms |
      | D-032, dedup mesma raiz | 11 | 408ms |
      | D-032, teto de raízes (reposNotVisited) | 11 | 416ms |
      | D-022, worktree sumida do disco | 13 | 549ms |
      | **total do arquivo (14 casos)** | **~180** | **9,33s (os 6 arquivos juntos, isolados)** |

      `primitives.test.ts` (6 casos): 1-2 `git.exe` por caso, 8 no total, todos abaixo de 140ms
      localmente. `atomic-write.test.ts` (4 casos): 0 processos no "control case" e no "failed
      write" (16ms/17ms), 5 lançamentos reais de `node.exe` (`SIGKILL` a meio da escrita) no caso
      "never leaves... partially overwritten" (754ms), 3 no caso "never creates a partial target"
      (375ms). `state-concurrent-write.test.ts`/`config-concurrent-write.test.ts`: 0 processos, 300
      escritas reais + 300 leituras reais cada, 1,6s localmente contra um orçamento de 30s.
      `transcript-scan.test.ts`: 0 processos, o caso de 500 arquivos é 451ms localmente contra os
      mesmos 30s de orçamento.

      **Custo em tempo total, medido — antes (sem os 6 arquivos movidos) vs. depois:**

      ```
      antes  (1 rodada):  EXITCODE:0, 144s de parede
      depois (rodada 1):  EXITCODE:0, 169s de parede
      depois (rodada 2):  EXITCODE:0, 152s de parede
      depois (rodada 3):  EXITCODE:0, 153s de parede
      depois (rodada 4):  EXITCODE:0, 141s de parede
      depois (rodada 5):  EXITCODE:0, 147s de parede
      ```

      Média das 5 rodadas depois: 152s. Mesma ordem de grandeza do "antes" (144s) e da faixa que a
      S4-T10 já tinha medido (126-140s) — sem regressão perceptível, mesma leitura que a S4-T10 já
      fez para os cinco primeiros arquivos. `npm run verificar:linux` verde (container
      `node:22-bookworm`): 133 arquivos, 1441 passaram, 3 pulados — nenhum dos seis arquivos
      lança processo real no Linux (nem `powershell.exe` nem contenção equivalente foi observada),
      então a separação de projeto é inofensiva lá, como já valia para a S4-T10.

      **Aceite, medido cinco vezes seguidas nesta máquina, `npm run verificar`, todas
      EXITCODE:0, 133 arquivos, 1441 testes passaram, 3 pulados.** `npm run verificar:linux`
      verde. **A prova final, que não é minha, são os três pushes seguintes à mesclagem na CI real
      do Windows** — o runner não se reproduz nesta máquina, então nenhuma medição local pode
      substituir essa observação. `docs/QUESTOES.md` Q-064 registra o raciocínio completo
      (por que os dois grupos novos não foram unificados sob uma alegação só, e o que a medição
      NÃO sustentou da hipótese original do despacho).

- [x] **S4-T12 — O que a pessoa configura precisa valer: política por projeto que não casa, e
      modelo de captura que só muda no restart.** Saída da triagem das questões em 2026-09-12
      (Q-056 item 3 e Q-049 item 8). Duas correções pequenas no mesmo assunto.

      **Parte 1 — `projectPolicy` compara chave crua com `cwd` do registro.** Verificado:
      `application/eligibility-assembly.ts#projectPolicyFor` faz `config.projectPolicy[cwd]` com
      o `cwd` da sessão como veio do registro (`C:\code\x`), e a chave é gravada **exatamente
      como digitada** em `seeya config policy <cwd>`. No mesmo arquivo, a lista `ignore` é
      normalizada com `core/cwd-normalization.ts` antes de comparar. Consequência: `c:/code/x`,
      caminho relativo, caixa diferente ou barra final → `canTerminate: true` e
      `deepCapture: true` **nunca se aplicam, sem aviso**. É silêncio onde deveria haver efeito
      ou erro (D-025). *Aceite:* a política casa pelo mesmo critério do `ignore` — normalizar dos
      dois lados na leitura, e gravar a chave normalizada na escrita (`config policy`); um
      `config.json` existente com chave crua continua casando; teste com `C:\code\X\` contra
      `c:/code/x`; e `seeya config policy` com caminho relativo resolve contra o diretório atual
      ou recusa dizendo por quê — nunca grava algo que não vai casar.

      **Parte 2 — `captureModel` e `budgetPerSessionUsd` relidos a cada ciclo.**
      `cli/composition.ts#buildDaemonContext` constrói os geradores uma vez, com o config da
      subida; `scheduler/poll.ts#pollOnce` relê o config a cada ciclo, mas os geradores não veem.
      O mantenedor troca de modelo pelo `config set` no meio do dia e espera que valha no
      encerramento, como vale o `endOfDayTime`. *Aceite:* mudar `captureModel` ou
      `budgetPerSessionUsd` com o daemon no ar vale no ciclo seguinte, sem restart, com teste em
      `tests/unit/scheduler/poll.test.ts`. Sem chave nova em disco.

      **Implementado em 2026-09-12.**

      **Parte 1.** `application/eligibility-assembly.ts#projectPolicyFor` agora normaliza as
      chaves de `config.projectPolicy` com `core/cwd-normalization.ts#normalizeCwdForComparison`
      (o mesmo critério, a mesma função que `normalizedIgnoreSet` já usava para `ignore`) antes de
      comparar com o `cwd` recebido, também normalizado — nenhuma segunda normalização foi
      inventada. `cli/session-view.ts#resolveCanTerminate` e a leitura de
      `seeya config policy <cwd>` (`cli/config-command.ts`) passaram a chamar essa mesma função em
      vez de indexar `config.projectPolicy[cwd]` cru. A escrita
      (`adapters/storage/config-schema.ts#applyProjectPolicyUpdate`) grava a chave já
      canonicalizada (mesmo idioma que `normalizeEndOfDayTime` já usava para `endOfDayTime`),
      fundindo com qualquer entrada crua já existente que normalize para a mesma pasta (e removendo
      a chave antiga) — uma `config.json` com chave crua nunca tocada continua casando pela leitura
      normalizada, sem migração forçada. Caminho relativo em `seeya config policy` é resolvido
      contra `process.cwd()` (`cli/config-command.ts#resolvePolicyCwdArgument`, D-020: `cli/` é a
      raiz de composição) — nunca recusado, seguindo a recomendação do PO — e a confirmação ecoa o
      caminho absoluto/canonicalizado que de fato foi gravado.

      **Parte 2.** `scheduler/types.ts#DaemonDeps` trocou `leanGenerator`/`deepGenerator` por uma
      fábrica `buildGenerators(options)`, chamada uma vez por ciclo em
      `scheduler/poll.ts#buildEndDayDeps` com o `captureModel`/`budgetPerSessionUsd` que aquele
      MESMO ciclo acabou de ler de `config.json` — exatamente o padrão que `buildSessionProvider`
      já usava para `relevanceHours`, sem mecanismo novo. `cli/composition.ts#buildDaemonContext`
      não lê mais `config.json` na subida do daemon (não sobrou nenhum uso para essa leitura).

      **Justificativas registradas em `docs/QUESTOES.md` Q-065** (a questão desta tarefa): por que
      a canonicalização na escrita segue o idioma de `normalizeEndOfDayTime`; por que caminho
      relativo é resolvido e não recusado; por que dois testes que dependem de dobra de
      maiúscula/minúscula (só existe em `win32`) usam `it.runIf(process.platform === 'win32')` em
      vez de rodar incondicionalmente; e por que `buildDaemonContext` deixou de ser assíncrono "de
      verdade" (perdeu seu único `await`) e o que isso mudou na assinatura.

      **Medido:** `npm run verificar` verde (tipos, lint, `npm run dependencias` sem violação,
      build, `npm run cobertura`: 1456 testes passando, 3 pulados — os dois `it.runIf(win32)` desta
      tarefa rodaram de verdade nesta máquina — cobertura agregada 97,11% linhas, todo diretório de
      produção acima do próprio piso do `vitest.config.ts`, `core/` 100%). `npm run verificar:linux`
      verde via Docker Desktop (container Linux real, já estava rodando): 1454 passando, 5 pulados
      (os dois desta tarefa mais três testes Windows-only preexistentes), mesmos pisos de cobertura
      batendo. Códigos de saída lidos separadamente, nunca encadeados com o commit.

      **Inferido/decisão do agente:** todo o desenho de onde a normalização mora, a escolha de
      resolver em vez de recusar caminho relativo, e a forma de `CaptureGeneratorOptions` — ver
      Q-065 para as alternativas consideradas e por quê.

      **O que o mantenedor precisa ver à mão:** `seeya config policy c:/code/x --can-terminate
      true` (note a barra normal, minúsculo) seguido de uma sessão real com `cwd` gravado no
      registro como `C:\code\x` (barra invertida, maiúsculo) — `seeya sessions` deve mostrar
      `canTerminate: true` para essa sessão, e `seeya config get projectPolicy` deve mostrar a
      chave já canonicalizada (`c:/code/x`), não a que foi digitada.

- [x] **S4-T13 — `seeya status` é o painel único.** Decisão do mantenedor em 2026-09-12, saída
      da triagem da Q-056 (item 4), que fechava o gap aberto na Q-015 (S1-T6).

      **O que está errado hoje, e não é só omissão.** `cli/format-status.ts` imprime literalmente
      `Daemon: not implemented yet` — uma afirmação falsa em produção desde a S4-T3 (D-025), com
      um comentário no topo do arquivo que ainda diz que `core/schedule`, `snooze` e o daemon
      "não existem ainda". Quem digita `status` quer saber **o que vai acontecer hoje**, e a
      resposta mora em outro comando (`daemon --status`, S4-T5) que a pessoa precisa saber que
      existe.

      **O que fazer.** `seeya status` passa a mostrar, além do que já mostra (horário configurado,
      sessões elegíveis de descobertas): o horário **efetivo** de hoje (com adiamento acumulado e
      `skip-today`), se o encerramento já rodou, e o estado do daemon nos mesmos quatro casos que
      `daemon --status` já distingue (não rodando / rodando e saudável / rodando e falhando há N
      minutos / lock presente mas não verificável). **Reuse, não duplique:** a decisão do
      agendamento vem de `core/schedule.ts#decideSchedule` (o mesmo que `snooze` já chama só para
      renderizar) e o estado do daemon vem do mesmo `checkLiveLock`/`describeHealth` de
      `cli/daemon-command.ts` — extraia o que for compartilhado em vez de copiar texto.
      `daemon --status` continua existindo (é o par natural de `--stop`), mostrando o mesmo que
      `status` mostra sobre o daemon, pela mesma função.

      **Cuidados:** `status` é **somente leitura** — não limpa lock morto (isso é do `--stop`), não
      persiste estado. O `Clock` é o injetado (D-019). Texto em inglês (D-028), concentrado, não
      espalhado. O comentário do topo de `format-status.ts` sai: ele descreve um mundo que não
      existe mais.

      *Aceite:* `seeya status` responde "o que vai acontecer hoje e o daemon está cuidando disso?"
      sem a pessoa precisar de outro comando; nenhuma frase do `status` afirma o que o programa
      não verificou; `daemon --status` e `status` nunca discordam sobre o daemon porque leem a
      mesma decisão; teste de unidade para cada um dos quatro estados do daemon e para
      adiado/pulado/já rodou.

      **Relatório da execução (2026-09-12).** `checkLiveLock`/`describeLiveness`/
      `describeScheduleDecision`/`describeHealth` saíram de `cli/daemon-command.ts` para um módulo
      novo, `cli/daemon-state.ts`, junto com uma função combinada nova (`describeDaemonState`) que
      monta o bloco inteiro do daemon; `runDaemonStatus` virou um `return
      describeDaemonState(deps)` de uma linha, e `cli/status-command.ts` chama a mesma função —
      nunca duas renderizações do mesmo estado. `StatusCommandContext` ganhou `storage`/
      `processControl`; `cli/composition.ts#CliContext` (compartilhado com `seeya sessions`) ganhou
      os dois campos também, para não duplicar uma segunda função de composição quase idêntica a
      `buildCliContext`. Detalhe de cada escolha em Q-066.

      **Antes (S1-T6/Q-015, reconstruído do código anterior a esta tarefa — `cli/format-status.ts`
      antes da edição, não reexecutado: a string era literal, não havia como diferir):**
      ```
      End-of-day time: <configurado ou "not configured (manual only)">
      Eligible sessions: <N> of <M> discovered
      Daemon: not implemented yet
      ```

      **Depois (medido nesta máquina, `dist/cli/index.js` real contra um `~/.seeya` temporário —
      nunca o `~/.seeya` real desta máquina):**

      Estado fresco, nada configurado ainda:
      ```
      $ seeya status
      End-of-day time: not configured (manual only)
      Eligible sessions: 0 of 0 discovered
      Daemon: not running.
      End-of-day: not configured (manual only).
      Daemon health: no failed cycles recorded (as of the last time it ran, if ever).
      ```

      Depois de `seeya config set endOfDayTime 23:59` e `seeya snooze +15m`, com o daemon **no ar**
      (`seeya daemon` real, detached, pid real):
      ```
      $ seeya status
      End-of-day time: 23:59 local
      Eligible sessions: 0 of 0 discovered
      Daemon: running (pid 22756, started 2026-09-12T17:13:23.582Z).
      End-of-day: scheduled for 00:14, not reached yet.
      Snoozed today: 15 minute(s) total.
      Daemon health: healthy — no failed cycles recorded.

      $ seeya daemon --status
      Daemon: running (pid 22756, started 2026-09-12T17:13:23.582Z).
      End-of-day: scheduled for 00:14, not reached yet.
      Snoozed today: 15 minute(s) total.
      Daemon health: healthy — no failed cycles recorded.
      ```
      As quatro linhas do daemon são **idênticas, byte a byte**, entre `seeya status` e `seeya
      daemon --status` — o teste `tests/unit/cli/daemon-status-agreement.test.ts` prova o mesmo
      para os quatro estados do lock (D-024) e uma falha em série, não só este caso feliz.

      Depois de `seeya daemon --stop` (parado à força — sem caminho gracioso no Windows, D-005):
      ```
      $ seeya daemon --stop
      Stopped the daemon (pid 22756) forcibly. Nothing was lost: it saves its state after every
      poll cycle, so the next "seeya daemon" picks up exactly where this one left off.

      $ seeya status
      End-of-day time: 23:59 local
      Eligible sessions: 0 of 0 discovered
      Daemon: not running.
      End-of-day: scheduled for 00:14, not reached yet.
      Snoozed today: 15 minute(s) total.
      Daemon health: no failed cycles recorded (as of the last time it ran, if ever).
      ```

      **Verificação:** `npm run verificar` verde nesta máquina (código de saída lido separado do
      `npm test`/`npm run cobertura` que ele engloba). `npm run verificar:linux` (Docker Desktop já
      rodando): na primeira passada pegou de verdade um teste novo (`tests/unit/cli/
      status-command.test.ts`, o caso de adiamento) que só falhava dentro do container por
      depender de fuso horário — corrigido e reconfirmado sob `TZ=UTC` e mais quatro fusos extremos
      nesta máquina antes de rodar `verificar:linux` de novo. A segunda passada: 135 arquivos de
      teste, todos passando, tabela de cobertura completa sem nenhum diretório abaixo do próprio
      piso, nenhum "FAIL"/erro — a captura do log perdeu só a última linha de resumo percentual
      (artefato do redirecionamento através do Docker Desktop neste host: um teto de cobertura não
      atingido interrompe ANTES da tabela completa, com um bloco de erro, o que não aconteceu
      aqui). Cobertura (medida na máquina local, mesmos números confirmados linha a linha no
      container): `core/` 100%, `cli/` 96.77% statements / 95.39% branches / 94.85% functions /
      97.23% lines — acima do piso de 80%; `cli/daemon-state.ts` isolado em 100% statements/lines,
      96.42% branches.

## Sprint 5 — Entregar

**Sprint 5 mínimo (D-041, 2026-09-13):** entram S5-T0, S5-T1, S5-T5 e S5-T6. S5-T2, S5-T3,
S5-T4 e S5-T7 ficam **adiadas para a fronteira da v2** — continuam listadas para não perder o
texto, mas não são a fila.

- [x] **S5-T0 — Renomear para `seeya` (D-040).** Feita pelo PO em 2026-09-13 (não é tarefa de agente: mexe na pasta que as worktrees habitam). Numa leva só, sem agente no ar: renomear o
      repositório no GitHub (a URL antiga redireciona) e a pasta local; refazer o `npm link`;
      podar as worktrees antigas; `package.json` → `@seeya/cli` (sem publicar); atualizar as
      menções ao nome longo onde ele é identificador (README, CI, `AGENTS.md` título, `INDEX.md`)
      e **não** onde é história (decisões, spikes, relatórios). *Aceite:* portão verde na pasta
      nova, `seeya --version` funcionando pelo link novo, CI verde no repositório renomeado, e o
      `ESTADO-ATUAL.md` dizendo o caminho novo — a chave de memória do Claude Code para a pasta
      muda, e quem retomar precisa saber disso.

      **Relatório (2026-09-13).** GitHub renomeado com `gh repo rename` (a URL antiga
      redireciona); 44 worktrees antigas removidas; `package.json`/lock → `@seeya-ai/cli`, binário
      `seeya`; README, `AGENTS.md`, D-040 e estado atualizados; commit `dbcdd12` publicado, CI verde
      nos três sistemas no repositório renomeado. **A pasta local não pôde ser renomeada:** o
      Windows recusou (`acesso negado`) mesmo com VS Code, terminais e a janela do Explorer
      fechados — algum processo mantém um handle nela, e o teste de controle descartou o próprio
      Claude Code (uma pasta lida por esta sessão renomeou normalmente). Em vez de brigar com o
      handle, a pasta nova é um **clone** (`C:\code\seeya`, mesmo HEAD, `.termos-locais` e
      `.claude/settings.local.json` copiados), com `npm ci`, `npm link` refeito
      (`@seeya-ai/cli -> C:\code\seeya`, `seeya --version` respondendo) e portão verde (1472
      testes). **A pasta antiga continua no disco** até o handle soltar — apagar quando nada mais
      a segurar; nada nela é único.
- [x] **S5-T1 — Autostart do daemon** por SO (Task Scheduler, launchd, systemd user). **Aceita em 2026-09-13:** reinício real, tarefa executada no logon, daemon no ar sozinho, `status` com `enabled`, e **nenhuma janela** com o daemon rodando (o mantenedor observou por um minuto; uma piscada isolada logo após o reinício não se repetiu e foi atribuída ao próprio boot). Linux e macOS seguem não medidos.
      Especificada pelo PO em 2026-09-13; a linha acima era tudo o que existia, e uma sessão
      limpa apontou que despachar assim seria pedir ao agente para inventar comportamento.

      **Por que agora:** em 12/09 a tampa do notebook fechou, o daemon morreu com a suspensão, e
      o encerramento das 11:00 ficou sem ninguém para disparar — o `seeya status` novo foi o que
      mostrou "não está rodando". Hoje o daemon só volta se alguém lembrar de subir. É a única
      tarefa do Sprint 5 que muda o dia a dia do mantenedor (D-041).

      **Comando:** `seeya autostart enable | disable | status`. Nome novo de comando; entra no
      glossário do `AGENTS.md` antes do código. Nenhuma chave nova em disco (D-027): o estado
      "ligado/desligado" mora no sistema operacional, e `status` o lê de lá.

      **Mecanismo por sistema**, um adapter por SO atrás de uma porta (D-020):
      - **Windows:** Agendador de Tarefas, gatilho "ao fazer logon" do usuário atual.
      - **Linux:** unidade `systemd --user` em `~/.config/systemd/user/`, habilitada para o
        alvo padrão da sessão do usuário.
      - **macOS:** LaunchAgent em `~/Library/LaunchAgents/`.

      **A pergunta que a tarefa precisa medir antes de escolher, no Windows:** o daemon precisa
      rodar **na sessão interativa** (senão o toast não aparece — Spike B) **e sem janela** (D-038;
      `node.exe` é programa de console e uma tarefa "só quando o usuário está logado" abre um
      console). Tarefa "executar mesmo sem logon" some com a janela mas cai na sessão 0, onde
      o toast não chega. Candidatos a medir: `conhost.exe --headless`, um lançador `.vbs` via
      `wscript` com janela oculta, e `powershell -WindowStyle Hidden` (que pisca). **Registre a
      medição na Q-067 e escolha o que satisfaz os três: sessão interativa, sem janela, remoção
      limpa.** Se nenhum satisfizer os três, diga isso — é resultado.

      **Comportamento:**
      - `enable` registra o autostart apontando para o binário atual (o caminho do `dist` em uso)
        e diz o que registrou; se já existe, diz que já existia e o que mudou (caminho antigo vs.
        novo), sem duplicar.
      - `disable` remove e diz que removeu; se não existia, diz isso sem erro.
      - `status` responde ligado / desligado / **ligado mas apontando para um caminho que não
        existe mais** (a renomeação de 13/09 é o caso real) / não consegui verificar — quatro
        estados, nunca achatados (D-024, D-025). O `seeya status` (S4-T13, painel único) ganha
        uma linha com esse mesmo resultado, pela mesma função.
      - O daemon que sobe pelo autostart é o mesmo `seeya daemon`: o lock de instância única já
        impede dois daemons se a pessoa também subir à mão, e o lock órfão de um desligamento é
        recuperado sozinho (S4-T5). A D-036 já cobre o logon depois da virada do dia.

      **Cuidados:** nada de `exec` com string (AGENTS.md § "Processos"); `spawnHidden` (D-038)
      para chamar `schtasks`/`systemctl`/`launchctl`; mensagens com o valor e o esperado
      (AGENTS.md § "Mensagens de erro"); texto em inglês, concentrado.

      **Relatório (2026-09-13).** Medição do Windows feita antes do código, com três tarefas
      agendadas descartáveis (prefixo `seeya-spike-`, removidas ao final — confirmado com
      `Get-ScheduledTask -TaskName "seeya-spike-*"` vazio). Detalhe completo, com os comandos
      exatos e o achado de que `schtasks.exe /Create` exige elevação nesta máquina enquanto o
      módulo PowerShell `ScheduledTasks` não, em **Q-067**.

      | Candidato | Sessão interativa | Sem janela | Toast |
      |---|---|---|---|
      | `conhost.exe --headless` | medido: `SessionId` igual ao da sessão corrente | medido: nenhuma janela nova | medido: `Show()` sem exceção |
      | `.vbs` via `wscript.exe` (`Run ..., 0, False`) | medido: idem | medido: idem | medido: idem |
      | `powershell.exe -WindowStyle Hidden` | medido: idem | medido: **falhou** — uma janela nova apareceu (o "pisca" que o próprio despacho já previa) | medido: idem |

      Dois candidatos satisfizeram os três critérios; escolhido **`conhost.exe --headless`** por
      não exigir um arquivo auxiliar em disco (o `.vbs` precisaria de um lançador próprio,
      registrado e limpo à parte). O caminho registrado fica no campo `Description` da tarefa
      (Windows) ou num marcador que só o próprio adapter escreve (`# seeyaBinaryPath=` no unit
      file do Linux, `<!-- seeyaBinaryPath:...-->` no plist do macOS) — nunca reconstituído por
      parsing da linha de comando real, que precisa ficar com aspas de verdade para o SO
      executar.

      **Medido:** os três candidatos do Windows (tabela acima); que `schtasks.exe /Create` exige
      elevação nesta máquina e `Register-ScheduledTask` não (Q-067); portão (`npm run
      verificar`) e `npm run verificar:linux` verdes, códigos lidos separadamente; cobertura —
      `core/` 100%/99.11%/100%/100% (statements/branches/functions/lines), `adapters/autostart`
      89.92%/89.77%/80.55%/90.55%, `cli` agregado 96.51%/94.9%/94.32%/96.95%, todos acima do piso
      exigido.

      **Inferido, não medido:** que o daemon de verdade (lançado em dois saltos — a tarefa sobe
      `seeya daemon`, que por sua vez sobe o worker desanexado via `spawnDetachedDaemon`, D-005)
      herda a mesma sessão interativa do primeiro salto — a medição usou um script que envia o
      próprio toast, um salto só, não a topologia real de dois processos. A herança de sessão por
      um processo desanexado (sem console, mas com o mesmo token/sessão do pai) é comportamento
      documentado do Windows, não uma segunda medição própria desta tarefa. Linux (`systemd
      --user`) e macOS (LaunchAgent) **não foram medidos** — implementados conforme os mecanismos
      documentados que a própria S5-T1 nomeia, testados só contra fakes injetados (nunca um
      systemd/launchd real, AGENTS.md § "Testes"). "Sem janela" e "toast chega" no Windows foram
      medidos por proxy objetivo (diferença de janelas visíveis via `EnumWindows`, e ausência de
      exceção na chamada WinRT), não por confirmação visual humana em tempo real.

      **O que o mantenedor precisa fazer à mão, no mínimo:** `seeya autostart enable`; reiniciar a
      máquina (ou deslogar/logar de novo); conferir com `seeya status` (ou `seeya autostart
      status`) que o autostart aparece como `enabled` e, principalmente, observar que o daemon
      subiu **sem nenhuma janela de console aparecendo** durante o logon — esse é exatamente o
      ponto que a medição automatizada não conseguiu confirmar sozinha (só o proxy de
      `EnumWindows`). Testar a validação prática do texto do despacho ("a linha acima era tudo o
      que existia") de ponta a ponta: fechar a tampa/suspender, a máquina acordar, e o `seeya
      status` continuar respondendo sem ninguém ter subido o daemon à mão.

      **Testes:** os comandos gerados por SO, por unidade, com o runner injetado — nunca tocando
      o Agendador/systemd/launchd reais da máquina de quem roda a suíte. O aceite real é manual:
      o mantenedor faz `enable` no Windows, reinicia, e o `seeya status` mostra o daemon rodando
      sem nenhuma janela ter aparecido; Linux e macOS quando ele tiver as máquinas à mão.

      *Aceite:* o daemon sobe sozinho no logon do Windows, na sessão interativa, sem janela, e o
      toast continua funcionando; `enable`/`disable`/`status` com os quatro estados; `seeya
      status` mostra a linha; portão e `verificar:linux` verdes; Q-067 com a medição do Windows.
- [ ] **S5-T2 — `seeya init`**: config guiada na primeira execução. **Adiada para a fronteira
      da v2** (D-041): a v2 redefine a instalação (espaço de trabalho, remoto, dispositivo).
- [ ] **S5-T3 — README** e empacotamento npm. **Adiada para a fronteira da v2** (D-041), sob
      `@seeya/cli` (D-040).
- [ ] **S5-T4 — Bateria manual nos 3 SOs** e correção do que aparecer. **Adiada para a
      fronteira da v2** (D-041).

---

- [x] **S5-T5 — Atualizar as ações do CI, que rodam num runtime obsoleto.** **Aceita em 2026-09-13:** na primeira execução depois da mesclagem (`d3d7b4b`), CI verde nos três sistemas e **zero ocorrências** do texto do aviso no log. Não é a nossa versão
      do Node: o `ci.yml` pede `node-version: 22` para o projeto e isso está certo (D-008). O que
      está velho é o **runtime das ações**: `actions/checkout@v4` e `actions/setup-node@v4` são
      construídas para Node 20, e o GitHub já as força a rodar em Node 24, avisando em toda
      execução.
      Isso é **relógio correndo, não preferência**: hoje é aviso, e vira falha quando o GitHub
      parar de forçar. A troca é de duas linhas; o custo de deixar passar é o CI quebrar num dia
      em que ninguém mexeu em nada — e aí alguém vai procurar a causa no código.
      *Aceite:* CI verde nos três sistemas **sem o aviso de runtime obsoleto** na saída.

      **Relatório (2026-09-13).** `actions/checkout@v4`→`@v7` e `actions/setup-node@v4`→`@v7` em
      `.github/workflows/ci.yml` (mesmas majors usadas no `.github/workflows/codeql.yml` novo da
      S5-T6). **Medido:** texto exato do aviso, lido do log bruto de uma execução real de antes
      desta troca (`gh api .../actions/jobs/103767041821/logs --allow-escape-sequences`, job
      "verificar (ubuntu-latest)", run 34773415822, 2026-09-13): *"Node.js 20 is deprecated. The
      following actions target Node.js 20 but are being forced to run on Node.js 24:
      actions/checkout@v4, actions/setup-node@v4."* Confirmado nas release notes reais das duas
      ações que a virada para Node 24 aconteceu na `v5.0.0` de cada uma; `@v7` é a major mais
      recente hoje e já carrega essa base. `node-version: 22` do projeto (D-008) não mudou — é o
      runtime da AÇÃO, não do `seeya`. `npm run verificar` (1472 testes) e `npm run
      verificar:linux` verdes nesta máquina depois da troca. **Inferido/só depois da mesclagem:**
      o aviso sumir de verdade nos três SOs — não medido, porque esta troca está numa worktree e
      não fiz push. Detalhe em `docs/QUESTOES.md` Q-068 item 1.
- [x] **S5-T6 — Portão de segurança antes de publicar: dependências e SAST.** **Aceita em 2026-09-13:** job de `npm audit` verde (três achados moderados na árvore de desenvolvimento, reportados); CodeQL rodou pela primeira vez com sucesso. **Primeiro achado real:** 1 (alto: js/insecure-temporary-file em scripts/spike-j-measure.mjs:404 — script de spike, não código do produto). A decisão reprovar/reportar (Q-068) fica com o mantenedor, com esse dado na mão. Pedido do mantenedor
      em 2026-08-30, com a ressalva de que não é para agora — entra antes da publicação, não
      durante a construção.
      O motivo de existir: este projeto vai para npm como código aberto, **executa processos**,
      **lê arquivos do usuário** e tem uma exceção documentada para **apagar** dentro do
      `~/.claude/`. É superfície suficiente para merecer análise automática antes de alguém
      instalar isto na própria máquina.
      - **dependências:** `npm audit` no portão. A árvore é pequena hoje, então é barato — e o
        momento de estabelecer o hábito é enquanto é barato
      - **SAST:** o CodeQL é o encaixe natural (nativo do GitHub, gratuito em repositório
        público, entende TypeScript). Vale apontá-lo em especial para o que o projeto faz de
        arriscado: montagem de argumento de `spawn`, caminho de arquivo vindo de fora, e a
        exclusão do D-012
      - **segredo:** já existe o `scripts/verificar-termos-locais.mjs` no pre-commit, mas ele só
        protege quem commita **nesta** máquina. Varredura no CI cobre quem clonar e contribuir
      **Uma decisão a tomar quando chegar:** o portão de segurança **reprova** o CI ou só reporta?
      Reprovar por vulnerabilidade transitiva que não tem correção disponível trava o projeto por
      algo fora do alcance dele. Reportar e ninguém olhar é o mesmo que não ter. Não decida isso
      agora — decida com o primeiro achado real na mão.

      **Relatório (2026-09-13).**

      1. **Dependências.** `npm audit` roda num job novo e separado do CI
         (`auditoria-de-dependencias`, `.github/workflows/ci.yml`), **nunca** em `npm run
         verificar` local — o achado depende da base de avisórios do npm no instante da
         execução, não do diff da tarefa, e precisa de rede, que o resto do portão local
         deliberadamente não usa (justificativa completa na Q-068 item 2). Implementado em
         `scripts/audit-report.mjs` + `npm run audit-report`: reporta todo achado e só reprova
         (`exit 1`) se houver vulnerabilidade **crítica com correção disponível** — a única
         exceção que o despacho autorizou.
         **Achado real medido hoje:** 3 vulnerabilidades, todas `moderate`, todas na árvore de
         dev do `vitest` (`@vitest/coverage-v8`, `@vitest/mocker`, `vitest`; GHSA-82fw-gwwq-j7x9,
         `fixAvailable: true`), nenhuma crítica — a exceção não dispara, o job reporta e sai
         verde. **A decisão reprova/reporta em si, com os dois lados, está na Q-068 item 2**, como
         o despacho pediu.
      2. **SAST.** `.github/workflows/codeql.yml` novo (workflow dedicado), `language:
         typescript`, `queries: security-extended` (suíte nativa mais ampla, sem ação de
         terceiro). Nenhum caminho excluído da varredura — em especial
         `src/adapters/discovery/fork-cleanup.ts` (a exceção do D-012), `src/adapters/process/`
         (montagem de `spawn`) e os adapters que leem caminho externo continuam dentro do
         escopo, de propósito. Confirmado via `gh api .../code-scanning/default-setup`
         (`"state": "not-configured"`) que este workflow avançado não conflita com o "default
         setup" do GitHub. **`codeql` CLI não está instalado nesta máquina e não foi instalado**
         (instrução do despacho): não rodei a análise localmente. **O primeiro resultado real só
         existe depois da primeira execução deste workflow no GitHub** — não medido ainda.
      3. **Segredos.** Medido com `gh api repos/mausampaio/seeya --jq "{visibility, private,
         security_and_analysis}"`: `secret_scanning` e `secret_scanning_push_protection` **já
         estavam `enabled`** neste repositório público, antes desta tarefa. Nada foi ligado —
         não havia nada para ligar. Achado à parte (fora do pedido): `dependabot_security_updates`
         está desligado; registrado em Q-068 item 4 com o comando exato, não acionado.

      `npm run verificar` (1472 testes) e `npm run verificar:linux` (Docker Desktop, container
      Linux real) verdes nesta máquina depois de todas as mudanças acima. Detalhe completo, as
      escolhas com leitura alternativa e a decisão reprova/reporta na íntegra:
      `docs/QUESTOES.md` Q-068.

- [ ] **S5-T7 — Avaliar um `--sessions` que aceite lista.** Ideia do mantenedor em 2026-08-30,
      ao fechar a Q-030, **com a ressalva dele de que não é para agora** — registrada aqui para
      não se perder, não como tarefa aceita.
      *Contexto:* a S3-T5 fez `--session` **recusar** valor ambíguo em vez de resolver várias
      sessões de uma vez. Isso não removeu capacidade nenhuma: capturar todas as sessões de um
      `cwd` nunca foi objetivo, era efeito colateral de comparar caminho por igualdade de string
      numa flag cuja ajuda diz "limit to a single session".
      *Se um dia entrar:* uma flag **separada e explícita** para várias, nunca reinterpretando a
      singular. O `--session` recusando ambiguidade é o que impede escolha errada no comando que
      também pode encerrar processo (D-002); relaxar aquilo para acomodar o caso plural traria o
      problema de volta pela porta dos fundos.
      *Critério para existir:* necessidade real de uso, não simetria de API. Se ninguém sentir
      falta, esta entrada some sem custo — que é o melhor destino possível para ela.
- [ ] **S5-T8 (candidato, NÃO agendado) — Briefing agrupado por projeto.** Direção aprovada pelo
      mantenedor em 2026-09-07 (**D-039**), sem tarefa disparada e sem prazo. O `summary.md` hoje é
      lista plana de sessões; a D-032 já descobre os repositórios de cada sessão pelos arquivos
      tocados, então o agrupamento sai de evidência que já existe. Ataca a metade **de leitura** do
      "estou perdido entre vinte sessões" — a metade de **decidir** o que fazer com cada uma é a
      tela do v2. Interessa agora porque é a base que essa tela vai consumir.

- [~] **S5-T9 — Plano longo não pode custar o histórico da sessão.** Achado em uso real em
      2026-09-13, na primeira retomada depois do reinício.

      **O que aconteceu, medido no terminal do mantenedor:** o `start-day` escolheu o briefing
      pendente de 06/09 e, para a sessão `code-6d`, imprimiu: *"yesterday's plan is too long to
      pass safely to an interactive session (4135 characters, limit 4096). Opened a new session
      there instead"*. **Por 39 caracteres**, a sessão inteira (uma semana de contexto) foi
      trocada por uma sessão limpa com o plano como nota. A mensagem foi honesta e clara — o
      defeito é o desenho, não o aviso. Os handoffs reais medem entre 1,8 mil e 4 mil caracteres:
      o teto de 4096 está **no meio da distribuição real**, e é um penhasco — um caractere a mais e
      o custo é o histórico inteiro.

      **Por que o teto é 4096:** ~1/8 do limite de linha de comando do Windows (32.767), escolhido
      por folga na S3-T2 (Q-027), antes de haver handoffs reais para medir.

      **O que fazer, nesta ordem:**
      1. **Medir** se `claude --resume <id> --append-system-prompt-file <arquivo> "<kickoff curto>"`
         entrega o conteúdo do arquivo a uma sessão **retomada** em modo interativo (o fallback já
         usa o arquivo, mas só em sessão nova). Teste com sessão descartável e um marcador no
         arquivo que o modelo tenha que citar. Registrar na Q-069.
      2. Se entregar: **o plano vai sempre pelo arquivo, e o argumento posicional fica só com o
         kickoff curto e fixo.** Some a ramificação por tamanho; o fallback fica só para o
         `--resume` que falha de verdade (D-004). Nenhuma sessão perde histórico por comprimento.
      3. Se não entregar: subir o teto para um valor **medido** contra o limite real (o Windows é
         o mais apertado; POSIX é ordens de grandeza maior), com o mesmo teste de ida-e-volta que
         `args.ts` já cita, e manter o fallback como último recurso — declarando no aviso quantos
         caracteres sobraram.

      **Parte 2 — o fallback avisa ANTES, e pergunta.** Hoje o motivo do fallback só aparece
      **depois** que a sessão nova termina: o `start-day` imprime o resumo ao final, e com
      `stdio` herdado a pessoa fica dentro da sessão limpa sem saber por que está ali. Nas palavras
      do mantenedor: *"eu como usuário só consegui ler essa informação dando um exit na sessão; eu
      deveria ter recebido essa informação, nem que tivesse um 'deseja ir para uma sessão nova
      mesmo assim?'"*. Regra: **antes** de abrir qualquer sessão de fallback, o `start-day` imprime
      o motivo (o mesmo texto de hoje) e pergunta se abre a sessão nova; **o padrão é não abrir**
      (Enter = pular esta sessão e seguir para a próxima), porque a sessão nova é o caminho que
      perde histórico e não pode ser escolhido por distração. A resposta e o resultado continuam
      no resumo final, como hoje. `start-day` já é interativo por construção (TTY herdado), então
      perguntar cabe; a resposta inválida aborta a retomada daquela sessão com mensagem, sem laço
      (mesmo padrão do `start-day` atual, Q-028).

      *Aceite:* um handoff de 4.135 caracteres (o caso real) retoma a sessão original; o teste de
      contrato prova o mecanismo escolhido; quando o fallback ainda acontecer, a pessoa vê o motivo
      **antes** e escolhe, com o padrão sendo não abrir; a mensagem diz o motivo e o tamanho, como
      já faz.

      **Relatório (worktree `C:/code/seeya-wt-S5-T9`, branch `tarefa/S5-T9-plano-longo`), medido
      nesta máquina, sem Docker/`verificar:linux` (não solicitado rodar neste agente) — ver Q-069
      para a medição completa e o que ficou por medir.**

      **Passo 1 (medido, ramo "não entrega"):** `claude --resume <id> --append-system-prompt-file
      <arquivo>` **não** entrega o conteúdo do arquivo a uma sessão retomada — 4 tentativas, 3
      técnicas, 0 entregas (headless, `-p`, único modo que este agente conseguiu medir sem TTY
      real). `RESUME_PROMPT_ARG_LIMIT_CHARS` subiu de 4096 para **16.384**, medido contra o teto
      real do Windows (busca binária: bom até 32.612, `ENAMETOOLONG` a partir de 32.656) e contra
      um round-trip real de conteúdo no novo teto. A ramificação por tamanho **continua existindo**
      (não foi removida — o ramo era o certo, dado o resultado da medição). Teste de contrato novo,
      `tests/contract/resume-argument-roundtrip.test.ts`, prova o caso real de 4.135 caracteres
      contra o `claude` instalado (2.1.270).

      **Passo 2 (feito):** `SessionResumer` dividido em `attemptResume`/`runFallback`
      (`core/ports.ts`, `adapters/resumption/resumer.ts`) para abrir espaço para a pergunta entre
      "precisa de fallback" e "abrir o fallback". Decisão pura em
      `core/resume-fallback-decision.ts` (`parseFallbackAnswer`, padrão "pular" no vazio), orquestrada
      em `application/start-day.ts` (`ResumeSessionsResult` ganhou `skipped`/`invalidFallbackAnswers`),
      pergunta e impressão em `cli/start-day-command.ts`/`cli/format-start-day.ts`. Resposta
      inválida não entra em laço (Q-028) e não para o `--all` inteiro — só aquela sessão fica sem
      resumir, e o resumo final lista "Skipped at your request"/"invalid answer" por sessão.

      **Portão:** `npm run verificar` verde nesta máquina — tipos, lint, `dependencias`, `build` e
      `cobertura` cada um lido separadamente (`core/` 100%, demais acima de 80%,
      `cli/start-day-command.ts` fechado em 100% depois de testes dedicados ao caminho sem TTY).
      `verificar:linux` **não rodado** — não fazia parte do que foi pedido a este agente.

      **O que o mantenedor precisa fazer num terminal real (Q-069 tem o detalhe):**
      1. A medição central da Parte 1 **em modo interativo de verdade** (sem `-p`, `stdio`
         herdado) — tudo aqui usou headless por falta de TTY no ambiente do agente.
      2. Um `seeya start-day` real com um handoff de mais de 16.384 caracteres, para ver o fallback
         disparar de verdade, a pergunta aparecer antes, e o "pulada a pedido" no resumo final.

## v2 — o projeto como unidade (rumo em `docs/V2-RUMO.md`)

- [~] **V2-T0 — Spike M: o terminal embutido.** Aprovado pelo mantenedor em 2026-09-13. Medido no
      Windows em 2026-09-13 (registro completo em `docs/spikes/M-terminal-embutido.md`); Linux e
      macOS ficam para o mantenedor, na máquina dele.

      **Resultado, item por item:** os seis itens do roteiro foram medidos no Windows e todos
      passaram. (1) Montagem: sobe sem compilar nada nesta máquina — `node-pty` 1.1.0 já vem com
      prebuild N-API para `win32-x64`, carregado sem problema tanto em Node puro quanto dentro do
      processo principal do Electron; achado que muda o plano do mantenedor: o pacote **não** traz
      prebuild para `linux-x64`, então o `npm install` em Linux deve cair em `node-gyp rebuild` e
      exigir toolchain de compilação — inferido do conteúdo do pacote, não confirmado em Linux.
      (2) e (3) `claude` e `codex` dentro da aba: TUI abre, aceita entrada, redimensiona sem
      quebrar, cores e caixas corretas (confirmado por captura de tela), `Ctrl+C` chega ao
      processo, saída detectada — com duas ressalvas medidas: cada harness tem sua própria tela de
      primeira confiança que precisa ser navegada antes do primeiro prompt real, e o `codex`
      (diferente do `claude`) só submete a mensagem se o Enter for escrito **separado** do texto
      (escrever tudo numa chamada só fica preso na caixa, sem enviar). (4) D-038: enumeração de
      janelas antes/depois (técnica da Q-067) mostrou só +1 janela — a do próprio Electron; o
      `conhost.exe` do ConPTY existe como processo mas nunca abre janela. (5) Identidade: com o
      `claude` rodando na aba, `~/.claude/sessions/<pid>.json` trouxe `cwd` igual ao diretório da
      aba, igual a uma sessão comum — a descoberta do seeya funciona sem adaptação. (6) Custo: 1
      aba com shell vazio = 342 MB; 3 abas = 394 MB (custo marginal ~26 MB/aba); 1 aba com `claude`
      de verdade ocioso = 604 MB (o harness em si pesa mais que o terminal embutido).

      **Recomendação:** a D-042 se sustenta no Windows; as duas ressalvas acima são detalhes de
      como a ponte de entrada deve escrever no pty, não motivo para reconsiderar a stack. O risco
      que não fechou é o Linux — sem prebuild do `node-pty` lá, a medição de montagem pode não se
      repetir.

      **O que não foi medido:** Linux e macOS por inteiro; confirmação visual humana ao vivo
      (as capturas de tela foram lidas pelo próprio agente); sessões longas; mais de três abas ou
      várias abas com harness de verdade ao mesmo tempo; `Ctrl+Break`/encerramento gracioso do
      spike G contra uma sessão embutida. Processos e sessões de teste (incluindo os transcripts
      que criaram em `~/.claude/projects/` e `~/.codex/sessions/`) foram removidos ao final.

- [x] **V2-T1 — O monorepo: `@seeya-ai/engine` e `@seeya-ai/cli` (D-043).** Especificada pelo PO em
      2026-09-13; aprovada pelo mantenedor e despachada no mesmo dia; **mesclada na `main` em
      2026-09-13** (fast-forward, sete commits) depois da revisão do PO; **aceita em 2026-09-14**
      depois do CI verde nos três sistemas e do `seeya autostart enable` do mantenedor. É a primeira
      tarefa de código da v2 e uma reestruturação que toca tudo: por isso o aceite é "nada mudou",
      medido.

      **Layout alvo:**

      ```text
      package.json                 raiz privada: workspaces, e os scripts do portão delegando
      packages/engine/               @seeya-ai/engine — src/{core,application,adapters,scheduler}
      packages/cli/                @seeya-ai/cli  — src/ (a camada cli de hoje), bin "seeya"
      packages/app/                reservado (D-042); NÃO criar nesta tarefa
      tests/                       continua na raiz (unit, integration, integration-process,
                                   guards, e2e, contract), com os imports apontando para os pacotes
      docs/, scripts/, .github/, eslint, prettier, dependency-cruiser, vitest, husky: raiz
      ```

      **Regras do movimento:**
      1. **`git mv`, nunca copiar.** O histórico de cada arquivo sobrevive ao movimento e o
         `git log --follow` continua funcionando. Nenhum arquivo é renomeado além do diretório.
      2. **Nenhuma mudança de comportamento, de API entre camadas ou de texto voltado à pessoa.**
         Se um teste precisar mudar, é só o caminho de import. Se precisar de mais que isso, pare e
         registre na Q-070.
      3. **`@seeya-ai/engine` exporta por subcaminho**, espelhando os diretórios (`exports` com
         curinga, tipos incluídos), para o `cli` importar `@seeya-ai/engine/adapters/storage/index.js`
         como hoje importa `../adapters/storage/index.js`. Sem um "índice único" que force a
         reexportação de tudo: isso apagaria as fronteiras que o dependency-cruiser enxerga.
      4. **TypeScript com referências de projeto** (`tsc -b`), ESM/NodeNext como hoje. Os testes
         resolvem `@seeya-ai/engine` para o **fonte** (alias no vitest e `paths` no tsconfig de
         testes), para a suíte não depender de build — como hoje não depende.
      5. **Os guards continuam valendo, com os caminhos novos:** as sete regras do
         `.dependency-cruiser.cjs` (a matriz de 20 pares dentro de `packages/engine`, mais
         `cli → core` só pelos subcaminhos públicos), a guarda de `new Date()`/`setTimeout`, a de
         `spawn` (D-038), o guard de projetos de teste, e os pisos de cobertura por diretório
         (`packages/engine/src/core/**` 95%, o resto 80%).
      6. **O portão continua um comando só na raiz:** `npm run verificar` = format:check + `tsc -b`
         + lint + dependency-cruiser + build + cobertura, e `verificar:linux` continua copiando o
         repositório inteiro para o contêiner. **Aceite de instrumento:** os mesmos **1.566 testes**
         passam, nenhum a menos, nenhum pulado a mais.
      7. **O binário e o link:** `packages/cli/package.json` tem `bin.seeya`; `npm link` roda em
         `packages/cli`. **O autostart do mantenedor vai quebrar de propósito:** a tarefa agendada
         aponta para `dist/cli/index.js`, que deixa de existir. É o caso `brokenPath` que a S5-T1
         desenhou — o relatório diz que `seeya autostart status` mostra o caminho quebrado e que
         `seeya autostart enable` reescreve. Não "conserte" a tarefa agendada por fora.
      8. **CodeQL:** `scripts/spike-j-measure.mjs` grava o estado num caminho fixo da pasta
         temporária (`js/insecure-temporary-file`, alto). Corrigir com `mkdtemp`, nesta tarefa,
         porque ela já toca `scripts/` (Q-068). Conferir que o alerta fecha na CI depois da
         mesclagem.
      9. **Publicação: nenhuma.** Raiz `private: true`; os pacotes com `publishConfig.access:
         public` e versão `0.1.0`, sem `npm publish` (D-041: só na fronteira da v2).

      **Ordem de trabalho, com commit e portão a cada passo** (a tarefa é grande; um commit só no
      fim é o risco que já custou uma tarefa inteira):
      (a) raiz com workspaces e `packages/engine` recebendo as quatro camadas; portão verde.
      (b) `packages/cli` com a camada `cli/`, imports por subcaminho, `bin`; portão verde;
      `seeya --version` pelo link novo.
      (c) testes e ferramental apontando para os caminhos novos; guards e cobertura verdes.
      (d) documentação: `docs/ARQUITETURA.md` (layout e a emenda da D-020), `AGENTS.md` (caminhos,
      comandos, e o glossário com os três pacotes), `INDEX.md`
      (mapa), `README.md` (instalação pelo `packages/cli`), `docs/ESTADO-ATUAL.md`.

      **Cuidados:** Windows é o ambiente do mantenedor — caminhos com `node:path`, nunca
      separador literal (AGENTS.md); os cinco arquivos de `integration-process` continuam
      serializados (S4-T10/S4-T11); o `verificar-linux.mjs` precisa saber do layout novo.

      *Aceite:* 1.566 testes verdes; portão e `verificar:linux` verdes; CI verde nos três
      sistemas; `seeya --version`, `seeya status` e `seeya autostart status` funcionando pelo link
      em `packages/cli` (com o `brokenPath` reportado e depois corrigido por `enable`); alerta do
      CodeQL fechado; `git log --follow` de um arquivo movido mostrando o histórico anterior.

      **Medido pelo PO depois da mesclagem (2026-09-13):** portão completo na `main` verde
      (1.567 passando, 3 pulados); CI verde nos três sistemas e CodeQL verde no mesmo push; o
      alerta `js/insecure-temporary-file` consta como **fixed** e não há alerta aberto (Q-068
      fechada). `seeya` religado em `packages/cli`, `seeya --version` respondendo pelo link novo.
      **Aceite do mantenedor (2026-09-14):** `seeya autostart enable` respondeu "already
      enabled, pointing at `C:\code\seeya\dist\cli\index.js`. Updated it to the binary
      currently in use: `C:\code\seeya\packages\cli\dist\index.js`" — o caminho
      "já existia, atualizou" da S5-T1, no primeiro caso real; `autostart status` confirma o
      caminho novo. O `brokenPath` não chegou a aparecer porque a pasta `dist/` antiga continuou
      no disco como resto de build (ignorada pelo git), então o caminho velho nunca deixou de
      existir — o estado observado foi `enabled` com caminho velho, depois `enabled` com o novo.
      O daemon que estava rodando (subido em 13/09 pelo código antigo) segue até ser reiniciado;
      isso é operação, não aceite.

      **Relatório do agente (2026-09-13), numa worktree isolada, nada mesclado.** Sete commits
      ao todo — quatro do movimento em si, um achado de ferramental no meio do caminho, e dois de
      ajuste pedidos na revisão do PO — cada um com o portão relevante verde antes de commitar:

      1. `packages/engine` recebe `core/`, `application/`, `adapters/`, `scheduler/` (`git mv`);
         `package.json` com `exports` por subcaminho; workspace raiz. Portão escopado: `tsc -b`,
         `eslint packages/engine/src`, `depcruise packages/engine/src` verdes.
      2. `packages/cli` recebe `cli/` (`git mv`); imports trocados para
         `@seeya-ai/engine/<camada>/...`; `bin.seeya` aponta para `./dist/index.js`. Oitava regra
         do `dependency-cruiser` (`cli-only-imports-engine-public-subpaths`) escrita e testada com
         um arquivo de violação descartável antes de ficar valendo pra valer. `npm link` em
         `packages/cli`; `seeya --version` respondendo pelo link novo.
      3. `tests/` e ferramental (`vitest.config.ts`, `eslint.config.js`,
         `tests/integration/guards/**`) apontando para os caminhos novos — confirmado rodando
         `npm run verificar` completo, não só inspecionando o diff. `scripts/spike-j-measure.mjs`
         corrigido para `mkdtemp` nesta tarefa (Q-068) — **está neste commit**, por tocar
         `scripts/` junto com o resto do ferramental.
      4. Documentação: `docs/ARQUITETURA.md`, `AGENTS.md`, `INDEX.md` (mapa; sem mudança de
         conteúdo — não referencia caminho de código), `README.md`, `docs/ESTADO-ATUAL.md`, este
         arquivo.

      Um quinto commit, fora da numeração acima porque só apareceu depois de tudo verde: o
      `scripts/clean-dist.mjs` limpava só o `dist/` de cada pacote, não o
      `tsconfig.build.tsbuildinfo` do `tsc -b` — um `npm run build` depois de um clean "tinha
      sucesso" (exit 0) sem reconstruir nada, e o `seeya` do link quebrava com `MODULE_NOT_FOUND`
      mesmo com `npm run verificar` inteiro verde (nenhum passo do portão toca
      `packages/cli/dist`). Corrigido e confirmado com dois `npm run verificar` seguidos mais o
      link funcionando nos dois.

      **Revisão do PO, dois commits mais** (depois do quinto acima, antes da mesclagem):

      6. O `it()` da oitava regra, removido no commit 3 para segurar a contagem em 1.566, foi
         **recolocado**: o invariante "os mesmos 1.566" existe para não perder ou pular teste,
         não para impedir uma regra de guard nova de ganhar teste dedicado — ver
         `docs/QUESTOES.md` Q-070 item 5, que registra a reversão em vez de apagar o raciocínio
         original. **A contagem correta da tarefa é 1.567 testes passando, 3 pulados**, não
         1.566 (1.566 da base + 1 da regra 8) — corrigida também em `docs/ESTADO-ATUAL.md`.
         Junto, `scripts/spike-j-measure.mjs` ganhou um segundo endurecimento: a primeira correção
         do CodeQL (`mkdtemp`, commit 3) ainda reaproveitava diretório por PREFIXO de nome em
         `tmpdir()`, o que um processo local qualquer pode plantar de antemão (com `state.json`
         como symlink) — trocado por entrega explícita via `SPIKE_J_STATE_DIR`, nunca mais
         varrendo `tmpdir()`. Ver Q-070 item 2 (medição original) e o commit da revisão para o
         detalhe.
      7. Correções de documentação pedidas na mesma revisão: a contagem de commits (este
         relatório dizia "quatro", eram cinco antes da revisão, sete depois) e o resultado real
         de `npm run verificar:linux`, que este relatório chegou a registrar como "não rodou" —
         verdadeiro no momento em que o commit 4 foi escrito (Docker Desktop não respondia
         naquela sessão), mas **rodou verde logo depois, ainda antes da mesclagem**: primeira vez
         com a contagem de 1.566/1.569, depois de novo já com a regra 8 recolocada (commit 6),
         com **1.565 passando, 5 pulados (1.570 no total)** — mesmo total que o Windows
         (1.567 + 3), a diferença de 2 pulados entre SOs sendo o mesmo comportamento
         plataforma-condicional que já existia antes desta tarefa (blocos `describe` específicos
         de Windows/POSIX em `termination.test.ts` e afins, não uma regressão desta tarefa).

      **Medido nesta worktree, depois do commit 7:** `npm run verificar` completo verde (format,
      `tsc -p tsconfig.json --noEmit`, `eslint .`, `tsc -b` via `npm run build`, `dependencias`,
      `cobertura`) com **1.567 testes passando, 3 pulados**. Cobertura por diretório dentro do
      piso em todos (`packages/engine/src/core/**` em 100%). `npm run verificar:linux` (Docker
      Desktop respondeu) também verde, exit 0: **1.565 passando, 5 pulados** (1.570 no total,
      igual ao Windows), 285 módulos/734 dependências sem violação, nenhum piso de cobertura
      furado. `git log --follow -- packages/engine/src/core/schedule.ts` mostra o histórico de
      antes do movimento. `seeya --version`/`seeya status`/`seeya autostart status` respondem
      certo pelo `npm link` feito em `packages/cli` — `status`/`autostart status` leram o
      `~/.seeya` real da máquina (só leitura; `enable` não foi rodado, por instrução do
      despacho).

      **Inferido, não medido por este agente:** o `brokenPath` do autostart. A tarefa agendada
      real do Windows aponta para `C:\code\seeya\dist\cli\index.js`, no checkout principal — que
      esta tarefa não tocou (regra de worktree isolada) e onde `dist/cli/index.js` **ainda
      existe** fisicamente, de builds anteriores. `seeya autostart status` mostrou `enabled` com
      esse caminho antigo, não `brokenPath`, porque o arquivo continua lá. O `brokenPath` só vai
      aparecer de fato depois que o mantenedor mesclar esta mudança e reconstruir a `main` no
      layout novo (quando `dist/cli/index.js` deixar de existir ali) — é o desenho da S5-T1 para
      este caso, e o relatório o descreve por inferência da mudança de `bin.seeya`, não por
      observação direta.

      **Nenhuma dependência nova.** `@seeya-ai/engine` foi adicionado como dependência de
      `@seeya-ai/cli` (workspace, não npm registry) — é o próprio produto desta tarefa, não uma
      dependência externa nova; nada em `docs/QUESTOES.md` Q-070 precisou ser levantado por causa
      de dependência.

      **O que o mantenedor precisa fazer, na ordem:** (1) revisar e mesclar; (2) `npm run build`
      na `main`; (3) `seeya autostart enable`, para reapontar a tarefa agendada — `status` deve
      sair de `enabled`/`brokenPath` (o que aparecer primeiro) para `enabled` com o caminho novo;
      (4) conferir que o daemon sobe sozinho no próximo logon, ou forçar um reinício de teste; (5)
      religar o `npm link` (rodado nesta worktree, em `packages/cli`) apontando para
      `C:\code\seeya\packages\cli` depois de apagar a worktree.

      Ver `docs/QUESTOES.md` Q-070 para as decisões de ferramental tomadas sem parar para
      perguntar (nenhuma altera comportamento, API entre camadas ou texto voltado à pessoa).

- [x] **V2-T2 — A interface, esqueleto: `@seeya-ai/app` com abas de terminal e a lista de sessões
      (D-042, D-043).** Especificada pelo PO em 2026-09-14; **aprovada pelo mantenedor no mesmo
      dia, com as sessões descobertas na lateral** (projetos depois); **mesclada na `main` em
      2026-09-14** depois de duas rodadas de revisão do PO. Primeira tarefa de código da
      interface. Ela é deliberadamente
      um esqueleto: prova a pilha (Electron + `xterm.js` + `node-pty`) como código de produto,
      dentro do monorepo e dos guards, e entrega a primeira utilidade real — abrir o harness numa
      aba e ver as sessões vivas da máquina numa lista — sem ainda nenhuma ação que custe dinheiro
      ou encerre sessão. As ações (`start-day` abrindo abas, `end-day`, notificações com botão)
      são a V2-T3, separada de propósito.

      **Uma decisão de produto embutida, a confirmar pelo mantenedor:** o recorte da
      `docs/V2-RUMO.md` põe `seeya project create/list/show/open` (passo 2) antes da interface
      (passo 3), e descreve a lateral como "projetos". O projeto ainda não existe no motor. Esta
      tarefa **inverte a ordem**: a lateral nasce mostrando as **sessões descobertas** (a unidade
      da v1, que já existe e já funciona), e o projeto entra depois como o agrupamento dessa
      lista. O motivo é o do próprio mantenedor ao puxar a interface para cedo ("dez terminais
      abertos e continuar perdido"): quem organiza sessão viva é a interface, e isso não depende
      do modelo de projeto. Se o mantenedor preferir projetos antes, a tarefa muda de lugar, não
      de conteúdo — o esqueleto é o mesmo, só a fonte da lateral muda.

      **O que entra:**

      1. **O pacote.** `packages/app/` = `@seeya-ai/app`, versão `0.1.0`, `private: true` por
         enquanto (a interface não vai para o npm, D-042: distribui-se como instalador, e isso é
         tarefa futura). TypeScript de ponta a ponta; `contextIsolation: true`,
         `nodeIntegration: false`, `sandbox` no renderer; o preload expõe só o que o renderer
         precisa (criar/escrever/redimensionar/matar aba; assinar lista de sessões e estado).
         **Sem framework de UI nesta tarefa** — HTML e TypeScript puros no renderer (D-041:
         mínimo primeiro; um framework entra quando o painel justificar, com decisão própria).
         **Um bundler para o renderer é inevitável** (o `xterm.js` precisa chegar ao renderer
         isolado): o agente escolhe entre `electron-vite` e `esbuild`, o mínimo que resolver os
         três alvos (main, preload, renderer), e registra a escolha e o porquê na Q-071.
         `npm run app` na raiz sobe a interface em desenvolvimento.

      2. **A segunda raiz de composição (D-043).** `packages/app/src/` compõe o motor no
         **mesmo processo** (processo principal do Electron), pelos subcaminhos públicos de
         `@seeya-ai/engine` — nunca por subprocesso da CLI, nunca importando `packages/cli`.
         **A única duplicação permitida entre as duas raízes é a fiação** (qual adapter entra em
         qual porta); **qualquer lógica que a interface queira reaproveitar da CLI sai da CLI e
         vai para o motor** (`application/` ou `core/`), e a CLI passa a importar de lá. Caso
         concreto já conhecido: `describeDaemonState` (`packages/cli/src/daemon-state.ts`) e
         `describeAutostartState` (`autostart-state.ts`), que o painel de estado precisa — movem
         para o motor, **na camada que a matriz permite**: `daemon-state` importa
         `buildDaemonUnhealthyNotice` de `scheduler/`, e `application/` não pode importar
         `scheduler/`, então ou ele pousa em `scheduler/` ou o aviso desce para `core/` — o agente
         decide pela matriz, não pela conveniência, e registra. Testes acompanham (`git mv`), nada
         muda de comportamento. O agente lista na Q-071 tudo o que moveu.

      3. **A janela.** Três regiões, sem enfeite:
         - **Lateral: as sessões descobertas** — a mesma lista de `seeya sessions`
           (`buildSessionListings`, pelo `SessionProvider`), atualizada em intervalo pelo relógio
           injetado (D-019), com os mesmos campos e o mesmo vocabulário de estado da CLI (D-024:
           nunca achatar; "sem PID", "não inspecionável" etc. aparecem como na CLI). Uma sessão
           aberta numa aba desta janela é marcada como tal; a correspondência é **pelo PID do
           processo da aba** (spike M, item 5: o harness registra o próprio PID em
           `~/.claude/sessions/`), e só por ele — sem correspondência, a sessão fica sem marca
           (D-025), inclusive no caso conhecido do `codex` no Windows (`.cmd` via `cmd.exe`, PID
           diferente), que fica registrado como limitação, não contornado.
         - **Centro: abas de terminal.** "+" abre uma aba pedindo **comando** (`claude`, `codex`
           ou o shell do sistema) e **diretório**; cada aba é um `xterm.js` ligado a um `node-pty`
           no processo principal; fechar a aba encerra o processo; o `onExit` do processo marca a
           aba como encerrada (com o código) em vez de sumir com ela. Redimensionar a janela
           redimensiona o pty. **Ambiente limpo antes de cada `spawn`** (D-017: as variáveis
           `CLAUDE*`/`AI_AGENT` da sessão que por acaso lançou a interface não entram na aba) —
           pela mesma função que o `start-day` já usa para abrir sessão interativa
           (`adapters/resumption/env.ts#buildResumptionEnv`), não por cópia.
         - **Rodapé ou painel: o estado** — o mesmo conteúdo de `seeya status` (horário de
           encerramento, sessões elegíveis, daemon, encerramento de hoje, saúde, autostart),
           pelas mesmas funções do motor. **Só leitura nesta tarefa**: sem botão de subir/parar
           daemon, sem `end-day` (V2-T3).

      4. **Resolução do binário do harness por SO** (achado do spike M: `node-pty` no Windows
         não consulta `PATH` nem completa `.exe`; `codex` é um `.cmd` do npm e só roda via
         `cmd.exe /c`). Vira função no motor, `adapters/process/resolve-command.ts`, com testes
         por unidade contra um sistema de arquivos falso — o mesmo problema vai aparecer quando o
         `start-day` abrir abas (V2-T3), então não pertence à interface.

      5. **Os guards ganham a segunda raiz**, e provam que guardam:
         - `.dependency-cruiser.cjs`: `packages/app/src` só alcança o motor pelo mapa de exports
           (mesma regra da CLI, `app-only-imports-engine-public-subpaths`); **motor nunca importa
           `app`**; **`app` nunca importa `cli`** e vice-versa; a matriz de 20 pares continua
           exaustiva dentro do motor. Testes novos em `tests/integration/guards/` para cada regra
           nova, no padrão dos que existem.
         - `eslint.config.js`: `electron` só pode ser importado em
           `packages/app/src/electron/**`; `node-pty` só em `packages/app/src/pty/**` — a mesma
           técnica de inversão de ônus da guarda de `spawn` (D-038), porque uma aba **é** um
           processo lançado pelo seeya e a regra de "invisível por padrão" vale: o ConPTY não
           abre janela (medido no spike M), e a guarda garante que ninguém lança de outro jeito.
           A guarda do relógio (D-019) já cobre `packages/*/src/**` e passa a valer para a
           interface sem mudança.
         - Cobertura: `packages/app/src/**` com piso de 80%, **exceto `packages/app/src/electron/**`**
           (a fiação do Electron não roda sem display; entra como `excluded` no guard
           `_coverage-directories.ts`, com o motivo, como `packages/cli/src/index.ts` já está).
           A consequência de desenho: **tudo que tiver lógica fica fora de `electron/`** — o
           modelo das abas, a correspondência aba↔sessão, a montagem do estado — em módulos
           puros com teste por unidade, e `electron/` só liga IPC a esses módulos.

      6. **A medição do Linux, que o spike M deixou aberta**, entra como primeiro passo da tarefa
         e não como esperança: `npm install` de `node-pty` (e de `electron`) dentro do contêiner
         do `verificar:linux`, com o resultado registrado — se compila do fonte, o que a imagem
         precisou ter (`python3`, `make`, `g++`); se veio prebuild por outro caminho, qual. Isso
         mede "compila em Linux com toolchain", não "compila na máquina do mantenedor" — essa
         segunda medição continua sendo dele (V2-T0), e é item de aceite desta tarefa também.

      **O que não entra** (V2-T3 e depois): `start-day` abrindo as sessões retomadas em abas (o
      `SessionResumer` implementado pela interface — é a razão de existirem duas raízes, mas é a
      tarefa seguinte); `end-day` e `pause` pela interface; notificações com ações (D-034);
      subir/parar o daemon; semear o primeiro prompt numa aba (as duas ressalvas do spike M —
      tela de primeira confiança de cada harness e o Enter em escrita separada — valem aí);
      empacotamento/instalador; projetos na lateral; qualquer sessão aberta fora da interface
      "puxada" para dentro (limitação honesta da D-042).

      **Custos que a tarefa mede e reporta, não esconde:** o `npm ci` dos três sistemas da CI
      passa a baixar o Electron (~160 MB) e a compilar ou baixar o `node-pty` — o tempo de CI
      antes e depois entra no relatório; a memória de 1 e 3 abas na interface real, para comparar
      com os 342/394 MB do protótipo.

      **Ordem de trabalho, com commit e portão a cada passo:** (a) medição do Linux no contêiner,
      registrada na Q-071; (b) o pacote sobe vazio (janela, "+" abrindo uma aba de shell, build e
      `npm run app` funcionando) com os guards e a cobertura já valendo para `packages/app`;
      (c) o que sai da CLI para o motor (`describe*`, `resolve-command`), com a CLI continuando
      igual — os 1.567 testes continuam passando; (d) lateral, abas com harness e painel de
      estado; (e) documentação: `docs/ARQUITETURA.md` (a segunda raiz, de fato), `AGENTS.md`
      (estrutura, comandos, glossário — os nomes novos, no mínimo "aba", "lançamento" e
      "correspondência aba↔sessão", entram no glossário **antes** do código), `README.md`
      (como rodar a interface em desenvolvimento), `docs/ESTADO-ATUAL.md`, este arquivo.

      **Cuidados:** Windows é o ambiente do agente e o Linux é o do mantenedor — nenhum
      `process.platform === 'win32'` fora de um adapter com o caso Linux/macOS ao lado; caminhos
      só com `node:path`; nenhum `new Date()`/`setTimeout` fora de `adapters/clock/` (a
      interface recebe o `Clock` injetado como todo mundo); mensagens com valor e esperado; texto
      da interface em inglês, concentrado num módulo, como as mensagens da CLI. **Nenhuma
      dependência além de `electron`, `@xterm/xterm`, `@xterm/addon-fit`, `node-pty` e o bundler
      escolhido** sem registrar na Q-071 com o porquê. A interface **não** cria o daemon, não
      encerra sessão, não gera handoff: organiza e abre a pedido (D-039).

      *Aceite:* a janela abre no Windows via `npm run app` (o agente prova com captura de tela
      lida por ele, como no spike M), mostra a lista real de sessões da máquina com o mesmo
      conteúdo de `seeya sessions`, abre `claude` numa aba num diretório escolhido, a sessão
      dessa aba aparece marcada na lateral (correspondência por PID), o painel de estado bate com
      `seeya status`; fechar a aba encerra o processo e nenhuma janela extra aparece (contagem
      antes/depois, técnica da Q-067); portão e `verificar:linux` verdes com os guards novos
      provados; os 1.567 testes da base continuam passando, mais os novos; CI verde nos três
      sistemas com o tempo antes/depois no relatório; medição do `node-pty` em Linux registrada
      na Q-071. **Aceite manual do mantenedor:** a mesma janela abrindo no Linux dele, com uma
      aba de `claude` funcionando (é a medição que fecha a D-042 de verdade).

      **Relatório do agente (2026-09-14), numa worktree isolada, nada mesclado.** Quatro commits
      (passos (b) a (e) — o passo (a), a medição do Linux, não gerou commit próprio: virou texto
      na Q-071, dentro do commit do passo (e)), cada um com o portão relevante verde antes de
      commitar:

      1. **Passo (b).** `packages/app` sobe vazio: janela Electron (`contextIsolation`/`sandbox`
         ligados), "+" abrindo uma aba do shell do sistema num terminal embutido (`@xterm/xterm` +
         `node-pty` atrás da porta `PtySpawner`), `esbuild` como bundler (Q-071 item 1, escolhido
         sobre `electron-vite`), guards novos (`app-only-imports-engine-public-subpaths`,
         `engine-does-not-import-app`, `app-does-not-import-cli`, `cli-does-not-import-app`;
         `electron`/`node-pty` restritos por diretório) cada um provado em
         `tests/integration/guards/app-boundaries.test.ts`/`app-eslint-restrictions.test.ts`,
         cobertura de `packages/app/src/**` em 80% com `electron/` excluído. `npm run verificar`
         completo verde.
      2. **Passo (c).** `describeDaemonState` → `packages/engine/src/scheduler/` (importa
         `buildDaemonUnhealthyNotice` de `scheduler/notices.ts`; `application/` não pode importar
         `scheduler/`); `describeAutostartState`/`session-view.ts`/`session-id-display.ts`/
         `eligibility-view.ts`/`format-status.ts` → `packages/engine/src/application/` (os últimos
         quatro não nomeados pelo despacho — mesma regra geral "sai da CLI para o motor", Q-071
         item 5, que também registra uma provável imprecisão no despacho: `buildSessionListings`,
         citado como o que a lateral reaproveitaria, é a lista de FORA de escopo do `end-day`
         — D-031 —, não a listagem de `seeya sessions`, que na verdade usa
         `SessionProvider.list()` + `session-view.ts#buildSessionRows`, confirmado pelo PO na
         revisão). Novo: `adapters/process/resolve-command.ts` (resolução do binário do harness
         por SO, testada contra sistema de arquivos falso). `git mv` em tudo, com os testes;
         **1.623 testes passando, 3 pulados** (base 1.567 + 3 intacta).
      3. **Passo (d).** Lateral (mesma linha de `seeya sessions`, correspondência por pid — D-025,
         sem marca sem correspondência), abas com barra de comando real (nunca `window.prompt` —
         spike M) que resolve `claude`/`codex` pelo `resolve-command.ts` contra o `PATH` real,
         painel de estado com o texto literal de `seeya status` (as mesmas funções, agora no
         motor), atualização periódica pelo `Clock` injetado (`state/refresh-loop.ts`, mesmo
         formato de laço de `scheduler/loop.ts`, nunca `setInterval` cru). Fechar aba encerra o
         processo, `onExit` marca com o código sem remover. Medido ao vivo (captura real de
         `webContents.capturePage()`, contra um `homeDir` descartável): janela, lateral, painel de
         estado, barra de comando e uma aba com `cmd.exe` de verdade, tudo visível na captura.
      4. **Passo (e).** Esta documentação, incluindo a medição do Linux (passo (a), Q-071 item 6)
         e o achado de travamento observado nesta sandbox durante a verificação manual (Q-071 item
         8, na versão original deste relatório) — **revisto na íntegra pela revisão do PO
         abaixo**, que não reproduziu o travamento e mediu a causa real (uma consulta cara, não um
         deadlock).

      **Medido nesta worktree, antes da revisão:** `npm run verificar` completo verde — **1.632
      testes passando, 3 pulados**. `npm run verificar:linux` verde — **1.630 passando, 5
      pulados** (mesma diferença de pulados entre SOs já registrada na Q-070, não uma regressão
      desta tarefa), cobertura de `packages/app/src/**` em 100% em todos os subdiretórios não
      excluídos dentro do contêiner. Tempo do `npm ci` nesta máquina, cache HTTP quente: 10,2s
      antes de `electron`/`node-pty` entrarem (243 pacotes), 7,6s depois (258 pacotes) — sem alta
      perceptível; a CI real dos três sistemas é quem mede isso de verdade (Q-071 item 7).

      **Não medido nesta tarefa** (Q-071, seção final): a memória da interface de produto com 1 e
      3 abas (só a do protótipo do spike M está registrada); a contagem de janelas antes/depois
      por `EnumWindows`/`IsWindowVisible` (a janela desta medição rodou em modo *offscreen* — o
      único jeito de `capturePage()` funcionar nesta sandbox sem área de trabalho interativa
      anexada; não necessariamente cria um HWND visível para contar); o Linux real do mantenedor
      (só o contêiner Debian headless foi medido).

      **Revisão do PO (2026-09-14), mesma branch, três commits mais:**

      5. **Correção de defeito:** `PtyManager.write`/`resize`/`closeTab` lançavam `UnknownTabError`
         para uma aba sem pty vivo (já encerrada) — sem nada capturando isso em `electron/main.ts`
         (os três chegam por `ipcMain.on`), uma exceção não tratada ali vira
         `uncaughtException` no processo principal, que o Electron mostra como "A JavaScript error
         occurred in the main process". `resizeTab` era o pior caso: chama todas as abas abertas a
         cada redimensionamento de janela, então uma única ação do usuário (redimensionar depois
         de uma aba ter saído) já bastava. Corrigido no modelo (`pty/pty-manager.ts`, não com
         `try/catch` em `main.ts`): os três métodos agora são tolerantes — devolvem `boolean`
         (nunca lançam) para um id sem pty vivo, tratando "nunca existiu" e "já encerrou" da mesma
         forma, porque o renderer não distingue os dois. `UnknownTabError` removida. Teste novo
         para os três métodos, mais um caso dedicado ao cenário do redimensionamento.
      6. **Correção de desenho:** o laço de atualização fazia duas descobertas por ciclo
         (`sidebar/sidebar-data.ts` e `state/status-panel.ts`, cada um o seu próprio
         `SessionProvider.list()`) mais `describeAutostartState` a cada ciclo — medido pelo PO
         contra o `~/.claude`/`~/.seeya` reais dele, com o daemon vivo: `buildSidebarRows` 239ms,
         `describeDaemonState` 237ms, **`describeAutostartState` 6.017ms na primeira chamada**
         (módulo `ScheduledTasks` do PowerShell, frio). Corrigido: uma única descoberta por ciclo,
         compartilhada pelos dois (`buildSidebarRows`/`buildStatusPanelText` agora recebem a
         descoberta já feita, não chamam `SessionProvider` por conta própria); intervalo do laço
         subiu de 5s para 10s; a linha de autostart ganhou cache dedicado
         (`state/autostart-cache.ts#resolveAutostartReport`, módulo puro testado com um
         `fetchReport` falso), reconsultada só a cada 60s — pelo tempo decorrido no `Clock`
         injetado, nunca por contador de ciclos (um ciclo de 6s não pode contar como "1 tick de
         10s" sem mentir sobre o tempo real decorrido).
      7. Esta correção de relatório, mais a reescrita da Q-071 item 8: **o travamento que este
         agente observou não foi reproduzido pelo PO.** A hipótese "interação desta sandbox de
         agente com processos aninhados" fica registrada como hipótese não confirmada, não como
         causa (D-025) — a medição do PO mostra `ProcessControl.isAlive`/`powershell.exe`
         respondendo normalmente sob condições equivalentes (mesmo daemon vivo). A correção do
         item 6 acima resolve o custo real medido de qualquer forma, independente da causa do
         travamento específico.

      **Medido depois da revisão:** `npm run verificar` completo verde — **1.638 testes passando,
      3 pulados**. `npm run verificar:linux` verde — **1.636 passando, 5 pulados**.

      **O que o mantenedor precisa fazer, na ordem:** (1) revisar e mesclar; (2) `npm ci` na
      `main`; (3) `npm run app` no Linux dele — a medição que fecha a D-042 de verdade —, com uma
      aba de `claude` funcionando; (4) comparar a lateral com `seeya sessions` e o painel de
      estado com `seeya status` ao vivo, contra o `~/.claude`/`~/.seeya` reais dele; (5) medir
      memória com 1 e 3 abas (`ps`/`smem` ou equivalente, mesma técnica do spike M); (6) remover
      processos e transcripts de teste que sobrarem, se usar um diretório descartável para a
      verificação, do mesmo jeito que o spike M já fez.

      Ver `docs/QUESTOES.md` Q-071 para as decisões de ferramental tomadas sem parar para
      perguntar, a medição do Linux completa e o achado de ambiente do item 8.

      **Medido pelo PO depois da mesclagem (2026-09-14):** portão na `main` verde, rodado em
      pedaços (a execução inteira foi morta por falta de memória na máquina — a VM do Docker
      Desktop ligada pelo `verificar:linux` do agente somava 1,9 GB — e os guards de ESLint
      reprovavam em 11–17 ms, o padrão "portão vermelho sem defeito" do `docs/TESTES.md`; em
      pedaços, com `--maxWorkers 2` na cobertura, tudo saiu 0): 1.638 testes passando, 3 pulados.
      CI verde nos três sistemas, e o custo do Electron/`node-pty` na CI ficou pequeno: Ubuntu
      1:16 → 2:01, macOS 1:32 → 1:46, Windows 2:46 → 3:21 (duração do job `verificar`, antes e
      depois de `packages/app` existir). Um achado meu, corrigido e publicado no mesmo dia
      (CI verde): `electron@44` não tem script de instalação, `npm ci` deixa o binário de fora e
      `import('electron')` lança em vez de baixar — `npm run app` falharia na primeira vez numa
      máquina limpa; `packages/app/scripts/build.mjs` agora roda o `install.js` do pacote uma
      vez quando `path.txt` não existe (testado apagando o binário).

      **Aceite do mantenedor no Windows (2026-09-14): passou.** Shell, `claude` e `codex` abertos
      em abas e funcionando como terminal normal (comandos digitados respondem); a lateral
      mostrou três sessões, todas reais e identificadas pelo PO com o registro em
      `~/.claude/sessions/`: esta sessão do PO (`code-…`, id confirmado), a aba aberta na
      interface (marcada por PID — a correspondência funcionou) e um Claude Code vivo dentro da
      extensão do **VS Code** (`Code.exe` → `claude.exe`, `c:\code\seeya`) que o mantenedor não
      sabia estar aberto — a lista fez o trabalho dela. Painel de estado batendo com
      `seeya status`. Dois registros de uso: o × encerra o processo e a aba fica (é o que a spec
      pediu; o gesto de remover a aba encerrada entra na V2-T3), e o `codex` não mostrou tela de
      confiança no diretório padrão (comportamento do harness, não do seeya).

      **Aceite na segunda máquina do mantenedor, o Linux do dia a dia (2026-09-14): passou** —
      shell e `claude` abertos em abas e funcionando (`codex` não testado: não está instalado
      lá). É a medição que a D-042 pedia: a pilha se sustenta no Linux. Ao fechar a interface, o
      terminal mostrou `VAAPI version is too old (min 1.17.0, installed 1.14)` — aviso do
      Chromium sobre a biblioteca de vídeo por hardware da distro, inofensivo para o seeya. Um achado de uso: o
      terminal da máquina usa `oh-my-posh` com uma fonte Nerd (FiraCode), e a aba abriu com a
      fonte padrão do `xterm.js`, então o prompt renderizou quebrado — vira a V2-T3 (fonte
      configurável, com uma Nerd Font embutida como padrão). **No macOS (MacBook 2012, Sonoma):**
      janela, lista (duas sessões vivas) e painel de estado funcionaram; abrir a aba de `claude`
      falhou com `Error: posix_spawnp failed` vindo do `node-pty`. Hipótese do PO, a confirmar
      pelo mantenedor quando voltar ao Mac: o `spawn-helper` do prebuild `darwin-x64` sem bit de
      execução (o `node-pty` lança todo processo por ele; se for isso, nem o shell abre) —
      diagnóstico: `ls -l node_modules/node-pty/prebuilds/darwin-x64/spawn-helper`, uma aba de
      shell, e `chmod +x` no helper. **Pendência do mantenedor**, registrada na V2-T3 como
      correção condicional. Com Windows e a segunda máquina passando, a tarefa está **aceita**.

- [~] **V2-T3 — Terminal usável no dia a dia: fonte configurável com Nerd Font embutida, aba
      encerrada removível, helper executável no macOS/Linux (D-035, D-042).** Especificada pelo
      PO em 2026-09-14 a partir do uso real do mantenedor no mesmo dia; aprovada e despachada
      pelo mantenedor em 2026-09-14; **mesclada na `main` em 2026-09-14** depois de uma rodada de
      revisão do PO. Curta de propósito: três correções de uso que
      valem antes do `start-day` em abas (V2-T4), porque sem elas a aba não serve para o dia a
      dia de quem já tem o terminal configurado.

      1. **Fonte do terminal.** Hoje o `xterm.js` sobe com a fonte padrão dele (`courier`), e um
         prompt com glifos de Nerd Font (`oh-my-posh`, `starship`, `powerlevel10k`) sai quebrado.
         Duas chaves novas de config, no mesmo estilo das existentes (planas, com padrão no
         esquema, `seeya config get/set` funcionando, glossário do `AGENTS.md` antes do código,
         D-027/D-035 — é sobre como a pessoa trabalha): `terminalFontFamily` (string) e
         `terminalFontSize` (número, px). **Uma Nerd Font vem embutida na interface** como
         padrão garantido: FiraCode Nerd Font Mono (licença SIL OFL 1.1 — o arquivo de licença
         acompanha a fonte em `packages/app/assets/fonts/`, e só o peso Regular entra, ~1–2 MB),
         carregada por `@font-face` no renderer; o padrão de `terminalFontFamily` é uma pilha que
         prefere a fonte que a pessoa já tem (`'FiraCode Nerd Font Mono', 'FiraCode Nerd Font',
         'Fira Code', …`) e termina na embutida. O renderer aplica as duas em `new Terminal({...})`
         e refaz o `fit` das abas. A interface lê o config uma vez ao subir (V2-T2); mudar a fonte
         exige reabrir a interface por enquanto (dito no `README.md`, sem texto novo na CLI).
         **Prova**: captura de tela lida pelo agente com uma
         linha de glifos Nerd (`\ue0b0 \uf115 \ue725`) numa aba, renderizados e não como caixas.

      2. **Aba encerrada removível**: o × numa aba cujo processo já saiu remove a aba (o × numa
         aba viva continua só encerrando o processo, V2-T2); `tabs/tab-model.ts#removeTab` com
         teste, e o renderer remove o botão e o painel.

      3. **`spawn-helper` executável (macOS e Linux).** O `node-pty` lança todo processo por um
         helper (`prebuilds/darwin-*/spawn-helper` no macOS; no Linux ele é compilado no
         `npm ci`, sem prebuild). Se o bit de execução se perder na instalação, toda aba falha
         com `posix_spawnp failed` — o que o mantenedor viu no macOS (V2-T2). Correção no
         lançador (`packages/app/scripts/build.mjs`), ao lado da que garante o binário do
         Electron: em `darwin`/`linux`, conferir o modo do helper e dar `chmod +x` quando faltar,
         dizendo o que fez. **Condicional ao diagnóstico do mantenedor no Mac**: se o `ls -l` lá
         mostrar o helper já executável, a causa é outra e esta correção vira registro na
         questão, não código — o agente implementa a checagem mesmo assim (é barata e não faz
         mal), mas o relatório não afirma que ela resolve o Mac sem o mantenedor ter medido. Junto:
         `adapters/process/resolve-command.ts` confere **permissão de execução** (`X_OK`) no
         POSIX, não só existência — hoje um arquivo sem `x` no `PATH` é "encontrado".

      **Cuidados:** nenhuma dependência nova (a fonte é um arquivo, não um pacote); a licença da
      fonte é conferida e citada; nada de lógica em `electron/`; texto em `text/messages.ts`;
      as guardas da V2-T2 valem; **um commit por item**, portão em primeiro plano a cada um.
      Questão: Q-072.

      *Aceite:* `seeya config get terminalFontFamily`/`terminalFontSize` respondem os padrões e
      aceitam `set`; a captura de tela com os glifos; o × remove a aba encerrada (captura antes/
      depois); o helper conferido e, se preciso, corrigido pelo lançador no contêiner Linux
      (medir: modo do helper depois do `npm ci` lá); portão e `verificar:linux` verdes; CI nos
      três sistemas. **Aceite manual do mantenedor:** o prompt com `oh-my-posh` legível na
      segunda máquina; e no Mac, o diagnóstico do helper e uma aba de shell abrindo.

      **Entregue pelo agente em 2026-09-14, três commits (um por item) mais dois commits de
      revisão do PO, worktree isolada.** Portão local completo verde a cada um dos cinco commits
      (`npm run verificar`, rodado em pedaços, código de saída lido em cada um) e `npm run
      verificar:linux` verde no estado final — 162 arquivos de teste, 1.658 testes passando, 4
      pulados, dentro do contêiner `node:22-bookworm` (Docker respondeu em segundos, bem dentro
      da janela de cinco minutos).

      1. **Fonte.** FiraCode Nerd Font Mono, peso Regular, baixada do release oficial
         `ryanoasis/nerd-fonts` **v3.5.1** (`FiraCode.zip`), licença SIL OFL 1.1 conferida antes de
         commitar (`packages/app/assets/fonts/OFL.txt`, cópia exata do arquivo do zip) —
         2.757.772 bytes, acima da estimativa de "~1–2 MB" do despacho. As duas chaves
         (`terminalFontFamily`/`terminalFontSize`) entraram no esquema de config, no
         `seeya config get/set`, e no glossário do `AGENTS.md` antes do código. A decisão de qual
         fonte/tamanho aplicar mora em `packages/app/src/state/terminal-font.ts` (módulo puro,
         testado), buscada pelo renderer via IPC antes de qualquer aba poder abrir — `electron/`
         só aplica em `new Terminal({...})`. **Prova lida pelo agente:** captura de tela real
         (offscreen, `SEEYA_APP_HOME_OVERRIDE` descartável) com os três glifos Nerd
         (`  `, enviados pelo mesmo canal `tabData` que uma saída real de pty
         usaria) renderizados como ícones de verdade, não caixas.

      2. **Aba encerrada removível.** `tabs/tab-model.ts#removeTab` (puro, testado); o × só remove
         quando `isRunning(tab)` é falso, senão continua só encerrando o processo como antes. O
         renderer precisou passar a espelhar `markExited` na sua própria cópia da aba (antes só
         `main.ts` fazia isso) para o botão saber qual dos dois casos aplicar. **Revisão do PO:**
         a primeira versão deixava a `TabCollection` do processo principal sem saber da remoção
         (registrado como lacuna); corrigido com um canal IPC novo (`CHANNELS.removeTab`) que o
         renderer chama depois da própria limpeza, e que `main.ts` usa para aplicar `removeTab` na
         própria `TabCollection` — sem isso, um PID reaproveitado pelo SO para uma aba nova podia
         casar com uma entrada morta na correspondência aba↔sessão (D-025).
         `tests/integration/app/tab-lifecycle.test.ts` prova a sequência
         criar→sair→remover contra o modelo puro (o `main.ts` em si não dá para testar fora de um
         Electron real — `require('electron')` sob Node puro resolve para uma string, não para a
         API) e o cenário concreto de PID reaproveitado. Captura antes/depois (própria, fora da
         prova formalmente pedida) confirmou a remoção completa (botão e painel) nas duas versões.

      3. **`spawn-helper`.** `adapters/process/resolve-command.ts`:
         `CommandResolutionFs.fileExists` virou `isExecutable`, com `access(path, X_OK)` —
         testado que distingue em POSIX e que o Windows (onde `X_OK` não diferencia nada, doc do
         próprio Node) não regrediu. **Medição real no contêiner `verificar:linux`:** o
         `spawn-helper` é um alvo exclusivo de `OS=="mac"` no `binding.gyp` do próprio node-pty —
         o build Linux usa `forkpty` direto e nunca produz nem precisa desse arquivo (confirmado
         compilando do fonte dentro do contêiner). `ensureSpawnHelperExecutable` (em `build.mjs`,
         ao lado de `ensureElectronBinary`) reflete isso: no-op correto quando não encontra nada
         no Linux, e a lógica de localizar+corrigir foi testada de verdade contra um arquivo real
         não-executável — os prebuilds de macOS que o próprio `npm ci` do contêiner Linux extrai
         (mesmo sem usá-los) saíram com modo `644`, sem bit de execução, o que torna a hipótese do
         mantenedor mais plausível **sem confirmá-la** — só o `ls -l` dele no Mac de verdade
         confirma.

      **Revisão do PO — item extra, achado incidental da V2-T2, corrigido junto com o item 2:** a
      barra de comando (`#command-bar`) não sumia ao Cancelar/submeter — `index.css` tinha uma
      regra de ID (`display: flex`) mais específica que a regra padrão do navegador para
      `[hidden]`, então o atributo `hidden` que `renderer.ts` já setava certo nunca tinha efeito
      visual. O mantenedor viu isso no macOS. Corrigido com `#command-bar[hidden] { display:
      none; }` (ID + atributo, mais específico). Prova por captura de tela antes/depois de
      Cancelar de verdade (instrumentação temporária, revertida antes do commit).

      Detalhes, decisões de ferramental e o que ficou inferido (não medido) em
      `docs/QUESTOES.md` Q-072.

      **Medido pelo PO depois da mesclagem (2026-09-14):** portão na `main` verde em pedaços
      (1.658 passando, 4 pulados), `verificar:linux` na `main` verde (1.657 passando, 5 pulados),
      CI verde nos três sistemas nos dois pushes da mesclagem. **Aceite do mantenedor no Windows
      (2026-09-16):** `oh-my-posh` instalado no PowerShell e no cmd, prompt legível dentro da aba
      do seeya. Um detalhe que confirma o desenho: a sessão que instalou o `oh-my-posh` escolheu
      uma fonte diferente para o terminal do sistema, e a aba do seeya ficou certa mesmo assim —
      porque a aba desenha com a Nerd Font embutida, não com a fonte do terminal da máquina.
      **Pendente:** o Linux (o `oh-my-posh` legível lá) e o Mac (o diagnóstico do helper e uma
      aba de shell abrindo); a tarefa fica em `[~]` até um dos dois, com o Mac registrado como
      pendência do mantenedor de qualquer forma.

- [x] **V2-T4 — A interface retoma o dia: `start-day` em abas e pergunta antes do fallback
      (D-042, D-043, D-039).** Especificada pelo PO em 2026-09-14; aprovada e despachada pelo
      mantenedor em 2026-09-16; **mesclada na `main` em 2026-09-16** depois da revisão do PO (uma
      correção: a aba de retomada nascia com pty 80×24 e o renderer não mandava o `resize` ao
      montá-la — o harness ficaria em 80×24 até alguém mexer na janela; corrigido em `electron/`,
      fora da cobertura, conferido por tipos, lint e bundle). É a razão de existirem duas raízes de
      composição: a mesma `resumeSessions` da CLI, com um `SessionResumer` diferente — o da CLI
      abre a sessão no terminal atual e espera ela terminar; o da interface abre uma **aba** e
      segue. Nenhum comportamento novo no motor; o que muda é quem implementa a porta.

      **O que entra:**

      1. **O painel "Hoje".** Uma região nova (ou a lateral ganha uma seção) com o briefing
         pendente do dia, achado por `application/find-pending-briefing.ts` como o
         `seeya start-day` faz: dia, quantas sessões o briefing tem, quais já foram retomadas hoje
         (`Storage.readResumedSessionIds`), e uma caixa de seleção por sessão com o nome, o `cwd`
         e a primeira linha do plano. Botão **Resume selected**. Sem briefing pendente, a região
         diz isso, com o mesmo vocabulário da CLI (D-024/D-025: "nenhum briefing encontrado nos
         últimos N dias" é diferente de "todas já retomadas"). A seleção interativa da CLI
         (`packages/cli/src/start-day-selection.ts`, que usa `readline`) **não** é reaproveitada:
         a interface tem caixas de seleção; só o que for lógica pura de seleção que as duas
         queiram compartilhar sai da CLI para `application/`, pela regra da V2-T2.

      2. **`TabSessionResumer`** (`packages/app/src/resume/`), implementando `SessionResumer`
         (`core/ports.ts`) sobre o `PtyManager`:
         - `attemptResume(sessionId, cwd, prompt)`: mesmos argumentos que a CLI
           (`adapters/resumption/args.ts#buildResumeArgs`, mesmo teto
           `RESUME_PROMPT_ARG_LIMIT_CHARS` → `needsFallback` com `promptTooLarge`, mesma descrição
           `describeResumeAttempt`), mesmo ambiente limpo (`buildResumptionEnv`), binário
           resolvido por `adapters/process/resolve-command.ts`. Abre a aba, e resolve como
           **retomada** quando o processo sobrevive à janela de falha rápida
           (`FAST_FAILURE_GRACE_MS`, 5 s, pelo `Clock` injetado) — e como `needsFallback` com o
           código de saída se morrer antes dela com código diferente de zero. **Nunca espera a
           sessão terminar** (a CLI espera; a aba não). A corrida entre `onExit` e
           `clock.sleep(grace)` é lógica pura, testada com pty falso e relógio falso.
         - `runFallback(sessionId, cwd, prompt, reason)`: mesmo arquivo de contexto e mesmos
           argumentos da CLI (`context-file.ts`, `buildFallbackArgs`, `FALLBACK_KICKOFF_PROMPT`),
           abrindo a sessão limpa numa aba; o arquivo de contexto é removido como a CLI remove.
         - A aba de uma retomada é rotulada com o nome da sessão do handoff, não com "claude"; a
           correspondência por PID da lateral marca a sessão retomada como todas as outras.

      3. **A pergunta antes do fallback (S5-T9, D-025)** vira diálogo na janela, não `readline`:
         quando `attemptResume` devolve `needsFallback`, `resumeSessions` chama o
         `FallbackConfirmer` — o da interface manda um pedido ao renderer (IPC com resposta),
         que mostra o motivo exato (o mesmo texto que a CLI mostra: comando tentado e código de
         saída, ou "plano de N caracteres acima do teto de M") e dois botões: **Open a fresh
         session** e **Skip**. A decisão passa por `core/resume-fallback-decision.ts` como na
         CLI (aqui não existe resposta inválida; o padrão continua sendo pular, e fechar o diálogo
         sem escolher conta como pular). Um pedido por vez; `resumeSessions` já é sequencial.

      4. **Progresso e resultado.** `resumeSessions` recebe `onProgress` — a região "Hoje" mostra
         "retomando 2 de 5: <nome>" enquanto roda; ao final, o resumo com o mesmo conteúdo de
         `cli/format-start-day.ts` (retomadas, puladas, fallback, parou cedo em qual e por quê).
         Se o texto for reaproveitado literalmente, a formatação sai da CLI para `application/`
         como `format-status.ts` saiu; se a interface desenhar o resumo em DOM, só o modelo de
         dados (o `ResumeSessionsResult`) é compartilhado, e `format-start-day.ts` fica na CLI. O
         agente decide pelo mesmo critério da V2-T2 e registra.

      **O que não entra** (V2-T5, a especificar depois desta): `end-day` pela interface com a
      prévia (`--dry-run`) como confirmação, e a notificação do resultado; a faixa de horário
      ("encerramento às 11:00 em 12 min") com **Snooze** e **Skip today** dentro da janela, pela
      mesma `decideSchedule` do daemon, reaproveitando o que `snooze-command.ts`/`skip-today`
      fazem (que sai da CLI para o motor); subir/parar o daemon pela interface; notificações do
      SO com botão (D-034: o `Notification` do Electron só tem ações no macOS — decisão a tomar
      lá, não aqui); empacotamento; projetos.

      **Cuidados:** a interface **não** retoma nada sozinha — só ao clicar (D-039); a retomada
      registra em `resumed-sessions` como a CLI registra, então uma sessão retomada pela
      interface não é retomada de novo pela CLI no mesmo dia, e vice-versa (é o mesmo `Storage`);
      Windows é o ambiente do agente e o Linux o do mantenedor — o binário resolvido por SO, nada
      de `process.platform` fora de adapter; nenhuma dependência nova; tudo com lógica fora de
      `electron/`, com teste; as guardas da V2-T2 continuam valendo (`electron` só em
      `electron/`, `node-pty` só em `pty/`); nenhum texto voltado à pessoa fora de
      `text/messages.ts`; **um commit por item** acima, portão em primeiro plano a cada um.

      *Aceite:* na máquina do agente, com um briefing real ou sintético num `homeDir` descartável
      (o harness de e2e monta sessão e transcript — `tests/e2e/_harness.ts` — e `tests/e2e/start-day.test.ts` mostra como um briefing é produzido com um `claude` falso), "Resume
      selected" abre uma aba com `claude --resume <id> …` para cada sessão marcada, a lateral
      marca cada uma por PID, `resumed-sessions` do dia registra os ids, e uma sessão marcada com
      plano acima do teto dispara o diálogo com o texto certo — provado por captura de tela lida
      pelo agente e pelo conteúdo de `~/.seeya` do `homeDir` descartável; testes de unidade para
      o resumer (falha rápida, sucesso, fallback) com pty e relógio falsos; portão e
      `verificar:linux` verdes; CI verde nos três sistemas. **Aceite manual do mantenedor:** um
      `start-day` real pela interface no dia seguinte a um `end-day` real, no Windows e no Linux.

      **Entregue pelo agente em 2026-09-16, cinco commits (um por item mais um de instrumentação
      de verificação), worktree isolada (`tarefa/V2-T4-interface-retoma-dia`).** Portão local
      completo verde a cada commit (`npm run format:check`, `tsc -p tsconfig.json --noEmit`,
      `npm run lint`, `npm run build`, `npm run dependencias`, `npm run cobertura --
      --maxWorkers 2`, cada um com o código de saída lido) e `npm run verificar:linux` verde no
      estado final do branch inteiro (contêiner `node:22-bookworm`, Docker respondendo sem
      demora) — **168 arquivos de teste, 1.692 testes passando, 5 pulados**. No Windows, a mesma
      suíte: 1.693 passando, 4 pulados (a mesma diferença de pulados entre SOs já registrada em
      tarefas anteriores, não uma regressão desta).

      1. **`TabSessionResumer`** (`packages/app/src/resume/tab-session-resumer.ts`,
         `exit-listener-registry.ts`). Reaproveita `buildResumeArgs`/`buildFallbackArgs`/
         `RESUME_PROMPT_ARG_LIMIT_CHARS`/`context-file.ts` do motor sem reescrever nada —
         `attemptResume` nunca espera a sessão terminar, só até `FAST_FAILURE_GRACE_MS` (pelo
         `Clock` injetado, nunca `AbortSignal.timeout` como a CLI usa, porque a spec deste item
         pedia especificamente o relógio injetado para a corrida ser testável sem pty real).
         `ExitListenerRegistry` é o que deixa o `onExit` único do `PtyManager` (registrado uma vez
         em `electron/main.ts`) também notificar essa corrida para tabs específicas — sem ele não
         haveria como o resumer saber quando SUA aba (entre várias abertas) terminou.
      2. **Pergunta antes do fallback**: `PendingFallbackRequests` (correlaciona pedido↔resposta
         por `requestId`, já que `ipcRenderer.send`/`on` não tem forma nativa de pedir-e-esperar
         do processo principal para o renderer) + `buildFallbackConfirmer` (usa
         `core/resume-notice.ts#describeFallbackReason` direto — nunca uma segunda frase para o
         mesmo motivo) + um `<dialog>` real no `index.html` (`showModal`, "cancel" no Escape
         responde Skip).
      3. **Painel "Hoje"** (`state/today-panel.ts`): reaproveita `findPendingBriefing`/
         `PendingBriefingLookup` do motor sem mudança; a extração de "primeira linha do plano"
         (`tomorrowPlan[0] ?? pendingItems[0] ?? null`, D-025) é lógica nova só da interface — não
         havia nada equivalente em `cli/` para mover, então nada saiu da CLI para o motor nesta
         tarefa (diferente da V2-T2). "Resume selected" liga tudo: `electron/main.ts` monta um
         `TabResumeOpener` real sobre o mesmo `PtyManager`/`TabCollection` que a barra de comando
         já usa (uma aba do resumer é indistinguível de uma aba comum depois de aberta — mesma
         correspondência por PID na lateral), e chama a mesma `resumeSessions` que a CLI chama.
      4. **Progresso e resultado**: `resumeProgress` (main → renderer) mostra "Resuming N of M";
         `state/resume-summary.ts#buildResumeSummary` projeta o `ResumeSessionsResult` do motor
         para um formato seguro de IPC, reaproveitando `describeFallbackReason` para cada motivo —
         a interface desenha isso como seções em DOM, então só o **dado** atravessa a fronteira
         (Q-073), como a V2-T2 já tinha feito para o painel de estado; `format-start-day.ts`
         continua só na CLI, sem mudança.

      **Aceite medido pelo agente**, num `homeDir` descartável, com um driver de verificação
      próprio (fora do repositório, não commitado) que sobe a interface real compilada, offscreen
      (`SEEYA_APP_HOME_OVERRIDE`/`SEEYA_APP_OFFSCREEN`/`SEEYA_APP_QUIT_AFTER_MS`, mais
      `SEEYA_APP_AUTO_RESUME_ALL`, novo nesta tarefa — marca as caixas do painel e clica "Resume
      selected", respondendo Skip se o diálogo aparecer). **O `claude` usado foi um fake escrito
      à mão para esta verificação** (um `.cmd` que grava o argv recebido e sai com código 0),
      não o fixture `fake-claude.mjs` do harness de e2e — mais simples de montar para uma aba de
      pty (que passa pelo `resolveHarnessCommand`/`cmd.exe /c`, caminho diferente do `spawn`
      direto que o fixture do harness mede). Três capturas de tela reais, lidas pelo agente:

      - **Plano curto:** "Resume selected" abriu uma aba rotulada `project-alpha` (não `claude`),
        com `claude --resume 11111111-1111-4111-8111-111111111111 "Resuming session
        \"project-alpha\" in ..."` visível na saída do pty, e
        `~/.seeya/days/<hoje>/resumed.json` com `{"sessionIds":["1111...1111"]}`.
      - **Plano de 20.262 caracteres** (acima do teto de 16.384): nenhuma aba abriu — o diálogo
        apareceu com "Could not resume \"project-alpha\" as-is" / "yesterday's plan is too long
        to pass safely to an interactive session (20262 characters, limit 16384)" e os dois
        botões certos.
      - **A mesma sessão, respondendo Skip:** o painel voltou a mostrar a caixa de seleção (não
        retomada) e a seção "Skipped at your request" com o motivo — sem `resumed.json` nenhum
        escrito (nada foi de fato resumido).

      **O que ficou inferido, não medido:** o `--resume` real contra o `claude` de verdade dentro
      de uma aba (o fake só prova o argv/rotulagem/registro; a sessão de fato continuando é o
      mesmo tipo de medição que a Q-069 já deixou para o mantenedor, agora também para a aba); a
      lateral marcando por PID uma sessão retomada pela interface enquanto ela ainda está viva
      (o teste mediu o estado logo depois do `RESUMED-OK` do fake, antes do próximo ciclo do
      laço de atualização rodar); Linux e macOS — o agente só tem Windows.

      **O que fica pendente do mantenedor:** revisar e mesclar; depois, um `seeya end-day` real
      seguido de um `seeya start-day` real **pela interface**, no dia seguinte, no Windows e no
      Linux dele. Detalhes, decisões de ferramental e o que ficou inferido (não medido) em
      `docs/QUESTOES.md` Q-073.

- [x] **V2-T5a — `end-day` pela interface: a prévia é a confirmação, progresso por sessão,
      resultado e notificação (D-039, D-042, D-043).** Especificada pelo PO em 2026-09-16;
      aprovada e despachada pelo mantenedor no mesmo dia; **mesclada na `main` em 2026-09-16**
      depois de uma rodada de revisão (a prévia sem chamada ao modelo — premissa errada do
      despacho, corrigida no motor com `skipGeneration`). Fecha o ciclo diário
      inteiro dentro da janela: encerrar à noite (esta tarefa), retomar de manhã (V2-T4). Na CLI
      o `seeya end-day` roda sem perguntar e bloqueia em silêncio até acabar; a interface não
      pode fazer nenhuma das duas coisas — é um botão que custa dinheiro (uma chamada de modelo
      por sessão) e leva minutos.

      **O que entra:**

      1. **Botão "End day…"** na região de estado. Clicar **não encerra nada**: roda
         `endDay(deps, { dryRun: true, scope: { kind: 'fullDay' } })` — a mesma prévia do
         `seeya end-day --dry-run` — e mostra o resultado como **prévia de confirmação**: quantas
         sessões estão no escopo, quais seriam capturadas (nome, `cwd`), quais **seriam
         encerradas** pela política (`canTerminate`, D-002) e quais ficam de fora com o motivo
         (D-024: cada motivo com o vocabulário da CLI). A prévia mostra também o teto de custo,
         honesto e sem estimativa: "até N × `budgetPerSessionUsd`" com o `captureModel` da
         config — é o teto que a própria captura impõe, não uma previsão (D-025). Dois botões:
         **Run end-day now** e **Cancel**. Fechar a prévia sem escolher é cancelar.

      2. **O texto da prévia e do resultado é o mesmo da CLI, por construção**: `formatEndDayReport`
         (`packages/cli/src/format-end-day.ts`) e `buildEndDayNotice` (`end-day-notice.ts`) são
         formatação pura sobre `EndDayResult` e **saem da CLI para `application/`** (`git mv`
         com os testes, a CLI importando de lá), como `format-status.ts` saiu na V2-T2. A
         interface mostra o texto literal num painel; o que ela acrescenta em DOM (o teto de
         custo, os botões, o progresso) não existe na CLI e fica na interface.

      3. **Progresso por sessão.** `endDay` hoje não avisa nada enquanto roda (as capturas correm
         com `captureConcurrency` e o chamador só vê o resultado final). Entra um gancho
         **opcional** em `EndDayOptions`: `onCaptureProgress?: (event) => void`, com eventos
         `captureStarted` / `captureFinished` (sessão, índice, total, e no `finished` se foi
         capturada ou falhou e por quê), emitido pelo laço de captura já existente — sem mudar
         a ordem, a concorrência nem o resultado. **CLI e daemon não passam o gancho e não mudam.**
         Teste em `tests/unit/application/end-day.test.ts`: a sequência de eventos para N
         sessões com falha isolada, e a ausência do gancho não altera nada (os testes atuais
         continuam iguais). A interface mostra "capturing 2 of 5: <nome>" e o painel de estado
         continua atualizando por trás.

      4. **Execução e resultado.** "Run end-day now" roda `endDay(deps, { dryRun: false, scope:
         fullDay })` **uma vez por vez**: o botão fica desabilitado enquanto roda, e um segundo
         clique não enfileira. Ao terminar: o relatório (o mesmo texto da CLI, item 2) no painel,
         **e a notificação** pelo mesmo `Notifier` e o mesmo `buildEndDayNotice` que a CLI usa
         (a interface compõe o adapter real de notificação, `adapters/notification/index.js`,
         como `cli/composition.ts#buildEndDayContext` compõe). Depois, o painel "Hoje" (V2-T4) e
         o painel de estado são atualizados — o briefing recém-escrito é o que o `start-day` de
         amanhã vai achar.

      5. **A composição da interface ganha o `EndDayDeps`**: `transcriptReader`, `gitReader`,
         `leanGenerator`/`deepGenerator` (que lançam `claude -p` por `spawnHidden`, D-038 — dentro
         do processo principal do Electron, sem janela, como o daemon já faz), `forkCleanup` —
         espelhando `buildEndDayContext` da CLI, **fiação apenas**, nenhuma lógica duplicada.

      **O que não entra** (V2-T5b): escopo de uma sessão só (`--session`) pela interface; a faixa
      de horário com Snooze e Skip today; subir/parar o daemon; notificação do SO com botão
      (D-034 — decisão a tomar lá). **Uma corrida que não se resolve aqui e fica registrada:** se
      o daemon disparar o `end-day` agendado enquanto o botão está rodando, os dois escrevem
      handoffs — é a mesma corrida que `seeya end-day` manual já tem com o daemon hoje; a tarefa
      registra na Q-074 e não tenta resolver (o lock de instância é do daemon, não do `end-day`).

      **Cuidados:** a interface não encerra nada sem o clique de confirmação (D-039, D-002);
      nenhuma dependência nova; toda lógica fora de `electron/` com teste (o modelo da prévia, a
      máquina de estados "ocioso → prévia → rodando → resultado", a projeção do progresso); texto
      em `text/messages.ts`; as guardas valem; **um commit por item**, portão em primeiro plano
      (em pedaços, `--maxWorkers 2` na cobertura), códigos de saída lidos, e **quem manda algo
      para segundo plano lê o próprio resultado pelo relógio** — nenhuma notificação chega ao
      agente. Questão: Q-074.

      *Aceite:* num `homeDir` descartável com sessões e transcripts montados pelo harness de e2e
      e o `claude` falso de `tests/e2e/end-day.test.ts` (que responde à captura), mais o
      notificador falso de `tests/e2e/_fake-notification-commands.ts`: "End day…" mostra a prévia
      com N sessões e o teto de custo; "Run end-day now" grava os handoffs e o briefing em
      `~/.seeya/days/<dia>/`, mostra o progresso e depois o relatório idêntico ao de
      `seeya end-day` contra o mesmo home, e o notificador falso recebe o mesmo aviso que a CLI
      mandaria — provado por captura de tela lida pelo agente (se a captura falhar nesta sandbox,
      dizer) e pelo conteúdo do home. Testes de unidade dos módulos novos e do gancho de
      progresso. Portão, `verificar:linux` e CI verdes. **Aceite manual do mantenedor:** um
      `end-day` real pela interface no fim de um dia real, e o `start-day` pela interface na
      manhã seguinte — fecha V2-T4 e V2-T5a de uma vez.

      **Entregue pelo agente em 2026-09-16, cinco commits (um por item), worktree isolada
      (`agent-ae4acdd2ef61f3e28`).** Portão local completo verde a cada commit (`npm run
      format:check`, `tsc -p tsconfig.json --noEmit`, `npm run lint`, `npm run build`, `npm run
      dependencias`, `npm run cobertura -- --maxWorkers 2`, cada um com o código de saída lido) e
      `npm run verificar:linux` verde no estado final do branch inteiro (contêiner
      `node:22-bookworm`, `--rm`, 171 arquivos de teste, **1.711 testes passando, 5 pulados**).
      No Windows, a mesma suíte: 1.716 testes (a mesma diferença de pulados entre SOs já
      registrada em tarefas anteriores).

      1. **`formatEndDayReport`/`buildEndDayNotice` saíram de `cli/` para
         `application/`** (`git mv` com os testes, nenhum texto mudou) — `cli/end-day-command.ts`
         importa de `@seeya-ai/engine/application/*.js`. Comentários que citavam o caminho antigo
         em código (não em `docs/`, que é registro histórico) foram atualizados.
      2. **`EndDayOptions.onCaptureProgress`** (`application/types.ts`/`end-day.ts`): eventos
         `captureStarted`/`captureFinished` (sessão, índice/total 1-based, e no `finished` se foi
         `captured`/`ineligible`/`failed` e por quê), emitidos pelo MESMO
         `mapWithConcurrencyLimit` já existente — `runSession` virou um embrulho fino em torno de
         `captureSessionOutcome` (o corpo antigo, renomeado) para caber no orçamento de ~20 linhas.
         `seeya end-day`/o daemon continuam sem passar o gancho.
      3. **`AppContext` ganhou `transcriptReader`/`gitReader`/`leanGenerator`/`deepGenerator`/
         `forkCleanup`/`notifier`**, espelhando `cli/composition.ts#buildEndDayContext` campo a
         campo — `toEndDayDeps(context)` faz a montagem (`composition/index.ts`), testado em
         `tests/integration/app/composition.test.ts`.
      4. **O botão "End day…"** (região de estado): `state/end-day-preview.ts` (o teto de custo,
         `sessionsInScope × budgetPerSessionUsd`) e `state/end-day-panel.ts` (a máquina de
         estados `idle → previewPending → preview → running → result`, cinco estados — o "prévia"
         do despacho virou dois: a busca em si, que pode demorar de verdade porque o dry-run
         chama `claude -p` por sessão, e o texto pronto) — cada um com teste de unidade cobrindo o
         caminho permitido e as transições recusadas. Um `<dialog>` (`#end-day-dialog`, mesmo
         padrão do `#fallback-dialog` da V2-T4) mostra o texto literal de `formatEndDayReport`
         mais a linha de custo; "Run end-day now" fica visível desde este item, sem handler ainda.
      5. **"Run end-day now"** roda o `endDay` real uma vez por vez (`electron/main.ts` recusa
         uma segunda chamada concorrente, além do botão já ficar desabilitado no `running`),
         projeta o progresso por `state/end-day-progress.ts` (`captureFinished` vira `null` — o
         painel só mostra quem está capturando agora, o desfecho de cada um já está no relatório
         final), notifica pelo `Notifier`/`buildEndDayNotice` reais, e atualiza o painel "Hoje"
         (`refreshTodayPanel`) — o painel de estado pega a mesma escrita no próprio ciclo
         ambiente de 10s (`runRefreshLoop`), sem push dedicado.

      **Medido pelo agente, num `homeDir` descartável, com um `claude` falso compilado para esta
      verificação (o mesmo shim `.exe` via `csc.exe` que `tests/integration/generation/_fixtures.ts`
      usa, não commitado — mesma classe de instrumentação que Q-073 já documentou) e a interface
      real compilada, offscreen (`SEEYA_APP_HOME_OVERRIDE`/`SEEYA_APP_OFFSCREEN`/
      `SEEYA_APP_AUTO_END_DAY`, este último novo nesta tarefa):** com duas sessões elegíveis
      (`project-alpha`, `project-beta`), "End day…" seguido de "Run end-day now" grava dois
      handoffs e `summary.md` em `~/.seeya/days/<dia>/`, e o diálogo termina mostrando o relatório
      real ("Wrote 2 handoffs and the daily briefing (summary.md).") mais a linha de custo ("Cost
      ceiling: up to 2 × $0.25 per session (model: sonnet) — at most $0.50 total..."), provado por
      captura de tela lida pelo agente. Rodando `seeya end-day` (CLI compilada) contra uma segunda
      cópia idêntica da mesma fixture (não o mesmo `homeDir` — D-026 impediria uma segunda
      captura), o texto do relatório bate estrutura por estrutura com o que o diálogo mostrou
      (as únicas diferenças são os caminhos `cwd`, que são por natureza específicos de cada
      `homeDir` de teste) — a igualdade literal em si é garantia de construção (a MESMA
      `formatEndDayReport`), não uma coincidência desta medição.

      **Não medido diretamente nesta verificação:** uma captura de tela do estado `preview` isolado
      (antes de clicar "Run") — o driver de verificação clica "Run end-day now" 3s depois de abrir
      o diálogo e só tira UMA captura, no final; que o relatório final mostre os dados reais da
      captura prova que a prévia carregou e que o clique em "Run" funcionou, mas a tela da prévia
      em si não foi vista isoladamente. O conteúdo do que o notificador falso recebeu não foi
      inspecionado (o fixture de notificação, igual ao que `tests/e2e/_fake-notification-commands.ts`
      já usa, é um `.exe` no-op que não grava o que recebeu) — a garantia aqui é de construção
      (o mesmo `Notifier`/`buildEndDayNotice` da CLI, D-020) mais o fato de o processo Electron ter
      saído com código 0 sem exceção não tratada. Linux e macOS não foram medidos (só Windows,
      mais `verificar:linux` no contêiner). Detalhes, decisões de ferramental e a corrida com o
      `end-day` agendado do daemon em `docs/QUESTOES.md` Q-074.

      **Revisão do PO (16/09), mesma branch, três commits mais: a prévia custava dinheiro.** A
      premissa do despacho estava incompleta — `docs/ESPECIFICACAO.md`'s "`--dry-run` executa tudo
      menos escrever e terminar" sempre significou, para captura **leve**, uma chamada real e
      cobrada ao `leanGenerator` (só a captura **profunda** já era poupada, por segurança de disco,
      D-012). A prévia da interface (item 1) pagava esse custo leve por sessão elegível, e "Run
      end-day now" pagava de novo — uma prévia que custa dinheiro antes da confirmação viola o
      próprio motivo do item 1 existir (D-039). Corrigido com `EndDayOptions.skipGeneration`
      (só válido junto de `dryRun: true`; `endDay` lança se não for), que faz `captureSession`
      devolver uma prévia sem chamar nenhum gerador, para qualquer modo de captura —
      `generation-policy.ts#previewDeepCaptureOutcome` generalizou para
      `previewCaptureOutcome(captureMode)`. Só a interface passa a nova opção; `seeya end-day
      --dry-run` e o daemon continuam exatamente como estavam (os testes existentes não mudaram).
      **Medido depois da correção**, com um `claude` falso que conta invocações (não o fixture do
      harness de e2e, que sobrescreve um único arquivo por chamada): a mesma verificação de ponta a
      ponta caiu de 4 invocações reais (duas sessões × duas chamadas a `endDay`) para **2** (uma
      por sessão, só na execução real) — prova direta, medida contra um processo Electron
      real, não apenas nos testes de unidade (que também cobrem o gancho isoladamente). Detalhes
      completos, o texto novo do teto de custo, e por que `previewPending` continua existindo (por
      um motivo diferente do que o relatório original desta tarefa dava) em `docs/QUESTOES.md`
      Q-074, item 6.

      **O que fica pendente do mantenedor:** revisar e mesclar; depois, um `end-day` real pela
      interface no fim de um dia real, e um `start-day` real pela interface na manhã seguinte —
      no Windows e no Linux dele, fechando V2-T4 e V2-T5a juntas como o aceite pede.

      **Aceite do mantenedor no Windows (2026-09-17), medido de dentro da sessão retomada:** o
      `end-day` pela interface capturou a sessão do PO (modo leve, evidência git + transcript +
      registro) às 09:08 UTC e escreveu `days/<dia>/summary.md` e o handoff; em seguida o
      "Resume selected" do painel "Hoje" reabriu essa sessão numa aba — a cadeia de processos
      vista de dentro é `claude.exe --resume <id> ← electron.exe ← node (build.mjs --dev) ← npm run
      app`, o `TERM` é o do pty embutido, e `days/<dia>/resumed.json` registra o id. Caminho
      principal, sem diálogo de fallback (o plano coube no teto de 16.384). A prévia, a execução e
      a retomada foram feitas no mesmo dia, o que o painel "Hoje" aceita sem estranhar. **V2-T4 e
      V2-T5a aceitas.** Pendente só o Linux/macOS, na mesma classe de medição das tarefas
      anteriores da interface.

- [x] **V2-T6 — Correção: letras ficam para trás ao redimensionar e rolar a aba no Windows
      (ConPTY × xterm.js).** Especificada pelo PO em 2026-09-17 a partir de um defeito visto pelo
      mantenedor no mesmo dia; aprovada e despachada em 2026-09-17; a primeira entrega (a opção
      `windowsPty` do xterm.js) foi mesclada e **não resolveu** — o mantenedor testou e viu o
      mesmo defeito; **reaberta e fechada no mesmo dia** com a alavanca certa, medida por ele em
      cinco variantes (abaixo). **Aceita em 2026-09-17.**

      **A medição que decidiu (mantenedor, Windows 11 build 26200, aba de Claude Code com 150
      linhas numeradas, redimensionar e rolar):** (A) `windowsPty` com o build real → órfãos;
      (B) sem a opção → órfãos, **menos**; (B') `windowsPty` com build 19041 (reflow do xterm
      desligado) → órfãos; (D) **ConPTY empacotado pelo `node-pty` (o `conpty.dll` + `OpenConsole`
      do Windows Terminal, `third_party/conpty/1.23.251008001`) sem a opção → limpo** — o defeito
      ainda aparece por milissegundos e some, porque esse ConPTY repinta a área visível inteira
      depois do redimensionamento, coisa que o embutido no Windows não fazia; (E) ConPTY
      empacotado com a opção → não medido, desnecessário. **Leitura:** a captura do mantenedor
      mostrava sempre dois caracteres nas colunas 0–1, restos de "Linha 1**48**" da disposição
      anterior, com o texto novo (que começa com dois espaços) a partir da coluna 2 — a
      assinatura do redesenho diferencial do ConPTY, que não reemite células que acredita já
      corretas; o do Windows Terminal repinta tudo. **O que ficou em código:** `useConptyDll:
      true` no `NodePtyAdapter`, passado pela raiz de composição só no Windows; a opção
      `windowsPty` do xterm.js foi revertida (só piorava); o `refresh` depois do `resize` ficou
      (barato, sem contraindicação medida). Portão verde na worktree do PO (1.721 passando, 4
      pulados — seis a menos pela reversão), Linux pela CI. **Consequência para o instalador
      (tarefa futura):** o `conpty.dll` e o `OpenConsole.exe` do `node-pty` precisam ser
      empacotados junto com a interface no Windows.

      **O defeito, medido:** numa aba com o Claude Code rodando, redimensionar a janela e rolar
      o scrollback deixa caracteres órfãos na borda esquerda (captura de tela do mantenedor,
      2026-09-17, Windows 11 build 26200). **A causa provável está documentada no próprio
      `xterm.js`** (`typings/xterm.d.ts`, opção `windowsPty`): ao aumentar as linhas do terminal,
      o ConPTY não traz o scrollback de volta para a área visível — cria linhas vazias — e sem
      o ajuste "pode faltar dado enquanto as linhas são substituídas"; para builds do ConPTY
      abaixo de 21376 o reflow também é desligado. A nossa aba cria o `Terminal` sem essa opção.

      **O que entra:**
      1. **`windowsPty` na aba, só no Windows.** A raiz de composição lê `os.release()` uma vez
         (é onde `process.platform` já é lido) e deriva `{ backend: 'conpty', buildNumber }` num
         módulo puro testado (`state/terminal-options.ts` ou o `terminal-font.ts` renomeado para
         cobrir as duas coisas — o agente decide e registra): entrada `platform` + `release`,
         saída a opção ou `undefined` fora do Windows; teste para `10.0.26200` → 26200, para
         Linux/macOS → `undefined`, e para um `release` que não parseia → `undefined` com o motivo
         (D-025: sem número, sem afirmação). Viaja pelo mesmo canal de IPC que a fonte já viaja e
         entra em `new Terminal({...})` nos dois lugares em que a aba nasce.
      2. **Depois de redimensionar, um `refresh` completo** do terminal (`terminal.refresh(0,
         rows - 1)`) no manipulador de `resize` do renderer, barato e sem efeito fora do redesenho.
      3. **Registro honesto:** o agente não consegue ver o defeito (sem tela interativa); a
         prova é do mantenedor. O relatório diz o que mudou e por quê, cita a documentação do
         `xterm.js`, e **não afirma que resolveu**.

      **Medição adicional do mantenedor (2026-09-17):** numa aba de shell (PowerShell, 500
      linhas largas numeradas), redimensionar e rolar **não** deixa órfão nenhum; só na aba do
      Claude. Leitura do PO: saída de shell não usa sequências de apagar linha, e a TUI do Claude
      Code usa o tempo todo (redesenha o próprio bloco com cursor e "apagar até o fim da linha");
      se depois do redimensionamento o ConPTY e o `xterm.js` discordam de onde uma linha quebra,
      o apagar acerta as células erradas e sobram fragmentos — é o caso que `windowsPty` trata
      (contagem de quebras/reflow), então o item 1 continua sendo a alavanca certa. **O
      renderizador WebGL sai da tarefa**: ele muda o desenho, não o conteúdo do buffer, e não
      explicaria conteúdo órfão. **Comparação que decide de quem é o defeito, a fazer pelo
      mantenedor:** o mesmo redimensionar e rolar com o Claude Code no Windows Terminal — se lá
      também sobram fragmentos, é a TUI com o ConPTY e a correção só reduz; se lá fica limpo, é
      do nosso emulador e a correção tem que resolver. **Feita (2026-09-17): no Windows Terminal
      não acontece.** O defeito é do nosso emulador (o Windows Terminal é o próprio host do
      console e não passa pela tradução ConPTY → VT → `xterm.js` onde a contagem de quebras pode
      divergir). A V2-T6 tem que resolver; se o item 1 não bastar, a investigação continua nela
      (próximas hipóteses, nesta ordem: o `resize` do pty chegando antes do `fit` do xterm ou
      vice-versa, e o `convertEol: true` interferindo nas sequências de cursor da TUI).

      **Cuidados:** nada de `process.platform`/`os.release()` fora da raiz de composição; texto
      nenhum voltado à pessoa muda; guardas valem; um commit por item, portão em primeiro plano,
      `verificar:linux` lido em arquivo. Questão: Q-075.

      *Aceite:* portão e CI verdes; testes do módulo puro; **aceite manual do mantenedor** no
      Windows: repetir o redimensionamento com rolagem numa aba de Claude e dizer se os órfãos
      sumiram, com a comparação no Windows Terminal registrada — se não sumirem e o Windows
      Terminal ficar limpo, a V2-T6 reabre com investigação, não com WebGL.

      **Entregue pelo agente em 2026-09-17, dois commits (um por item), worktree isolada
      (`agent-a9d0419594005737a`).** Portão local em pedaços verde antes de cada commit
      (`npm run format:check`, `tsc -p tsconfig.json --noEmit`, `tsc -p packages/app/tsconfig.json
      --noEmit`, `npm run lint`, `npm run build`, `npm run dependencias`, `npm run cobertura --
      --maxWorkers 2`, cada um com o código de saída lido) — **1.727 testes passando, 4 pulados**
      no Windows depois do segundo commit; cobertura agregada 97,03% linhas/97,25% statements
      (piso do pacote é 80%, nenhum arquivo novo abaixo disso).

      1. **`windowsPty`.** `state/terminal-font.ts` virou `state/terminal-options.ts` (decisão do
         agente, registrada na Q-075 item 1: as duas opções viajam pelo mesmo round-trip de IPC e
         entram no mesmo `new Terminal({...})`, um módulo irmão só duplicaria a montagem).
         `deriveWindowsPtyOptions(platform, release)`, puro, testado
         (`tests/unit/app/state/terminal-options.test.ts`): `undefined` fora do Windows, `undefined`
         quando `release` não casa com `MAJOR.MINOR.BUILD` (D-025), `{ backend: 'conpty',
         buildNumber }` quando casa. `composition/index.ts` lê `os.release()` uma vez, ao lado do
         `process.platform` que já lia, e guarda o resultado em `AppContext.windowsPty`. O canal IPC
         foi renomeado com a opção (`getTerminalFontConfig` → `getTerminalOptions`,
         `TerminalFontConfigResponse` → `TerminalOptionsResponse`) porque "font config" já não
         descrevia o payload. `electron/renderer.ts#mountTerminalTab` — o único lugar em que
         `new Terminal({...})` é criado, usado tanto pela aba do "+" quanto pela aba de retomada —
         espalha a opção condicionalmente (`exactOptionalPropertyTypes` recusa a chave presente com
         valor `undefined`, achado no primeiro `tsc`, ver Q-075 item 3).
      2. **`refresh` depois de `resize`.** `wireWindowResize` (`electron/renderer.ts`), depois de
         `fitAddon.fit()` e `resizeTab`, chama `terminal.refresh(0, terminal.rows - 1)` para cada
         aba aberta — sem lógica nova, então nada foi extraído para módulo puro (o próprio despacho
         previa esse caso).

      **Medido pelo agente:** os dois commits, cada um com o portão local completo verde no Windows.
      `tests/integration/app/composition.test.ts` ganhou um teste que chama `buildAppContext` de
      verdade nesta máquina (Windows 11 build 26200) e confere `context.windowsPty` — rodou e
      confirmou `{ backend: 'conpty', buildNumber: 26200 }`, o único ponto desta tarefa em que a
      derivação foi exercida contra um `os.release()` real, não uma string fabricada em teste.
      Achado de ambiente registrado na Q-075 item 4: esta worktree não tinha `node_modules/` próprio
      (`npm install` nunca tinha rodado nela) — os guards que montam caminho de binário direto
      (`vitest.mjs`/`eslint`/`dependency-cruiser`) falhavam com `MODULE_NOT_FOUND` até um
      `npm install` local; depois disso `npm test` ficou verde.

      **`verificar:linux` — interrompido, não medido até o fim.** Rodando em segundo plano com
      saída redirecionada a arquivo (como as regras de sobrevivência pedem), chegou a construir a
      imagem, rodar formatação/lint/build/`dependencias` verdes e começar a suíte de cobertura
      dentro do contêiner (guards e as primeiras suítes de integração passando) quando o processo
      foi encerrado pelo próprio harness por pressão de memória do sistema (notificação explícita:
      "the system is running low on memory" — não uma falha do comando nem do código). O contêiner
      Docker ficou órfão (`docker ps` o mostrou `Up`, 2 minutos, sem processo controlador); parei-o
      (`docker stop`/o `--rm` do script já o removeu) para liberar memória. Por instrução explícita
      do próprio harness ("start it again only when asked"), **não tentei de novo por conta
      própria** — fica pendente do mantenedor/PO decidir quando a máquina tiver memória livre para
      rodar `npm run verificar:linux` (ou `node scripts/verificar-linux.mjs`) até o fim.

      **Investigação das duas hipóteses seguintes (Q-075 item 5), sem mudar código de produção:**
      (a) a ordem `fit()` → `resizeTab` no código é sempre xterm-primeiro/pty-depois, nunca invertida
      — não há corrida de ORDEM neste laço; a corrida de TEMPO do lado do ConPTY (dados chegando
      antes do reflow do xterm.js terminar) não é medível sem tela e é o problema que o `windowsPty`
      já existe para mitigar, não eliminar. (b) a própria documentação do `xterm.js` descreve
      `convertEol` como tradução de `\n` cru para `\r\n`, sem tocar em sequências de escape
      (cursor/apagar linha) — como a aba já roda sobre um pty real (`node-pty`), a opção é
      redundante e não uma explicação provável para o defeito; não desliguei `convertEol` sem
      evidência de que o harness emite `\n` cru, o que exigiria capturar bytes brutos do pty, fora
      do alcance deste agente. Detalhes completos, com as citações da documentação, na Q-075.

      **Não afirmo que o defeito foi resolvido** — este agente não tem tela interativa para ver o
      resultado. **O que fica pendente do mantenedor:** revisar e mesclar; rodar
      `npm run verificar:linux` até o fim quando a máquina tiver memória disponível; e o aceite real
      — repetir o redimensionamento com rolagem numa aba de Claude Code no Windows e dizer se os
      caracteres órfãos sumiram, com a comparação já feita no Windows Terminal (limpo) como
      referência. Detalhes de ferramental completos na Q-075.

- [~] **V2-T5b — O daemon na janela: faixa de horário com Snooze e Skip today, subir e parar o
      daemon (D-036, D-039, D-042, D-043).** Especificada pelo PO em 2026-09-17; aprovada pelo
      mantenedor no mesmo dia, com o recorte do item 5, e despachada logo depois da V2-T7;
      **mesclada na `main` em 2026-09-17** (portão na worktree do PO: 1.811 passando, 4 pulados;
      o `verificar:linux` do agente parou duas vezes no mesmo ponto por memória — o Linux fica
      com a CI). **Revisão do PO:** o incidente do agente (uma execução sem o home descartável
      escreveu no `~/.seeya` real e no registro do Windows, e foi revertida) foi conferido pelo PO
      depois da entrega — chave `seeya://` ausente no registro, os arquivos do mantenedor
      intactos, o daemon o mesmo de antes. Fica em `[~]` até o aceite do mantenedor (subir o
      daemon pela janela e ver `seeya status` concordar; Snooze pela janela num dia real; o
      clique de verdade no toast). **Aceite parcial do mantenedor (2026-09-17):** Stop daemon pela
      janela funcionou. O que ainda não deu para medir e por quê: Snooze/Skip não apareceram
      porque o encerramento das 11:00 já tinha disparado (`endOfDayFired: true` → faixa em "already
      ran today", sem nada a adiar — é o desenho; teste na manhã seguinte, antes das 11:00); o
      clique em toasts antigos não fez nada porque eles foram emitidos antes do marcador existir
      (o marcador `protocol-handler.json` e a chave `seeya://` no registro apareceram quando a
      interface subiu a partir da `main`; os próximos toasts do daemon levam o `launch`); Start
      daemon fica para o próximo clique (o daemon estava parado pelo teste do Stop).
      Com ela, tudo que a pessoa faz hoje
      pela CLI no dia a dia (`snooze`, `skip-today`, `daemon`, `daemon --stop`, `status`,
      `end-day`, `start-day`) existe na janela. A interface continua um painel de controle: o
      daemon segue sendo o processo separado de sempre (sobrevive à janela fechar, é o que o
      autostart sobe) — a alternativa de hospedar o laço do daemon dentro da interface foi
      descartada por isso.

      **O que entra:**

      1. **A faixa de horário.** Na região de estado, a cada ciclo de atualização (o mesmo laço
         de 10 s da V2-T2), a interface lê `estado.json` e calcula `decideSchedule(config,
         state, now)` — a mesma função pura do daemon (`core/schedule.ts`) — e mostra uma faixa
         por variante, com o vocabulário da CLI (D-024, nada achatado): `waiting` ("End of day at
         11:00 — in 2 h 13 min"), `leadTimeWarning` ("in 12 min"), `endOfDay` ("due now — the
         daemon acts on its next poll"), `skipped` ("skipped today"), `alreadyEnded` ("already ran
         today"), `disabled` ("not configured"). Botões **Snooze +15m / +30m / +1h** e **Skip
         today**, mostrados só quando fazem sentido (`waiting`, `leadTimeWarning`, `endOfDay`);
         a faixa é o lugar das ações que a D-034 reservou para a interface.
      2. **`snooze`/`skip-today` saem da CLI para o motor.** Hoje a orquestração (ler o estado,
         `applySnooze`/`applySkipToday`, salvar, `decideSchedule`) e os incrementos aceitos
         (`+15m`/`+30m`/`+1h`) vivem em `packages/cli/src/snooze-command.ts` junto com o texto
         de confirmação. A orquestração e os incrementos vão para `application/` (por exemplo
         `application/schedule-adjustments.ts`: `snoozeToday(storage, clock, minutes)` e
         `skipToday(storage, clock)` devolvendo o `ScheduleDecision` resultante; a tabela de
         incrementos vira constante exportada). A CLI passa a chamar de lá e mantém a renderização
         de texto; a interface renderiza a faixa em DOM a partir do mesmo `ScheduleDecision`
         (mesmo dado, não o mesmo texto — critério da V2-T4). O daemon vê a mudança no poll
         seguinte, como vê a da CLI hoje; a escrita concorrente de `estado.json` já é atômica.
      3. **Subir e parar o daemon.** Na região de estado, um botão conforme a vivacidade que
         `describeDaemonState`/`checkLiveLock` já calcula: **Start daemon** quando não há daemon
         vivo, **Stop daemon** quando há; enquanto o comando roda, o botão fica desabilitado; o
         resultado (o mesmo texto que a CLI imprime) aparece no painel e o estado atualiza no
         ciclo seguinte. **Parar:** `runDaemonStop` (`packages/cli/src/daemon-command.ts`) sai
         da CLI para o motor — e para isso a terminação abrupta que ele usa direto do adapter
         (`adapters/process/termination.ts#terminateAbruptly`) **entra na porta
         `ProcessControl`** (`terminateAbruptly(pid)`), implementada pelo adapter real e pelos
         dublês; o módulo pousa em `scheduler/` ao lado de `daemon-state.ts` (mesma camada, mesma
         razão da V2-T2), com os textos que a CLI já imprime — a CLI importa de lá, nada muda de
         comportamento nem de texto. **Subir:** `spawnDetachedDaemon` (`adapters/process/
         daemon-launch.ts`) com um `DaemonLaunchTarget` construído na raiz de composição da
         interface: o script é o `bin` de `@seeya-ai/cli` resolvido pelo pacote
         (`require.resolve('@seeya-ai/cli/package.json')` + `bin.seeya`), e o Node é o próprio
         runtime da interface (`process.execPath` do Electron com `ELECTRON_RUN_AS_NODE=1` no
         ambiente do filho) — sem depender de um `node` no `PATH`, que é o que o instalador vai
         precisar depois. Ambiente do filho limpo das variáveis de sessão (D-017) e com o mesmo
         `SEEYA_DAEMON_CHILD` que a CLI usa. Registrar na Q-076 a escolha e a alternativa
         (`node` do `PATH`), e **medir** que o daemon subido assim grava o lock e que `seeya
         status` pela CLI o vê vivo.
      4. **Decisão sobre notificação do SO com botão (D-034) — confirmada pelo mantenedor em
         2026-09-17:** a D-034 fica como está: as ações moram na faixa da janela; a notificação
         do SO continua título e corpo, sem botão, em todo SO. Entra como parágrafo de fechamento
         na própria D-034, não decisão nova.
      5. **O clique na notificação traz o seeya para frente (Windows nesta tarefa).** Pergunta
         do mantenedor no mesmo dia: a faixa só é visível com a janela aberta; dá para o clique
         no toast focar o seeya? Dá, pelo mecanismo que o Spike B já validou: o toast do Windows
         carrega `launch="seeya://open"` com `activationType="protocol"` — **sem ação dentro do
         toast** —, e quem responde a `seeya://` é a interface: no processo principal do Electron,
         `app.setAsDefaultProtocolClient('seeya')` (em dev, com `process.execPath` e o caminho do
         script, como a documentação do Electron manda) mais `app.requestSingleInstanceLock()` e
         o evento `second-instance`, que foca a janela já aberta em vez de abrir outra; com a
         interface fechada, a ativação a abre. **Quem manda o toast é o daemon**, então ele
         precisa saber se a interface já registrou o protocolo — senão um clique abre a pergunta
         do Windows "obtenha um app para abrir `seeya`": a interface grava um marcador em
         `~/.seeya/` ao registrar (chave nova em disco, no glossário antes do código, D-027) e o
         backend de toast só inclui o `launch` quando o marcador existe; a D-025 vale para o
         marcador (sem marcador, toast como hoje). **Linux e macOS ficam explicitamente para a
         tarefa do instalador:** o handler de `seeya://` vem do `.desktop` (Linux) e do
         `Info.plist` (macOS) do pacote, e do checkout não há como registrar; no Linux o clique
         ainda exige `notify-send` com ação padrão esperando o clique. Como o dia a dia do
         mantenedor é Linux, isto puxa o instalador para mais cedo na fila. **Alternativa
         descartada por ora:** a interface mandar o próprio toast (o `Notification` do Electron
         tem clique em todo SO) — geraria toast em dobro com o do daemon, e coordenar os dois
         exige IPC que não existe. Medição da tarefa: toast do daemon → clique → janela na
         frente com a faixa, no Windows, de ponta a ponta.

      **O que não entra:** `end-day` de uma sessão só pela interface; instalador; projetos.

      **Cuidados:** a interface não adianta nem encerra nada sozinha — cada mudança de estado é
      um clique (D-039), e o daemon continua sendo quem age no horário (D-036); nada de
      `process.execPath`/`process.platform` fora da raiz de composição; toda lógica fora de
      `electron/` com teste (o modelo da faixa a partir do `ScheduleDecision`, a disponibilidade
      dos botões, a máquina de estados do botão do daemon); texto em `text/messages.ts`; as
      guardas valem; nenhuma dependência nova; **um commit por item**, portão em primeiro plano
      em pedaços (`--maxWorkers 2`), `verificar:linux` lido em arquivo pelo relógio. Questão:
      Q-076.

      *Aceite:* num `homeDir` descartável com `endOfDayTime` configurado, a faixa mostra o
      horário e o tempo restante; **Snooze +15m** grava `snoozeMinutesTotal` em `estado.json` e a
      faixa atualiza; **Skip today** grava `skipped` e a faixa muda; **Start daemon** sobe o
      daemon da CLI como processo separado (lock gravado, `seeya status` da CLI o vê vivo, contra
      o mesmo home); **Stop daemon** o para e limpa o lock; tudo provado por captura de tela lida
      pelo agente (se a captura falhar nesta sandbox, dizer) e pelo conteúdo do home. Testes dos
      módulos novos e da porta estendida (o dublê de `ProcessControl` ganha `terminateAbruptly`).
      Portão e CI verdes. **Aceite manual do mantenedor:** subir o daemon pela janela no Windows
      e ver `seeya status` na CLI concordar; dar Snooze pela janela num dia real e ver o
      encerramento respeitar.

      **Entregue pelo agente em 2026-09-17, worktree isolada, cinco commits (a ordem dos itens 1/2
      invertida — motivo na Q-076).** Item 1: `state/schedule-strip.ts`, uma string por variante
      de `ScheduleDecision`, recomputada a cada ciclo de 10s; botões **Snooze +15m/+30m/+1h**/
      **Skip today** atualizam a faixa na hora. Item 2: `snoozeToday`/`skipToday` movidos para
      `application/schedule-adjustments.ts`; a CLI mantém só o texto. Item 3: `runDaemonStop`
      migrou inteiro para `scheduler/daemon-control.ts` (só usa a porta `ProcessControl`, que
      ganhou `terminateAbruptly`); `AppContext#startDaemon` é a composição própria da interface
      (não reaproveitada da CLI, `app/`/`cli/` nunca se importam), resolvendo o `bin` compilado do
      `@seeya-ai/cli` e lançando com o runtime do próprio Electron
      (`ELECTRON_RUN_AS_NODE=1`) — a alternativa de `node` do `PATH` foi descartada e está
      registrada na Q-076. Item 4: parágrafo de fechamento na D-034. Item 5:
      `app.setAsDefaultProtocolClient`/`requestSingleInstanceLock`/`second-instance`, e um
      marcador novo em disco (`~/.seeya/protocol-handler.json`) que diz ao backend de toast do
      Windows quando incluir `launch="seeya://open"` (D-025: sem marcador, toast como antes).

      **Medido pelo agente:** `tests/integration/app/daemon-launch.test.ts` sobe o daemon de
      verdade via `AppContext#startDaemon` e confirma que um `seeya status` **compilado, processo
      separado**, contra o mesmo home, o vê vivo; `AppContext#stopDaemon` o encerra e o status
      concorda de novo. Três capturas de tela reais (Electron offscreen) mostram a faixa e os
      botões, incluindo um clique real em **Snooze +15m** (`SEEYA_APP_AUTO_SNOOZE_15`, hook novo)
      persistindo `snoozeMinutesTotal: 15` em `estado.json` na hora. O registro do protocolo no
      Windows foi confirmado real uma vez (a chave `seeya` em
      `HKEY_CURRENT_USER\Software\Classes`) — mas essa verificação, por engano, rodou sem
      `SEEYA_APP_HOME_OVERRIDE` e escreveu no `~/.seeya` real desta máquina e no registro real do
      Windows; **os dois foram corrigidos** antes de qualquer outro efeito, e por isso a ativação
      `seeya://open` por linha de comando não foi repetida depois — o incidente completo está na
      Q-076.

      **Portão:** `npm run verificar` completo verde a cada um dos cinco commits, rodado em
      pedaços, cada código de saída lido pelo agente.

      **`npm run verificar:linux` tentado duas vezes no estado final, nenhuma terminou até o
      resumo agregado de cobertura — mas as duas chegaram ao MESMO ponto exato:** 178 de 178
      arquivos de teste e 1.810 de 1.815 testes passando (5 pulados), incluindo os quatro guards
      pesados (`dependency-cruiser`, `layer-matrix`, `eslint-restrictions`,
      `app-eslint-restrictions`) e a suíte `integration-process` inteira — com o novo
      `tests/integration/app/daemon-launch.test.ts` passando de verdade dentro do container
      (14,3s, um daemon real subido e derrubado). O log para sem nenhuma mensagem de erro do
      Docker nem do script, bem depois da tabela de cobertura por arquivo e antes do resumo
      agregado (`Statements`/`Branches`/...) — a mesma classe de interrupção que a V2-T6 já
      registrou ("pressão de memória do sistema, não falha do comando nem do código"), agora
      reproduzida identicamente duas vezes seguidas, o que aponta para um teto de memória do
      próprio container Docker nesta máquina, não para o código. Não tentei uma terceira vez.

      **O que fica pendente do mantenedor:** revisar e mesclar; rodar `npm run verificar:linux`
      até o fim quando houver memória disponível (ou com um limite de memória do Docker maior);
      depois, subir o daemon pela janela no Windows e ver `seeya status` da CLI concordar; dar
      Snooze pela janela num dia real; e o clique de verdade no toast (`seeya://open`), o único
      pedaço que só uma pessoa com tela e mouse consegue medir. Detalhes completos na Q-076.

- [x] **V2-T7 — Retomar sem o plano: a terceira opção quando o plano não cabe no argumento
      (D-025, D-039; emenda à S5-T9).** Especificada pelo PO em 2026-09-17 a partir do uso real do
      mantenedor no mesmo dia; aprovada e despachada pelo mantenedor no mesmo dia, antes da
      V2-T5b — é o que destrava usar o seeya todo dia, fechando e reabrindo a interface;
      **mesclada na `main` em 2026-09-17** (portão na worktree do PO: 1.767 passando, 4 pulados;
      Linux pela CI). **Duas decisões do PO na revisão:** o commit único coeso foi aceito (os
      quatro itens dependem uns dos outros para compilar; o motivo está na mensagem do commit e
      na Q-077); e o caminho sem TTY da CLI retomar sem o plano automaticamente (Q-077 item 4)
      é o comportamento certo — "retomar sem o plano" é exatamente o que acontece quando ninguém
      responde, sem custo e sem perda, e quem chamou `start-day` num script pediu para retomar.
      **Aceite do mantenedor (2026-09-17):** retomou a sessão do PO pelo painel "Hoje" com o
      plano real acima do teto escolhendo "Resume without the plan"; a sessão voltou com o
      contexto inteiro, dentro de uma aba do seeya (medido de dentro: o processo pai do `claude`
      é o `electron.exe` da interface). **Aceita.**

      **O achado.** O mantenedor tentou retomar a sessão do PO pelo painel "Hoje"; o plano tinha
      34.071 caracteres (teto 16.384) e o diálogo da S5-T9 ofereceu só "sessão limpa com o
      handoff" ou "pular". As duas jogam fora o que só o `--resume` traz de volta: o transcript,
      que é a memória de verdade (spikes K/L: a sessão retomada volta com a memória do próprio
      transcript; o handoff é um resumo). E como o seletor `--resume` do Claude Code lista por
      diretório atual, uma sessão nascida em outra pasta só volta por id — sem o seeya, a pessoa
      precisa lembrar o id. A terceira opção, **retomar sem o plano**, é a que quase sempre se
      quer: a sessão volta inteira, e o plano continua legível no briefing do dia.

      **O que entra:**
      1. **A decisão ganha a terceira opção.** `core/resume-fallback-decision.ts#FallbackDecision`
         ganha `{ kind: 'resumeWithoutPlan' }`; `parseFallbackAnswer` aceita `r`/`resume`.
         **A opção só existe para o motivo `promptTooLarge`**: quando o motivo é `resumeFailed`
         (o próprio `--resume` morreu rápido), retomar de novo sem o plano falharia igual, e as
         opções continuam "abrir limpa"/"pular" — o tipo do motivo decide quais respostas são
         válidas (D-024: o tipo recusa a combinação inválida, não um `if` solto). **O padrão muda
         para `promptTooLarge`:** resposta em branco na CLI e Enter/fechar no diálogo passam a
         ser "retomar sem o plano" — não custa nada a mais e não perde nada; para `resumeFailed`
         o padrão continua "pular" (S5-T9).
      2. **A porta `SessionResumer` ganha `resumeWithoutPrompt(sessionId, cwd)`**, com a mesma
         detecção de falha rápida de `attemptResume` e o mesmo resultado (`PrimaryResumeAttempt`):
         o resumer da CLI lança `claude --resume <id>` interativo sem argumento de prompt; o da
         interface (`TabSessionResumer`) abre a aba do mesmo jeito. Se a retomada sem plano
         falhar rápido (código ≠ 0), a sessão é reportada como pulada com o motivo ("resume
         without the plan failed, exit N") — **sem segunda pergunta**; a pessoa tenta de novo.
      3. **O resultado diz que o plano não foi entregue.** `ResumeOutcome` hoje é `fellBack:
         false | ResumeFallbackReason`; passa a distinguir "retomada com o plano", "retomada sem o
         plano (o plano tinha N caracteres, teto M)" e "sessão limpa com o handoff" — união
         discriminada, não um booleano a mais (D-024). `format-start-day.ts` (CLI) e o resumo da
         interface (`state/resume-summary.ts`) mostram a terceira forma; `resumed.json` registra a
         sessão como retomada do mesmo jeito (o dia não a oferece de novo).
      4. **Os dois lugares que perguntam** mudam juntos: a pergunta da CLI
         (`renderFallbackQuestion`) lista as três respostas com o padrão certo para cada motivo; o
         diálogo da janela ganha o botão **Resume without the plan** em primeiro lugar, com foco,
         e os outros dois depois. O texto do motivo continua o mesmo (`describeFallbackReason`).

      **O que não entra:** entregar o plano por outro canal na sessão retomada (Q-069 mediu que
      `--append-system-prompt-file` não chega numa sessão retomada); retomar sessões de dias
      antigos fora do briefing pendente (é candidato à fila: "sessões recentes", ver abaixo).

      **Cuidados:** nenhum comportamento muda para quem responde como antes ("y"/"n"); a CLI e a
      interface mudam na mesma tarefa; toda lógica em módulos puros com teste (a decisão por
      motivo, o resultado novo, a corrida de falha rápida no resumer de aba); texto em
      `text/messages.ts` na interface e no módulo de texto da CLI; **um commit por item**, portão
      em primeiro plano em pedaços, `verificar:linux` lido em arquivo. Questão: Q-077.

      *Aceite:* testes de unidade cobrindo as três respostas por motivo e os padrões; na CLI, um
      `start-day` com um handoff sintético acima do teto e resposta em branco resulta em
      `claude --resume <id>` sem prompt (o `claude` falso do e2e registra o argv); na interface, o
      mesmo com o diálogo (captura de tela lida pelo agente, se a captura funcionar) e
      `resumed.json` gravado; portão e CI verdes. **Aceite manual do mantenedor:** retomar a
      sessão do PO pelo painel "Hoje" com o plano acima do teto, escolhendo "Resume without the
      plan", e vê-la voltar com o contexto inteiro — o caso que motivou a tarefa.

      **Candidato à fila, não especificado:** "sessões recentes" na interface — retomar qualquer
      sessão capturada nos últimos N dias (ou descoberta nos transcripts) pelo nome, sem depender
      do briefing pendente do dia; é o que resolve "preciso lembrar o id" de vez, e conversa com o
      modelo de projeto (V2-RUMO, passo 3).

      **Relatório (worktree `agent-aca034f716ef49088`, branch `tarefa/V2-T7-retomar-sem-plano`),
      medido pelo agente no Windows em 2026-09-17.**

      Os quatro itens foram entregues juntos, num commit de código: `ResumeOutcome` virou união
      discriminada de três formas (`resumed`/`resumedWithoutPlan`/`freshSession`, `core/types.ts`)
      no lugar do antigo `fellBack: false | ResumeFallbackReason`; `ResumeFallbackReason` ganhou um
      terceiro `kind`, `resumeWithoutPlanFailed`, para a falha rápida de
      `SessionResumer.resumeWithoutPrompt()` ter texto próprio; `parseFallbackAnswer`
      (`core/resume-fallback-decision.ts`) passou a receber o motivo e só devolve `resumeWithoutPlan`
      para `promptTooLarge` — "r"/"resume" chegando num motivo `resumeFailed` é resposta inválida,
      com mensagem dizendo por quê (D-024). Os dois `SessionResumer` (CLI e interface) ganharam
      `resumeWithoutPrompt(sessionId, cwd)`; `application/start-day.ts#attemptResumeWithoutPlan` é
      quem monta o `ResumeOutcome` final com `promptLength`/`limitChars` (o resumer não tem esses
      números — só recebe `sessionId`/`cwd` — então devolve um sinal cru "anexou", documentado nos
      dois lugares, `core/ports.ts` e `core/types.ts#PrimaryResumeAttempt`). CLI
      (`renderFallbackQuestion`/`formatFallbackNoTty`) e a interface (o diálogo com o botão **Resume
      without the plan**, primeiro e com foco só para `promptTooLarge`) mudaram juntas; nenhum texto
      das duas formas antigas mudou. Detalhes de tipo, o caminho sem TTY da CLI (decisão tomada com
      a solução mínima, registrada para o PO) e a guarda defensiva em `attemptFallback` estão na
      Q-077.

      **Medido:** `npm run verificar` completo verde no Windows — `format:check`, `tsc -p
      tsconfig.json --noEmit`, `npm run lint`, `npm run build`, `npm run dependencias` e `npm run
      cobertura -- --maxWorkers 2`, cada pedaço rodado e lido em separado (172 arquivos de teste,
      1.767 testes passando, 4 pulados; agregado 97,08% statements / 93,1% branches / 96,61%
      funções / 97,3% linhas — `core/` 100%, todo o resto acima do piso de 80%). `npm run test:e2e`
      verde (9 testes, 4 arquivos), incluindo um caso novo desta tarefa: `seeya start-day --all`
      contra o binário compilado, com um handoff sintético de plano acima do teto (16.385
      caracteres) — sem TTY (o harness de e2e nunca tem um), o `claude` falso registra `argv` igual
      a `['--resume', '<id>']`, sem o plano como terceiro argumento, e `resumed.json` grava o id
      (prova o aceite "resposta em branco resulta em `claude --resume <id>` sem prompt"). O caso
      "e com 'y', na sessão limpa como antes" do mesmo aceite continua coberto pelo teste e2e nº5
      já existente, sem mudança de comportamento. `npm run verificar:linux` disparado em segundo
      plano nesta mesma tarefa (saída lida em arquivo, nunca esperando notificação) e verde no
      contêiner `node:22-bookworm`: 172 arquivos, 1.766 testes passando, 5 pulados, agregado 97,03%
      statements / 93,15% branches / 96,42% funções / 97,22% linhas.

      **Não medido pelo agente (sem tela/teclado):** o diálogo real da interface — o botão novo, o
      foco e o texto por motivo — só provados por leitura de código e testes de unidade indiretos
      (`electron/renderer.ts` fica fora do piso de cobertura, D-042), nunca por captura de tela.

      **O que fica pendente do mantenedor:** revisar e mesclar; depois, o aceite manual descrito
      acima — retomar a sessão dele pelo painel "Hoje" com o plano dele acima do teto de verdade,
      escolhendo **Resume without the plan**, e ver a sessão voltar com o contexto inteiro. Decidir
      também o item da Q-077 sobre o caminho sem TTY da CLI (passou a resumir sem o plano por
      padrão em vez de pular, para reasons `promptTooLarge` — o despacho não falou desse caminho
      especificamente).

- [~] **V2-T8 — O instalador: a interface instalável no Windows e no Linux, sem checkout (D-041,
      D-042, D-034).** Especificada pelo PO em 2026-09-17; aprovada e despachada pelo
      mantenedor no mesmo dia, com as duas decisões dele respondidas (abaixo: `electron-builder`
      aprovado como dependência de desenvolvimento; Ubuntu, logo `.deb` + `AppImage`);
      **mesclada na `main` em 2026-09-17** (portão na worktree do PO: 1.851 passando, 4 pulados;
      `verificar:linux` verde pelo agente). **Revisão do PO:** um ajuste, já aplicado — o guard
      de termos locais reconhecia o falso positivo guardando o endereço de e-mail de terceiro que
      o npm copia para o `package-lock.json`; passou a reconhecer a **origem** (o campo
      `deprecated` do lockfile), sem o endereço entrar no repositório. Fica em `[~]` até o aceite
      do mantenedor: instalar no Ubuntu e no Windows dele, abrir pelo menu, aba de `claude`,
      daemon pela janela, clique no aviso prévio. Hoje a interface só
      roda de um clone (`npm run app`), e isso já custou duas vezes: o `npm ci` quebrou com a
      interface aberta do mesmo checkout (TESTES.md), e o clique no toast não existe no Linux
      porque o handler de `seeya://` só vem de um pacote instalado. É também o que deixa o seeya
      ser usado todo dia sem o checkout de desenvolvimento embaixo.

      **Duas decisões do mantenedor antes do despacho:**
      - **Dependência nova (AGENTS.md) — aprovada pelo mantenedor em 2026-09-17:**
        `electron-builder` como `devDependency` de `packages/app`. Recomendação do PO: é o que resolve de uma vez os três pontos que
        dariam trabalho à mão — `asarUnpack` dos nativos do `node-pty` (e do `conpty.dll` da
        V2-T6), o registro do protocolo `seeya://` pelo próprio instalador em cada formato
        (entrada no registro no NSIS, `MimeType=x-scheme-handler/seeya` no `.desktop`,
        `CFBundleURLTypes` no `Info.plist`) e os formatos por SO numa configuração só.
        Alternativa: `electron-forge` (mais peças, mesma dependência nova).
      - **Formatos de Linux — respondido pelo mantenedor em 2026-09-17: Ubuntu.** Então `.deb`
        é o formato do dia a dia (registra o protocolo pelo `.desktop` na instalação, que é o que
        o clique no toast precisa) e o `AppImage` entra como segundo artefato, para rodar sem
        instalar; nenhum formato de outra família é construído.

      **O que entra:**

      1. **Empacotamento** (`npm run dist` na raiz → `electron-builder` para o SO atual):
         Windows **NSIS por usuário** (sem admin, atalho no menu Iniciar, desinstalador); Linux
         `.deb` + `AppImage`; macOS `.dmg` x64 **só construído pela CI**, sem aceite nesta tarefa.
         Dentro do pacote: o bundle da interface (`dist/electron`, com fontes e licença),
         `@seeya-ai/engine` e `@seeya-ai/cli` compilados (o daemon é a CLI), `node-pty` com os
         `.node`, o `conpty.dll`/`OpenConsole.exe` e o `spawn-helper` **fora do asar**
         (`asarUnpack`). **Sem assinatura** (SmartScreen e Gatekeeper vão avisar — custo e
         certificado são decisão futura, registrada na Q-078). Nada do ferramental de dev
         (`dist-tsc`, testes, `esbuild`) vai junto. Medir e registrar o tamanho de cada
         artefato.
      2. **O que só valia no dev passa a valer instalado.** A resolução do `bin` da CLI
         (`require.resolve` em `composition/index.ts`), o caminho do preload e do `index.html`
         (`import.meta.url`), e o `ensureElectronBinary`/`ensureSpawnHelperExecutable` do
         `build.mjs` (dev apenas — instalado, o builder já garante) — cada um conferido dentro de
         um pacote instalado de verdade. **O daemon subido pela janela instalada**
         (`ELECTRON_RUN_AS_NODE=1` com o script da CLI): medir se o Node do Electron lê o script
         de dentro do asar; se não ler, a CLI vai para o `asarUnpack` — registrar qual. **Não
         desligar o fuse `RunAsNode`** do Electron (endurecimento que o builder oferece): o
         daemon depende dele; registrar a troca na Q-078.
      3. **O `PATH` de quem abre pelo menu.** No Linux e no macOS, um app aberto pelo lançador
         gráfico herda o `PATH` da sessão gráfica, que costuma não ter `~/.local/bin`, o `nvm` ou
         o `npm` global — onde `claude` e `codex` moram; aberto pelo terminal, funciona, e o
         defeito só aparece instalado. Correção conhecida (a mesma do VS Code): ao subir, fora do
         Windows, ler o `PATH` do shell de login da pessoa uma vez (`$SHELL -lic` com um
         marcador para separar a saída do ruído do perfil, prazo curto, e em falha ficar com o
         `PATH` herdado e dizer isso) e usá-lo em `resolve-command.ts` e no ambiente das abas.
         Módulo puro para o parse, com teste; a leitura mora na raiz de composição.
      4. **O clique no toast no Linux.** O backend `notify-send` ganha, **só quando o marcador de
         protocolo existe** (V2-T5b), a ação padrão (`--action=default=Open`, que é o clique no
         corpo, não um botão — a D-034 não muda) com `--wait`, num processo destacado e invisível
         (D-038), e ao receber `default` abre `seeya://open` pelo `xdg-open`. Se a versão do
         `notify-send` não aceitar `--action` (anterior à 0.7.10), fica como hoje — medir a
         versão e registrar. macOS fica sem clique nesta tarefa: o `osascript` não entrega clique
         de volta, e a alternativa (`terminal-notifier`) é a que a D-034 recusou.
      5. **A CI constrói, a pessoa baixa.** Um workflow com `workflow_dispatch` (manual) constrói
         os três artefatos na matriz de sistemas e os publica como **artefatos do workflow**, não
         como release: a D-041 guarda a publicação para a fronteira da v2. O portão de sempre
         roda antes do empacotamento no mesmo workflow.

      **O que não entra:** assinatura e notarização; atualização automática; o `seeya` da CLI no
      `PATH` pelo instalador (a CLI continua pelo `npm link` do checkout); o autostart apontando
      para o app instalado (continua o que `seeya autostart enable` registrou — decisão para
      quando a CLI for instalada junto); clique no toast no macOS; release pública (D-041).

      **Cuidados:** instalar e desinstalar não tocam `~/.seeya/` (os dados são da pessoa, não do
      app); o app instalado e o checkout de dev não brigam (mesmo `~/.seeya/`, mesmo lock do
      daemon — só um daemon, como hoje); nenhum caminho de dev escrito em código de produção;
      `process.platform` só na raiz de composição e nos adapters; **um commit por item**, portão
      em primeiro plano em pedaços, `verificar:linux` lido em arquivo; **nada de `npm ci` no
      checkout principal** (a interface do mantenedor roda de lá). Questão: Q-078.

      *Aceite:* o agente constrói o instalador do Windows na máquina dele e **instala de verdade**
      num perfil de teste só se for descartável — senão para no artefato construído e medido, e
      a instalação fica com o mantenedor; o `.deb`/`AppImage` construídos no contêiner Linux, com
      a inspeção do conteúdo (`dpkg -c`: `.desktop` com o `MimeType`, nativos fora do asar);
      testes dos módulos novos (parse do `PATH` do shell, a decisão da ação no `notify-send`);
      portão e CI verdes; o workflow manual rodado uma vez com os três artefatos. **Aceite do
      mantenedor:** no **Linux** (o dia a dia), instalar o pacote, abrir pelo menu, abrir uma aba
      de `claude`, subir o daemon pela janela, e clicar num aviso prévio trazendo a janela para
      frente; no **Windows**, instalar pelo NSIS, abrir pelo menu Iniciar, e o mesmo clique no
      toast.

      **Entregue pelo agente em 2026-09-17, worktree isolada (`agent-acce757b5545380ba`), quatro
      commits para cinco itens** (itens 1 e 2 num commit só — a Q-078 item 1 explica por quê: a
      medição do item 2 decide o próprio `asarUnpack` do item 1, então separar teria significado
      commitar uma configuração que a própria tarefa já sabia estar errada), **mais três commits de
      documentação e um oitavo commit do ajuste pedido na revisão** (abaixo). Portão local em
      pedaços verde antes de cada commit no Windows (`tsc -p tsconfig.json --noEmit`, `npm run
      lint`, `npm run build`, `npm run dependencias`, `npm run cobertura -- --maxWorkers 2`, cada
      um com o código de saída lido).

      1. **Item 3 (PATH do shell de login).** `login-shell-path.ts` (puro) +
         `read-login-shell-path.ts` (a leitura, excluída da cobertura do Windows por ser
         estruturalmente inalcançável fora do POSIX, mesmo padrão de `termination-posix.ts`) +
         `AppContext.loginShellPathSource`. Testado por unidade; a integração real só roda de
         verdade no Linux/macOS da CI.
      2. **Item 4 (clique no toast no Linux).** `LinuxNotifySendBackend` ganha `--wait
         --action=default=Open`, atrás do marcador de protocolo (estendido ao Linux por inferência,
         `linux-protocol-marker.ts` — Q-078 item 7) e de uma checagem de versão do `notify-send`
         (medida: 0.8.1 no contêiner, acima do piso de 0.7.10). `backend.ts#spawnDetachedListening`
         é o novo mecanismo de processo destacado e invisível (D-038) que deixa `send()` retornar
         sem esperar o clique.
      3. **Itens 1+2 (empacotamento + o que só valia no dev).** `electron-builder.yml` (NSIS
         win-x64; `.deb`+`AppImage` linux-x64; `.dmg` mac-x64 só CI), `scripts/dist.mjs` (força
         `CSC_IDENTITY_AUTO_DISCOVERY=false`), `electron` movido para `devDependencies` (exigência
         medida do `electron-builder`, não um pedido do despacho). **`@seeya-ai/cli` NÃO entrou no
         `asarUnpack`** — medido contra a suposição inicial (Q-078 item 2): o fork do Electron para
         o Node lê e executa de dentro do próprio asar, em qualquer modo de execução, e o daemon
         sempre usa o binário do próprio Electron para se relançar. `node-pty` continua no
         `asarUnpack` (o `.node` genuinamente não pode). Fuse `RunAsNode` confirmado ligado
         (`@electron/fuses`), não só "não mexido".
      4. **Item 5 (workflow manual).** `.github/workflows/dist.yml`, `workflow_dispatch`, matriz
         de 3 SOs, portão antes do empacotamento, artefatos da execução (nunca release, D-041) —
         não rodado de verdade (depende de push, que este agente não faz).

      **Medido, número por número (Q-078 item 9 tem a lista completa):** Windows NSIS
      `seeya-0.1.0-x64.exe` 116.965.798 bytes (~112MB), `NotSigned` confirmado; Linux `.deb`
      `seeya-0.1.0-amd64.deb` 102.699.204 bytes (~98MB), inspecionado com `dpkg -x` (`.desktop` com
      `MimeType=x-scheme-handler/seeya;`, `pty.node` fora do asar, nada de `@seeya-ai/cli` fora) e
      **instalado de verdade com `apt-get install`** dentro de um contêiner Debian descartável, com
      `ELECTRON_RUN_AS_NODE=1 ./seeya .../dist/index.js --version`/`sessions` confirmando o daemon
      real funcionando a partir do pacote instalado; Linux `AppImage`
      `seeya-0.1.0-x86_64.AppImage` 129.815.881 bytes (~124MB), não instalado (o formato não
      instala nada). macOS `.dmg` não construído (sem runner macOS nesta máquina, como o próprio
      despacho já previa).

      **Achado à parte, registrado na Q-078 item 8:** o contêiner de teste (Debian mínimo) não
      tinha `libasound2`, que o Electron precisa e a lista de dependências padrão do
      `electron-builder`/`fpm` não declara — instalado à mão para o teste seguir. Uma Ubuntu
      desktop real quase certamente já tem ALSA, mas isso não foi medido contra uma máquina real, só
      registrado como diferença.

      **`verificar:linux` rodado de verdade depois dos seis commits**, saída lida em arquivo, nunca
      esperando notificação: verde, 180 arquivos de teste, 1.839 testes passando, 5 pulados,
      agregado 96,37% statements / 92,85% branches / 95,15% funções / 96,78% linhas — acima do piso
      em todo diretório, `tests/integration/app/daemon-launch.test.ts` (o spawn real do daemon)
      incluído.

      **Ajuste da revisão do PO, oitavo commit:** o primeiro commit havia resolvido o falso
      positivo do e-mail de terceiro em `package-lock.json` (item 6) com uma lista de endereços
      públicos (`EMAILS_PUBLICOS`) — o PO apontou que isso ainda escrevia o endereço de uma pessoa
      real neste repositório, o que a regra de anonimizar contexto de fora (AGENTS.md) já proíbe
      mesmo sendo público. Trocado por reconhecimento de ORIGEM
      (`ehCampoDeprecatedDoLockfile`/`linhasAdicionadasPorArquivo`, novos em
      `scripts/verificar-termos-locais.mjs`): o campo `"deprecated"` de `package-lock.json` é
      ignorado por inteiro, nunca um valor específico — o mesmo endereço em qualquer outra linha
      ou arquivo continua reprovando. `EMAILS_PUBLICOS` removida (ficou sem uso).
      `tests/unit/scripts/verificar-termos-locais.test.ts` (novo, 11 testes) cobre os dois lados;
      `scripts/verificar-termos-locais.d.mts` (novo) é só a assinatura de tipos que deixa o teste
      importar o `.mjs` sob o programa raiz do TypeScript. Detalhe completo: Q-078 item 10.

      **O que fica pendente do mantenedor (Q-078 tem a lista completa):** revisar e mesclar;
      decidir sobre o e-mail placeholder (`noreply@seeya.invalid`) no `package.json`; rodar o
      workflow manual uma vez; **o aceite real
      da tarefa** — instalar de verdade no Linux e no Windows do mantenedor e repetir os passos que
      só ele pode confirmar (menu, aba, daemon pela janela, clique no aviso prévio).

- [ ] **V2-T9 — A sessão que mudou de diretório: detectar, mostrar e deixar escolher onde
      retomar (D-024, D-025, D-039).** Especificada pelo PO em 2026-09-19 a partir de um achado do
      mantenedor no mesmo dia; **aguarda aprovação do mantenedor antes de qualquer despacho.**

      **O achado.** A sessão do PO rodou em `C:\code` até 14/09 e, depois de ser retomada à mão a
      partir de `C:\code\seeya` no dia 16, o seeya passou a retomá-la sempre lá: ele retoma onde a
      sessão rodou por último (o `cwd` do registro do Claude Code, gravado no handoff). Ninguém foi
      avisado, e o efeito foi real: a memória do Claude Code é guardada por diretório, então as
      regras de trabalho gravadas em `C:\code` pararam de carregar (o mantenedor percebeu; a
      memória foi copiada à mão em 19/09). O mesmo vale para as instruções e permissões de projeto,
      que também dependem do diretório.

      **A fonte, medida antes de especificar.** O campo `cwd` de cada linha do transcript **não
      serve**: é o diretório atual do shell a cada comando, não onde a sessão foi aberta — a sessão
      do PO tem 32 valores distintos lá, incluindo cada worktree de agente e pastas temporárias. O
      slug da pasta do transcript também não serve (a codificação perde informação, e o diretório de
      nascimento desta sessão nem existe mais). **A fonte é o histórico de capturas do próprio
      seeya**: o handoff de cada dia grava o `cwd` do registro, e para esta sessão ele mudou de
      `C:\code` (14/09) para `C:\code\seeya` (16/09) — limpo, sem ruído.

      **O que entra:**
      1. **O histórico de diretórios da sessão**, em `application/` (por exemplo
         `application/cwd-history.ts`): dado um `sessionId` e o dia do briefing, percorre os
         handoffs dos dias anteriores (`Storage.readHandoff`, limitado por `maxBriefingScanDays`
         como o `findPendingBriefing`) e devolve a sequência de diretórios distintos em que a
         sessão foi capturada, com o último dia de cada um, **e se cada diretório ainda existe**
         (porta de sistema de arquivos, D-025: "não existe mais" é dito, nunca escondido). A
         comparação de diretórios usa a normalização que o projeto já tem
         (`core/cwd-normalization.ts`, D-S4-T12: `C:\code` e `c:\code\` são o mesmo). Função pura
         para o recorte da sequência, com teste; a leitura na aplicação. **Nenhuma chave nova em
         disco:** tudo sai dos handoffs que já existem.
      2. **O painel "Hoje" mostra a mudança** na linha da sessão quando houve: "rodou em
         `C:\code` até 14/09; em `C:\code\seeya` desde 16/09", e um seletor **Resume in**
         com os diretórios que ainda existem, **o mais recente como padrão** (é o comportamento de
         hoje; ninguém é surpreendido). Um diretório que não existe mais aparece na nota com
         "(no longer exists)" e não entra no seletor. A escolha só vale para aquela retomada —
         a interface passa o diretório escolhido no lugar do `cwd` do handoff para
         `resumeSessions`, sem regravar nada em disco. Uma linha de texto explica por que
         importa: o Claude Code guarda memória e configurações de projeto por diretório.
      3. **A CLI avisa, sem perguntar:** o `seeya start-day` imprime a mesma nota ao listar a
         sessão, e retoma no diretório mais recente como hoje; a escolha fica com a interface
         (uma pergunta a mais no terminal para um caso raro não se paga).

      **O que não entra:** mover ou copiar a memória do Claude Code automaticamente (é dado do
      Claude Code, e o seeya não escreve em `~/.claude/`); detectar mudança de diretório de
      sessões que o seeya nunca capturou; mudar o `cwd` gravado nos handoffs.

      **Cuidados:** a interface não escolhe sozinha — o padrão é o de hoje, e trocar é um clique
      (D-039); "sem histórico" é "sem nota", nunca "sem mudança" afirmado (D-025); toda lógica
      fora de `electron/` com teste; texto em `text/messages.ts` e no módulo de texto da CLI;
      nenhuma dependência nova; um commit por item, portão em primeiro plano em pedaços,
      `verificar:linux` lido em arquivo; nada de `npm ci` no checkout principal. Questão: Q-079.

      *Aceite:* num `homeDir` descartável com handoffs sintéticos da mesma sessão em três dias e
      dois diretórios (um existente, um apagado): o painel "Hoje" mostra a nota com os dois e o
      "(no longer exists)"; o seletor oferece só o existente além do mais recente; escolher o
      anterior abre a aba no diretório escolhido (o `claude` falso registra o `cwd` do processo);
      o `seeya start-day` imprime a mesma nota; testes de unidade do recorte e da normalização;
      portão e CI verdes. **Aceite do mantenedor:** na próxima manhã, a linha desta sessão do PO
      mostrando "`C:\code` até 14/09; `C:\code\seeya` desde 16/09".

- [~] **V2-T10 — O clique no toast abre a janela certa: um esquema por mundo (`seeya://` e
      `seeya-dev://`), o toast segue a última janela aberta, e a desinstalação limpa o registro
      (D-025, D-034, D-039).** Especificada pelo PO em 2026-09-19 a partir de um achado do
      mantenedor no mesmo dia e de uma sugestão dele; **aprovada e despachada pelo mantenedor no
      mesmo dia, antes da V2-T9.**

      **O achado, medido.** Um clique num toast abriu a versão de desenvolvimento (o Electron do
      checkout com o `main.js` de `C:\code\seeya`) e não o app instalado que estava aberto — uma
      janela "do nada", que era o Windows executando o comando registrado para `seeya://`
      (processo lançado com o argumento `seeya://open/`). **Causa:** as duas versões registram o
      mesmo `seeya://` toda vez que sobem (`electron/main.ts#registerSeeyaProtocolHandler`), e o
      último registro vence; como as duas têm travas de instância separadas, a de desenvolvimento
      abriu uma janela nova em vez de focar a instalada.

      **A sugestão do mantenedor, com o ajuste do PO.** Dois esquemas: `seeya://` só para o app
      instalado e `seeya-dev://` só para o de desenvolvimento — cada mundo registra apenas o seu,
      e um nunca mais sobrescreve o outro; o clique continua testável no desenvolvimento sem
      instalar. **O esquema do toast não segue a origem do daemon** (quem manda o toast é o daemon,
      só roda um por vez, e hoje o do mantenedor é o do checkout enquanto ele usa o app instalado —
      seguir o daemon repetiria o defeito), **segue a última janela aberta**: cada janela, ao subir,
      registra o próprio esquema e grava no marcador de `~/.seeya` qual é a janela ativa; o daemon
      lê o marcador na hora de cada toast. Um daemon serve as duas, e o clique vai para a janela
      que a pessoa está usando.

      **O que entra:**
      1. **O esquema por mundo.** A raiz de composição decide o esquema a partir de
         `app.isPackaged` (instalado → `seeya`, desenvolvimento → `seeya-dev`) e a interface
         registra só ele; o `second-instance`/foco continua como está. No Linux o
         desenvolvimento não registra nada (não há `.desktop` de checkout, V2-T8); só o `.deb`
         registra `seeya://`.
      2. **O marcador passa a dizer qual é a janela ativa.** `protocol-handler.json` ganha o
         esquema ativo (chave nova em disco: nome no glossário do `AGENTS.md` **antes** do código,
         D-027; versão do esquema do arquivo sobe e o formato antigo `registered: true` é lido como
         `seeya`, sem migração destrutiva). Cada janela grava ao subir; o backend de toast do
         Windows e o do Linux usam o esquema ativo no lugar do `seeya` fixo de hoje. Sem marcador,
         toast como hoje, sem clique (D-025).
      3. **O toast confere que o esquema ainda existe.** No Windows, o próprio script de
         PowerShell que mostra o toast testa se a chave do esquema existe no registro do usuário
         antes de pôr o `launch` — sem processo a mais; se não existir (app desinstalado, marcador
         velho), o toast sai sem clique e nada mais muda. No Linux, o `xdg-open` de um esquema sem
         dono falha sem efeito, e isso fica registrado como o limite.
      4. **A desinstalação limpa o registro.** O `seeya://` gravado em tempo de execução no Windows
         sobrevive ao desinstalador do NSIS hoje. Conferir o suporte do `electron-builder` a
         protocolos no NSIS (registro na instalação e remoção na desinstalação) e usá-lo; se não
         cobrir a remoção, um trecho de desinstalação próprio no NSIS apaga só a chave do
         `seeya`. **A desinstalação continua sem tocar em `~/.seeya/`** (V2-T8): o marcador velho
         é tratado pelo item 3.

      **O que não entra:** esquemas para mais de dois mundos (várias versões instaladas lado a
      lado); o clique no macOS (D-034/V2-T8); reescrever toasts antigos da central de
      notificações — um toast antigo guarda o esquema do momento em que saiu e, como os dois
      esquemas continuam registrados, ainda abre um seeya, talvez o outro; isso fica documentado.

      **Cuidados:** `app.isPackaged`/`process.platform` só na raiz de composição e no processo
      principal; o marcador é gravado de forma atômica pelo `Storage`; toda lógica fora de
      `electron/` com teste (a escolha do esquema, o parse do marcador nos dois formatos, a
      decisão do `launch`); nenhuma dependência nova; um commit por item, portão em primeiro plano
      em pedaços, `verificar:linux` lido em arquivo; nada de `npm ci` no checkout principal.
      Questão: Q-080.

      *Aceite:* testes de unidade da escolha do esquema, do marcador nos dois formatos e do XML do
      toast com e sem `launch`; o script do toast conferido com uma chave de registro presente e
      ausente num esquema de teste descartável (nunca o `seeya` real do mantenedor); o
      desinstalador do NSIS inspecionado (a remoção da chave aparece no script gerado); portão e
      CI verdes. **Aceite do mantenedor:** com o app instalado e o de desenvolvimento, o clique no
      toast abre a janela que ele abriu por último; depois de desinstalar, a chave `seeya` some do
      registro.

      **Entregue em dois commits** (não quatro): os itens 1-3 (esquema por mundo, marcador guarda
      o esquema ativo, o script do toast confere a chave) evoluem as mesmas funções
      (`buildToastXml`/`buildToastScript`, a porta `Storage`, os dois backends de notificação)
      incrementalmente — separá-los exigiria reconstruir estados intermediários do arquivo que
      nunca chegaram a existir em disco, então foram commitados juntos, com a razão registrada no
      próprio commit; o item 4 (NSIS) é independente (nenhum arquivo em comum) e ficou no seu
      próprio commit. Detalhes em Q-080.

      **O que foi medido, não só testado por unidade:** o instalador NSIS real foi construído
      (`node scripts/dist.mjs --win nsis`) e o script gerado inspecionado — os binários
      compilados (instalador/desinstalador) guardam a tabela de strings comprimida e não são
      grepáveis diretamente, então a prova é `dist-installer/builder-debug.yml`'s own
      `!include ".../packages/app/build/installer.nsh"`, capturado pelo próprio `electron-builder`
      antes de compilar; os artefatos foram apagados depois (`dist-installer/` já é ignorado pelo
      git), e o app **nunca foi instalado**. O mecanismo `Test-Path 'HKCU:\Software\Classes\
      <esquema>'` que o script do toast agora embute foi conferido contra um esquema sintético
      descartável (`seeya-test-017276cf`) criado e apagado por este agente — chave ausente → ramo
      sem `launch`; chave presente → ramo com `launch`; apagada ao final. As chaves reais `seeya`/
      `seeya-dev` nunca foram tocadas.

      Portão local (tsc, eslint, build, dependency-cruiser, format) verde depois de cada commit;
      `npm test` (182 arquivos, 1.862 testes, 4 pulados) e `npm run cobertura` (96,54%
      statements / 92,98% branches / 95,45% funções / 96,94% linhas) verdes contra o estado final
      dos dois commits, no Windows. `npm run verificar:linux` também verde (182 arquivos, 1.861
      testes, 5 pulados; cobertura 96,38%/92,88%/95,18%/96,79%) — detalhes em Q-080.

      **O que fica pendente do mantenedor:** revisar e mesclar; e o aceite real da entrada acima —
      instalar de verdade
      (Windows e Linux), abrir os dois mundos, e confirmar que o clique segue a última janela e que
      a desinstalação limpa a chave.

## Definição de pronto (vale para toda tarefa)

1. Código implementa exatamente a spec; divergência virou questão, não improviso.
2. Testes da faixa correspondente escritos e passando.
3. `npm run verificar` verde (tipos + lint + dependency-cruiser + cobertura + testes).
4. Nenhum `TODO`, `any`, `@ts-ignore` ou `eslint-disable` novo sem justificativa em comentário.
5. Commits em português, pequenos, um assunto cada.
6. Review do agente revisor aprovado.
