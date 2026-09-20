# Rumo da v2 — o projeto como unidade de continuidade

_Registrado em 2026-09-10. **É rumo, não decisão:** nada aqui está travado. Cada parte vira uma
decisão (D-0xx) quando for implementada, e pode mudar até lá. Os exemplos são genéricos de
propósito — o projeto é open source, e nenhum dado real de trabalho entra neste repositório._

## De onde veio

Depois de alguns dias usando a v1 de verdade, o mantenedor listou o que ela não resolve. A
primeira lista ia na direção de **governar sessões vivas**: capturar em tempo real, controlar
sessões de vários harness, acompanhar subagentes, tokens e tempo numa interface, e reorganizar as
sessões por projeto. O objetivo continuava sendo não perder nada, mesmo depois de um desligamento
forçado.

Ao testar hipóteses, ele concluiu que esse caminho estava ficando complexo demais e chegou a uma
direção mais simples, que é a registrada aqui:

> O seeya não precisa preservar sessões. Ele precisa preservar **projetos**, ou frentes de
> trabalho. As sessões são apenas formas temporárias de trabalhar neles.

A v1 assume que a unidade de memória é a sessão e a unidade de tempo é o dia. Esta direção muda as
duas coisas: a memória passa a ser o projeto, e o tempo passa a ser contínuo.

## A proposta

**Três nomes, fixados em 2026-09-12 depois da revisão de um segundo harness, para o resto do
documento e para a especificação futura:**

| termo | significado |
|---|---|
| **espaço de trabalho** | o único repositório git que o seeya administra e sincroniza |
| **projeto** (ou frente) | um diretório dentro do espaço de trabalho |
| **repositório associado** | repositório de código da pessoa, que o seeya só observa |

### Projeto persistente

O seeya cria e mantém um diretório para cada frente de trabalho. É um repositório de contexto que
existe independentemente de Claude Code, Codex, Gemini ou de qualquer outro harness.

```text
auth-hardening/
├── AGENTS.md          # instruções canônicas para qualquer harness
├── CLAUDE.md          # só aponta para o AGENTS.md
├── INDEX.md           # porta de entrada: o essencial e onde buscar o resto
├── seeya.json
├── context/           # sistema, restrições, glossário
├── decisions/         # decisões e o motivo de cada uma, inclusive as substituídas
├── plans/             # plano atual e backlog
├── status/            # estado atual, questões abertas, ponto de retomada
├── journal/           # o que cada encerramento produziu
└── references/        # repositórios e trackers associados
```

### Instruções para os agentes

O conteúdo canônico fica no `AGENTS.md`, e os arquivos específicos de cada harness apenas apontam
para ele. As instruções orientam o agente a começar pelo `INDEX.md` e pelo estado atual, consultar
as decisões antes de propor mudanças, registrar o que foi aprovado e por quê, separar proposta,
hipótese e decisão, e manter o ponto de retomada.

Isso não garante que todo agente vá atualizar os documentos corretamente, mas tira do transcript
o papel de memória principal: o contexto passa a existir fora da sessão.

### Abertura das sessões

```bash
seeya project create auth-hardening
seeya project add-repo auth-hardening ../app-api
seeya project add-repo auth-hardening ../app-web
seeya project open auth-hardening --with claude
```

No começo, `open` só executa o CLI do harness escolhido com o projeto como diretório de trabalho.
Sem PTY, sem chat próprio e sem interferir no loop interno do harness. A retomada da sessão
original continua útil, mas deixa de ser indispensável: se a sessão ou o transcript se perderem,
uma sessão limpa continua o trabalho a partir dos arquivos.

### Vários repositórios

O `seeya.json` associa a frente aos repositórios e trackers que ela atravessa:

```json
{
  "schemaVersion": 1,
  "id": "auth-hardening",
  "name": "Auth hardening",
  "defaultHarness": "claude",
  "repositories": [
    { "name": "api", "remote": "https://git.example.com/acme/app-api.git" },
    { "name": "frontend", "remote": "https://git.example.com/acme/app-web.git" }
  ],
  "trackers": [{ "type": "gitlab", "project": "acme/app", "labels": ["security"] }]
}
```

**Duas coisas diferentes, que não se misturam** (mantenedor, 2026-09-12): o **espaço de
trabalho**, que o seeya organiza e sincroniza; e os **repositórios de trabalho** de cada projeto,
que são da pessoa, já existem na máquina dela e o seeya só lê.

**A identidade do repositório de trabalho é separada da resolução local dele.** Um
`"path": "C:\\code\\app-api"` só funciona num dispositivo. O `seeya.json` guarda a identidade —
o remoto — e cada dispositivo guarda, em `~/.seeya/`, onde aquele remoto está nele. **É a pessoa
quem indica onde estão; o seeya não adivinha.** Três portas de entrada, todas alimentando o mesmo
mapa por dispositivo:

- **`add-repo` recebe o caminho local** (`seeya project add-repo <id> ../app-api`): o seeya lê o
  remoto daquele clone (`git remote get-url`), grava a identidade no `seeya.json` e o caminho no
  mapa deste dispositivo. É o fluxo natural de quem cria o projeto onde já trabalha.
- **`open` pergunta quando falta**: em outro dispositivo o mapa não tem aquele remoto, então o
  `open` pergunta onde está, oferecendo `<raiz de código>/<nome>` se a pessoa configurou uma raiz,
  e oferecendo clonar ali se não existir. Clonar é ação da pessoa (tamanho, credenciais); o seeya
  só propõe o caminho.
- **`config` para dizer sem ser perguntado**: um comando explícito no `~/.seeya/` deste
  dispositivo, para quem prefere configurar de uma vez ou não quer prompt.

**A identidade é canônica, não a URL literal.** Dois dispositivos podem chegar ao mesmo
repositório por `git@host:owner/repo.git` e por `https://host/owner/repo.git`; se a identidade
fosse a string, seriam dois repositórios. O `seeya.json` guarda `{ host, owner, repository }`
como identidade e a URL como foi vista como `remote`; para provedores desconhecidos, uma
normalização conservadora da URL.

**Repositório sem remoto** (só local) tem identidade só neste dispositivo: o seeya registra isso e
declara, em outro dispositivo, que aquele repositório não pode ser resolvido lá — em vez de fingir
que existe (D-025).

Quando o harness restringe o acesso ao `cwd`, o adapter dele precisa liberar os diretórios
associados.

### Um repositório para todos os projetos, não um por projeto (recomendação do PO, 2026-09-12)

A pergunta do mantenedor: cada projeto é um repositório, ou o seeya tem **um** repositório
configurado na instalação e tudo mora nele? **Recomendo um só — o espaço de trabalho da pessoa —
com cada projeto como diretório dentro dele.** Os motivos:

- **Descoberta sai de graça.** É o requisito que ele mesmo colocou: o seeya, com a conta da
  pessoa, sabe quais projetos existem no remoto **mesmo os que não estão clonados aqui**, e no
  `open` de um projeto nunca aberto neste dispositivo, já tem o diretório dele. **O clone é do
  espaço inteiro**, sem `sparse-checkout`: os projetos são Markdown e arquivos pequenos, e o
  checkout parcial traria estados e casos de recuperação que não se pagam. Se o volume real um
  dia justificar, entra depois.
- **Um remoto, uma sincronização, uma branch de estado, uma escada de níveis** (seção abaixo).
  Com um repositório por projeto seriam N remotos para configurar e um índice em algum lugar
  dizendo quais existem — e esse índice seria… um repositório.
- **A visão global do `end-day` já está no lugar certo:** todas as frentes num histórico só.
- **A instalação pergunta uma vez** onde o espaço de trabalho mora, com padrão dentro de
  `~/.seeya/` e opção de mudar. O operacional local (`~/.seeya/` fora do espaço de trabalho)
  **nunca** entra no repositório — a separação que a seção de aceite humano já exige.

**O custo, declarado:** a granularidade de compartilhamento é o repositório inteiro. Compartilhar
um projeto com outra pessoa sem compartilhar todos não cabe neste desenho, e o raio de dano de um
remoto público é tudo, não um projeto. Para uma pessoa só — o caso da v2 — isso é aceitável, e o
aviso de remoto público passa a dizer exatamente isso. Compartilhar por projeto é problema de
quando existir outra pessoa, e pode ser resolvido depois por divisão ou por submódulo sem refazer
o resto.

**O fluxo de instalação, confirmado com o mantenedor em 2026-09-12.** A instalação pergunta
duas coisas: onde o espaço de trabalho mora neste dispositivo (padrão dentro de `~/.seeya/`) e
qual é o remoto dele. Três respostas possíveis para o remoto:

1. **Já existe** (um repositório do seeya na conta da pessoa): o seeya clona no caminho local e
   já enxerga os projetos que estão lá — os diretórios só se materializam no `open`.
2. **Não existe e a pessoa quer um:** o seeya **orienta** a criar um repositório vazio e privado
   no provedor dela e a colar a URL — **ele nunca cria o remoto**, nem escolhe o provedor. Com a
   URL, inicializa o espaço de trabalho local com zero projetos, mostra o esqueleto que vai
   commitar (registro do dispositivo, versão do esquema — nada de conteúdo), e publica. O aviso
   de remoto público aparece aqui.
3. **Sem remoto:** válido. O espaço de trabalho nasce como repositório git local, com sincronização
   `off`. O remoto pode ser acrescentado depois por `config`, e aí vale o caso 1 ou 2.

O primeiro projeto entra por `project create`; instalação com zero projetos é o estado normal de
quem acabou de chegar, não um erro.

**Isto resolve a identidade do dispositivo**, que estava aberta: na instalação, o dispositivo se
registra no espaço de trabalho com um identificador gerado (não o nome da máquina) e um rótulo
legível que a pessoa escolhe. O identificador vive em `~/.seeya/` e na branch de estado.

### Três verbos, separados por custo e por leitor (mantenedor, 2026-09-12)

Na v1, `end-day` faz tudo de uma vez: coleta fatos, gera entendimento, escreve o briefing e
encerra sessões. Na v2 o encerramento muda de significado, e um verbo só não serve. O mantenedor
separou em três:

```text
seeya checkpoint [--project <id>]   coleta fatos baratos e registra até onde esta máquina observou
seeya pause <id>                    produz entendimento, lacunas e ponto de retomada da frente;
                                    encerra as sessões dela se a política permitir (D-002)
seeya end-day                       pausa/consolida as frentes ativas e gera a visão global do dia
```

**A separação coincide com a de custo e a de leitor, e é isso que a sustenta:**

- **`checkpoint` é fato: barato, sem modelo, roda sozinho.** Git dos repositórios associados,
  cursor do transcript, arquivos tocados, e o carimbo "esta máquina observou até aqui". **É
  automático por padrão** — ao sair de uma máquina, em intervalo, antes de suspender — com config
  para desligar (D-035: é sobre como a pessoa trabalha). **E nunca toca o repositório do
  projeto:** tudo o que ele produz fica em `~/.seeya/`, fora do git (mantenedor, 2026-09-12).
- **`pause` é entendimento: caro, com modelo, por evento e por frente.** É o "vou almoçar, seeya".
  Roda o detector de lacunas sobre o delta desde o último checkpoint e **propõe** o ponto de
  retomada e a entrada do `journal/`. **O commit no espaço de trabalho só acontece com aceite
  humano**, e o push idem. A terminação é opcional e continua opt-in por projeto: a D-002 não muda
  de lado.
- **`end-day` é para o humano.** Pausa o que ainda não foi pausado, consolida e produz a visão
  global: frentes com atividade, bloqueios, reviews pendentes, sessões sem projeto, trabalho fora
  das frentes conhecidas, e a sugestão **editável** de prioridades para o dia seguinte (D-039).

**Duas regras que a separação exige:**

1. **`end-day` não repete `pause` onde nada mudou.** Quem pausou três frentes durante o dia não
   paga a chamada de modelo de novo à noite: `end-day` só pausa a frente cujo checkpoint mostra
   atividade depois da última pausa. A consolidação é agregação determinística das pausas; só a
   sugestão de prioridades justifica uma chamada pequena de modelo.
2. **O agendamento do daemon vira rede de segurança de `end-day`**, como hoje: se a pessoa
   esqueceu de parar, o horário faz por ela. O que muda é que o caminho principal passa a ser
   `pause`, a pedido, e não o relógio. **Consequência do aceite humano:** o `end-day` agendado
   **propõe e não commita** — ninguém está lá para aceitar. A proposta fica como **rascunho**, e
   o aceite acontece quando a pessoa voltar, o que dá ao `start-day` da v2 um papel natural:
   revisar e aceitar o que ficou proposto. **No `end-day` manual o aceite é opcional, e o padrão
   é não aceitar** (mantenedor, 2026-09-12): ele pergunta se a pessoa quer aceitar agora; se não,
   fica rascunho para o dia seguinte; se sim, aceita e sincroniza no ato.

**Por que o aceite humano não é burocracia (mantenedor, 2026-09-12).** O seeya observa lacunas
pelo transcript, e o transcript carrega o que a pessoa colou numa sessão: caminhos internos,
nomes de sistemas, às vezes segredo. Um commit ou push automático subiria isso para o repositório
do projeto — e, com remoto, para fora da máquina — sem ninguém ter olhado. **A regra que decorre:**

- **`~/.seeya/` guarda o operacional:** cursores, filas, identificadores de sessão, checkpoints,
  propostas ainda não aceitas, e os fatos crus (prompts, mensagens do assistente). Nada disso vai
  para o git.
- **O espaço de trabalho carrega só o que precisa atravessar sessões e máquinas:** decisões,
  estado, plano, ponto de retomada, entradas do `journal/` aceitas, e referências. **Por padrão,
  resumo e ponteiro, nunca prompt cru** — o que cruza é o que a pessoa aceitou ver cruzar.
- **A proposta mostra exatamente o que vai ser commitado**, não um resumo do que vai ser commitado.
  Aceitar às cegas é o mesmo que automático.
- **O operacional local tem retenção, porque concentra o sensível.** Prompts, mensagens, fatos
  crus, checkpoints, propostas pendentes e rejeitadas se acumulam em `~/.seeya/`. Regra inicial,
  a especificar: o conteúdo cru existe para produzir e verificar a próxima consolidação; depois
  do aceite ficam cursores, assinaturas de evidência e metadados mínimos (o bastante para não
  reprocessar), e o cru expira por política configurável (D-035) — com purge explícito e opção
  de desligar a captura textual. Limites e prazos são decisões de quando virar especificação.

**Sem sincronização, a continuidade entre máquinas fica fraca demais** (mantenedor, 2026-09-12):
outra máquina só enxergaria o que foi aceito, e não teria como saber que existe rascunho pendente
em outro lugar. Por isso a sincronização existe, é **aceita** como configuração, e tem níveis —
ver "Sincronização em níveis" na seção seguinte.

**Relação com a v1:** `end-day` e `start-day` da v1 continuam valendo para sessões que não
pertencem a nenhum projeto — é o modo de recuperação, e é o que roda hoje.

### Trackers e transcripts como evidência

Cada informação tem a sua fonte mais confiável:

- objetivo e contexto: o projeto;
- decisões: `decisions/`;
- plano: `plans/`;
- estado da execução: o tracker;
- mudanças concretas: o git;
- discussões ainda não registradas: o transcript recente;
- próximo passo: a combinação de plano, dependências e tracker.

O transcript deixa de ser a memória e passa a servir para achar **atividade que ainda não foi
registrada**. Como só o delta do dia é analisado, o custo fica muito menor do que reconstruir
semanas de contexto.

### Relação com a v1

```text
v1:        sessão → captura → handoff → retomada da sessão
evolução:  projeto persistente → sessão temporária → atualização do projeto
                               ↘ git, trackers e transcripts como evidências
```

A v1 continua valendo para sessões abertas fora do seeya e como mecanismo de recuperação. A
descoberta de sessões, a leitura do git, o handoff e a retomada são reaproveitados.

**Um dado a favor de retomar por identidade, não por diretório** (2026-09-13): o `--resume` do
Claude Code lista sessões pelo slug do diretório atual; a sessão do PO nasceu num diretório que
depois foi renomeado e apagado, e sumiu do seletor mesmo com `cwd` registrado em `C:\code`. O
`seeya start-day` a retomou sem problema, porque procura o transcript pelo `sessionId` em todos os
slugs. Na v2, a identidade de projeto e de sessão nunca deriva de caminho — é o mesmo princípio da
separação entre identidade e resolução local dos repositórios.

### Recorte incremental — reordenado em 2026-09-13: a interface entra cedo

**Por que a interface saiu do fim** (mantenedor, 2026-09-13): *"no meu dia a dia eu não consigo
ficar criando projeto e configurando via CLI; aqui no PC pessoal ainda dá, mas lá eu tenho dez
sessões reais. Não adianta eu ter um projeto com repo e sync e ainda ter dez terminais abertos e
continuar perdido."* O modelo de projeto organiza o **conhecimento**; quem organiza as **sessões
vivas** é a interface. Sem ela, a v2 resolve metade da dor e a validação fica presa ao PC pessoal.

**O que é "básico", proposta do PO a confirmar:** uma janela com os projetos na lateral (nome,
prioridade, estado) e, para cada projeto, **abas de sessão** — terminais embutidos que abrem o
harness escolhido no contexto do projeto. Botões de `pause` e `end-day` por projeto; as
notificações passam a ter ações, que a D-034 já reservava para a interface. **Uma limitação
honesta desde o começo:** só entra numa aba a sessão que a interface abriu; uma sessão já aberta
num terminal externo não pode ser "puxada" para dentro — ela aparece na lista das descobertas, com
retomada pelo mecanismo da v1. A interface **organiza e abre a pedido**; não inicia trabalho sozinha
(D-039).

**Arquitetura, para não nascer duas implementações:** um monorepo com `@seeya/core` (o que hoje é
`core` + `application` + `adapters`), `@seeya/cli` e `@seeya/app`. A interface consome o núcleo
**no mesmo processo**, nunca chamando a CLI por subprocesso. Isso emenda a D-020: passam a existir
duas raízes de composição (`cli/` e `app/`), ambas nomeando adapters concretos, e nenhuma outra.

**A escolha de stack é spike, não suposição**, e há três caminhos, não dois:

- **Electron** com `xterm.js` e `node-pty`: tudo em TypeScript, o núcleo no mesmo processo, o
  terminal embutido passa pelo ConPTY (as lições de janela e console da S4-T6/D-038 valem aqui).
  Custo: binário pesado e memória.
- **Tauri**: a casca é Rust, a interface é web em TypeScript, e o núcleo em Node só entra como
  *sidecar* — um subprocesso com IPC, que é justamente o que a regra acima quer evitar — ou seria
  reescrito em Rust, jogando fora o núcleo testado. Três runtimes num produto de uma pessoa.
- **Sem terminal embutido:** a interface é um painel, e as abas de sessão são abas do terminal
  que a pessoa já usa — no Windows, `wt -w 0 new-tab -d <projeto> <harness>` abre uma aba na
  janela existente do Windows Terminal. Nenhum PTY para embutir, nenhuma janela nova, e a sessão
  fica no terminal de verdade (a exceção da D-038 é exatamente essa). Custo: cada SO tem seu
  mecanismo, e a interface não "vê" o conteúdo da aba.

**Em nenhum dos três a interface vem do npm:** aplicação de desktop se distribui como instalador
(GitHub Releases), e o escopo npm fica para `cli` e `core`. **Decidido em 2026-09-13 (D-042): o
primeiro caminho.** O terceiro caiu porque gerir o terminal padrão de cada distro e de cada
sistema é complexidade sem fim, e validar com um mecanismo que não é o do produto valida pouco.
O spike M valida PTY e TUI dos harnesses dentro do `xterm.js` **no Linux (o dia a dia do
mantenedor) e no Windows**.

1. renomear para `seeya` (S5-T0, D-040) e organizar o monorepo com os escopos — feito (V2-T1);
2. **interface básica** (mantenedor, 2026-09-14: antes dos projetos, porque organizar sessão
   viva não depende do modelo de projeto): a lateral nasce com as **sessões descobertas** da
   v1, abas de terminal embutido e o painel de estado (V2-T2, esqueleto); depois `start-day`
   abrindo abas, `pause`/`end-day` e notificações com ações (V2-T3);
3. **o app como dono do daemon e do autostart** (D-045): posse pelo registro de instalação do
   sistema, a CLI como cliente, a pergunta única de transição, o `seeya` no `PATH` pelo instalador;
4. `seeya project create`, `list`, `show` e `open`, com o template mínimo (`AGENTS.md`,
   `INDEX.md`, estado atual, `decisions/`) e a associação de repositórios — e a lateral passa a
   agrupar as sessões por projeto; **inclui adotar uma sessão existente** (D-045 item 4), com um
   spike antes (acesso de escrita fora do diretório da sessão no `--resume`, e mensagem inicial
   na retomada do Codex);
5. `checkpoint` e `pause`, com a camada de afirmações verificáveis do detector — o `pause`
   propõe a atualização dos arquivos do projeto no lugar do handoff (D-045 item 3); **absorve
   também a D-046** (o teto do encerramento vencido: acima dele, o daemon não captura sozinho);
6. `end-day` global, com `priority` e `status` — é dele a visão da manhã;
7. sincronização em níveis e continuidade entre dispositivos;
8. trackers; detecção de sessões sem projeto; camada semântica do detector;
9. jornada detalhada, depois de o `end-day` global rodar com frentes reais.

## Avaliação do PO (2026-09-10)

**A direção está certa e é melhor do que o caminho anterior.** Ela dissolve três riscos que o
caminho de governar sessões carregava:

- a captura viva, que é cara, vira arquivo escrito durante o trabalho;
- o controle de sessões vivas vira abrir o harness dentro de uma pasta;
- a compatibilidade com outros harness vira `AGENTS.md`, que é o formato que eles já leem.

O desligamento forçado também deixa de ser um problema, porque só se perde o que ainda não foi
registrado. E a proposta cabe inteira na D-039: o seeya monta a estrutura, os agentes escrevem e
ninguém decide pelo mantenedor.

**Ela também resolve o corte múltiplo que a D-039 tinha adiado.** `pause` é um corte que não
encerra o dia — o "até daqui a pouco" chega sem nenhuma mudança no modelo de dia.

**A evidência mais forte a favor é este repositório.** `DECISOES.md`, `QUESTOES.md`,
`PLANO-DE-ENTREGA.md` e `AGENTS.md` são exatamente essa estrutura, e é ela que sustenta quatro
sprints com agentes que chegam sem contexto. **E o repositório também mostra onde a proposta
quebra:** em 2026-09-10 os documentos somavam 10.763 linhas (só o `QUESTOES.md` tinha 5.754), um
volume que uma sessão limpa não lê. O `INDEX.md` e o estado atual resolvem um problema que o
projeto já tem.

### Quatro ajustes

1. **O que só o seeya faz é o detector de lacunas.** A proposta de valor inteira é manter frentes
   de trabalho retomáveis — criar, organizar, abrir, pausar, encerrar, retomar — e **verificar se
   o estado registrado continua compatível com a evidência**; o detector é a parte que nenhuma
   outra peça entrega e a primeira a validar em uso. A proposta depende de os agentes manterem os
   documentos em dia, e eles não fazem isso sozinhos: neste repositório funciona porque o PO
   revisa cada tarefa. O que só o seeya consegue fazer é cruzar o que mudou (git, transcript) com
   o que foi registrado e apontar a diferença. Qualquer um copia o template; o detector é o
   produto. E ele precisa pegar também o documento velho, não só o que falta, porque um estado
   desatualizado **afirma o falso com confiança** (D-025).
   **Isso foi observado aqui antes de virar teoria:** em 2026-09-10, 27 tarefas do Sprint 4
   estavam mescladas e publicadas, mas continuavam marcadas como "em andamento" no plano.
2. **A pasta do projeto é um repositório git.** O "delta desde o último checkpoint" vira um
   `git diff`, o checkpoint vira um commit, e o histórico das decisões vem de graça.
3. **O template começa mínimo:** `AGENTS.md`, `INDEX.md`, estado atual e `decisions/`. O resto
   aparece quando fizer falta. Pela experiência deste repositório, o que carrega peso é o estado,
   as decisões e o plano.
4. **Validar antes de escrever código.** A hipótese central é que uma sessão limpa com essa
   estrutura retoma o trabalho tão bem quanto um `--resume`, e isso pode ser testado agora, sem
   código: é o [spike K](spikes/K-sessao-limpa.md).

**Validado em 2026-09-10 pelo [spike K](spikes/K-sessao-limpa.md):** a sessão limpa retomou o
trabalho com 5 de 5 pendências, respeitou todas as regras de despacho e ainda achou quatro
afirmações falsas no estado escrito à mão pelo PO, no mesmo dia. Com isso, o ajuste 1 deixa de ser
argumento e passa a ser medição: **nem quem escreve com conhecimento total mantém o estado em
dia**, e o que salva é conferir contra a evidência. (A sessão testada tinha lido o protocolo do
spike, então que ela confira **sem ser instruída** fica provável, não medido. Por isso a v2 não
conta com isso: o detector de lacunas é do seeya, não da boa vontade da sessão.) **O [spike
L](spikes/L-outro-harness.md), em 2026-09-12, fechou essa lacuna:** uma sessão limpa do **Codex**
(GPT-5.6), num clone sem histórico e sem protocolo à vista, retomou o trabalho pelo `AGENTS.md`
nativo e apontou três documentos desatualizados antes de ler qualquer menção a teste. **O que
isso valida é a retomada documental** por um segundo harness, sem adaptação do projeto. A
abertura gerenciada (`project open --with codex`), o acesso a repositórios associados fora do
`cwd` e a configuração do sandbox **ainda precisam de adapter e de spike próprios** — ver "Próximo
spike" abaixo.

### Privacidade

O espaço de trabalho fica **fora** dos repositórios que ele referencia, então o contexto de
trabalho não encosta nem no repositório do seeya nem nos repositórios de terceiros. Como é um
repositório só para todos os projetos, o aviso de remoto público diz que o que fica exposto é
**tudo**, não um projeto. O template e
os exemplos publicados usam nomes genéricos. As credenciais dos trackers são do usuário e nunca
entram no `seeya.json`.

## O que continua valendo das análises anteriores

- **O texto denso muda de leitor** (ponto 7 do mantenedor). Hoje ele é escrito para uma sessão
  retomada, que já tem o próprio transcript e por isso o acha redundante. Na v2, os leitores são
  dois, e nenhum deles tem o transcript: o humano no encerramento e a sessão limpa.
- **Priorize o que não se recupera de outro lugar.** Na retomada de 2026-09-08, o briefing gastou
  a maior parte do espaço repetindo o que o `git log` e o `DECISOES.md` já contavam. As três
  informações mais valiosas eram justamente as que não estavam em arquivo nenhum.
- **Diga onde o código está:** branch, o que foi mesclado e não publicado, worktree com trabalho não
  commitado. É a primeira pergunta de quem retoma, dá para derivar, e ficou de fora do briefing.
- **Fato é barato e pode ser contínuo; entendimento é caro e acontece por evento.** O handoff já
  separa `facts` de `understanding`, e o detector de lacunas depende dessa separação.
- **Para outros harness, desenhe a costura e não a abstração.** Faça um harness muito bem e deixe
  o ponto de encaixe onde ele deve ficar. A camada genérica só se constrói quando existir um
  segundo harness de verdade para testá-la.
- **O painel de subagentes da interface é um spike, não uma funcionalidade.** Antes de entrar no
  roadmap, é preciso medir se o tempo, os tokens e a atividade de cada subagente dá para observar
  de fora.
- **O nome já é `seeya`.** O nome longo fica para o repositório. Renomear quebra o pacote, a URL e
  as instalações existentes, então a hora certa é a fronteira de versão.

## O detector de lacunas — desenho (2026-09-11)

Em uma frase: compara **o que aconteceu** com **o que foi registrado** e lista a diferença. Nunca
corrige nada sozinho (D-039): aponta onde o registro falta ou mente, e pode rascunhar a entrada
para a pessoa aceitar.

**As duas fontes.** A evidência: git dos repositórios associados (commits, arquivos sujos,
branches), transcript recente (arquivos tocados, o que foi discutido), tracker, e o próprio
`~/.seeya`. Os registros: estado atual, decisões, plano. A v1 já extrai quase toda a primeira
metade (`commitsToday`, `dirty`, `touchedFiles`, `lastPrompts`).

**Dois tipos de lacuna:**

- **Omissão:** aconteceu e não foi registrado. Doze commits no repositório da API desde o último
  checkpoint e o estado atual não mudou; o transcript discute "X em vez de Y" e não apareceu
  decisão nova.
- **Contradição:** o documento afirma o que a evidência refuta. "CI verde" e a última execução
  falhou; "próximo passo: rodar o spike" e o resultado do spike já existe. É o caso da D-025, e
  foi o que o spike K achou no estado escrito pelo PO.

**Três camadas, da mais barata para a mais cara** (fato é barato e contínuo; entendimento é caro e
por evento):

1. **Estrutural, determinística, sem modelo.** Há dois marcos, e não se confundem: a **última
   consolidação aceita** (um commit no espaço de trabalho) e o **último checkpoint observado**
   (local, do dispositivo, em `~/.seeya/`). Atividade nos repositórios associados posterior à
   última consolidação aceita, vista pelos checkpoints locais, sem atualização correspondente nos
   documentos do projeto, é lacuna candidata: um `git log --since` contra um `git diff`. Pode
   rodar a cada ciclo do daemon.
2. **Afirmações verificáveis.** Os quatro erros que o spike K achou eram **todos conferíveis por
   máquina**: estado da CI, dia do daemon, data do arquivo, status de uma questão. Em vez de o
   modelo ler prosa e adivinhar o que ela afirma, o estado atual declara suas afirmações em forma
   checável (por exemplo, um cabeçalho com `main: <sha>`, `ci: green @ <sha>`,
   `last_capture: <dia>`), e a verificação vira comparação determinística com `git rev-parse`,
   com a CI e com o `~/.seeya`. Foi o que a sessão limpa fez à mão. **É a primeira camada a
   construir:** a mais barata e a que pegou os erros reais.
3. **Semântica, com modelo, só por evento.** No `end-day`, o modelo recebe apenas o delta desde o
   checkpoint (diff dos documentos, log do git, trechos novos do transcript) e responde uma
   pergunta: o que aconteceu que não está nos documentos, e o que os documentos afirmam que a
   evidência contradiz. O custo é limitado pelo delta, não pelo tamanho do projeto.

**A saída** é uma seção do encerramento: evidência, o que falta ou contradiz, e onde deveria ser
registrado.

**Nem toda lacuna tem a mesma certeza, e só uma classe é afirmativa:**

| classe | exemplo | como aparece |
|---|---|---|
| contradição comprovada | o estado diz "CI verde" para um SHA cuja execução falhou | afirmação |
| registro possivelmente velho | o tracker avançou depois da última atualização do estado | candidata |
| atividade sem registro | commits ou discussão sem mudança nos documentos | candidata |

**Risco conhecido: falso positivo.** Muita atividade não precisa de registro (exploração que não
deu em nada). Por isso a dispensa é **persistente** desde a primeira versão: dispensar uma lacuna
grava `{ findingId, resolution: "no-record-needed", reason, resolvedAt }`, e o detector não a
aponta de novo no dia seguinte. Sem isso ele vira alarme diário e a pessoa para de ler.

**Decisões abertas têm forma estruturada no estado.** O spike L mostrou uma sessão transformar
uma decisão pendente do mantenedor na própria recomendação. O estado passa a declarar
`open_decisions` com `id`, pergunta, `status: pending-user`, a recomendação de quem escreveu e
`decided_by`, separando **decisão confirmada**, **decisão que espera a pessoa** e **recomendação
do agente** — uma sessão pode recomendar sem perder de vista de quem é a escolha.

**O K2 testa isso à mão:** estado envelhecido, e ver se a sessão detecta as contradições.

## Prioridade entre projetos e jornada de trabalho (mantenedor, 2026-09-12)

O `end-day` global sugere prioridades para o dia seguinte, e há duas coisas que o seeya **não tem
como saber** e que decidem essa sugestão: qual projeto importa mais, e quanto tempo a pessoa tem.
As duas viram entrada da pessoa, não inferência.

**`priority` é parâmetro do projeto.** Um valor pequeno e ordinal (por exemplo `high` / `normal` /
`low`), não um número solto — o objetivo é a pessoa dizer "este vem primeiro", não calibrar
pesos. Junto com o estado do projeto (`active` / `paused`), é o que o `end-day` usa para sugerir
com mais força as atividades de um projeto do que as de outro. Continua sendo **sugestão
editável** (D-039): `priority` ordena a proposta; quem decide o dia é a pessoa.

**A jornada é configuração da pessoa.** Períodos de trabalho (por exemplo 08:00–12:00 e
13:00–17:00), com o **fim do último período sendo o `endOfDayTime` da v1** — a chave existente vira
caso particular da jornada, com migração. Os avisos prévios e a rede de segurança do daemon
continuam derivando dali.

**A jornada de um dia específico pode ser diferente**, e há dois momentos para dizer isso: no
`start-day` ("hoje só 6 h") ou no aceite do `end-day` da véspera, para quem já sabe. **O ajuste
do dia move também o fim efetivo daquele dia** — é um `snooze` declarado de manhã, na direção que
for — e por isso o daemon passa a saber a que horas a rede de segurança dispara hoje.

**O que o seeya faz com isso, e o limite que precisa ser dito:** a jornada define **quanto** cabe
na sugestão e **em que ordem**; a prioridade define **de qual projeto** vem primeiro. O que o
seeya **não** sabe é quanto cada atividade demora. Ele pode estimar, e a estimativa aparece
**rotulada como estimativa**, nunca como fato (D-025) — a sugestão diz "você tem cerca de 6 h
hoje; eu começaria por isto", não "isto cabe". Se a pessoa anotar estimativas nas atividades, aí a
conta de "cabe/não cabe" tem base; sem isso, o seeya limita e ordena, mas não promete.

**A jornada mora no espaço de trabalho** (mantenedor, 2026-09-12): é da pessoa e viaja entre
dispositivos. A variação por dispositivo não existe como configuração; a exceção é o ajuste do
dia.

**Ordem, decidida em 2026-09-13:** o primeiro recorte leva só `priority` e `status` no projeto,
mais o `endOfDayTime` que já existe. Períodos múltiplos, ajuste do dia e estimativas entram
**depois de o `end-day` global rodar com várias frentes reais**, para serem calibrados sobre
medição e não sobre suposição. O desenho acima fica como rumo.

## Continuidade entre dispositivos (ideia do mantenedor, 2026-09-10)

**Origem:** o mantenedor acompanhava a sessão do PO pelo celular. A conexão caiu, e ao reconectar
o histórico do período desconectado não apareceu mais no aparelho. **Nada se perdeu**, porque tudo
o que foi decidido estava no repositório. O que faltou no celular foi só a conversa.

**Por que a direção da v2 quase entrega isso de graça:** com a pasta do projeto sendo um
repositório git (ajuste 2), continuar em outro dispositivo passa a ser clonar e abrir uma sessão
limpa. O spike K mostrou que uma sessão limpa retoma o trabalho a partir dos arquivos. O transcript
continua preso à máquina onde a sessão rodou, e isso deixa de importar, porque o projeto não
depende dele.

**Cuidados para quando virar funcionalidade:**

- **O remoto é do usuário, e o seeya nunca escolhe onde hospedar.** A pasta do projeto guarda
  contexto de trabalho, que pode ser sensível. O seeya sincroniza com o remoto configurado e mais
  nada.
- **Sincronizar tem um momento certo:** puxar antes do `open` e publicar depois do `end-day`.
  Conflito entre dois dispositivos é problema do git, e o seeya mostra o conflito, sem resolver
  por conta própria (D-039).
- **A D-037 continua intacta** (esclarecido pelo mantenedor em 2026-09-11). Quem atravessa
  dispositivos e sistemas é o **espaço de trabalho**, que é só dado. O seeya é a instalação de
  cada máquina, segue o sistema dela e trabalha sobre o clone local. Nenhum seeya enxerga dois
  sistemas: em cada mundo há um seeya, e todos leem o mesmo projeto.
- **Continuar pelo celular sem o computador ligado** dependeria de uma sessão na nuvem abrir o
  espaço de trabalho. Isso só funciona se o remoto for acessível por ela, o que volta ao
  primeiro cuidado.

**O transcript é da máquina; o resto não** (levantado pelo mantenedor em 2026-09-11). Começar o
dia no computador e fechar no notebook deixa o notebook com git e tracker, que viajam pelo remoto,
mas sem o transcript do computador. Misturar os dois checkpoints faria o notebook achar que "delta
desde o checkpoint" cobre tudo.

- **Dois checkpoints.** O do projeto (o commit) é global. O cursor do transcript é local: cada
  seeya guarda até onde leu os transcripts da própria máquina.
- **Quem tem o transcript o converte em fato — e o fato só cruza depois de aceito.** O
  `checkpoint` da máquina registra em `~/.seeya/` até onde ela observou; o `pause` transforma isso
  em proposta; o aceite humano commita a entrada do `journal/` (resumo e ponteiros, nunca o
  transcript) e publica. É o "até daqui a pouco" servindo de sincronização, com a pessoa no laço.
- **Visão parcial se declara parcial** (D-025 aplicada ao próprio detector). O que outra máquina
  pode dizer depende do nível de sincronização abaixo: com estado sincronizado, "há rascunho não
  aceito no computador X desde as 14:00"; sem nada, apenas "a última consolidação aceita do
  computador X foi às 14:00". Nunca mais do que a evidência sustenta.

**Sincronização em níveis** (proposta do mantenedor em 2026-09-12, com a escada organizada pelo
PO). Uma config só, em que cada nível inclui o anterior:

| nível | o que cruza | para onde |
|---|---|---|
| `off` | nada; tudo fica local | — |
| `state` | só metadados: identidade do dispositivo, último checkpoint, "há rascunho aberto" — **sem conteúdo** | a branch de estado **deste dispositivo** (`seeya/state/<device-id>`) |
| `accepted` | o que a pessoa aceitou: decisões, estado, `journal/` | `main` do espaço de trabalho |
| `drafts` | também os rascunhos não aceitos, como **documentos de proposta**, nunca como árvore modificada | a mesma branch de estado do dispositivo, nunca `main` |

Regras que decorrem:

- **`checkpoint` é automático e local**; nunca sincroniza por si.
- **`pause` é manual, tem aceite, e sincroniza depois do aceite** (nível `accepted` ou acima).
- **`end-day` agendado gera rascunho** e o sincroniza só no nível `drafts`. O `start-day` em
  outra máquina **detecta o rascunho vindo de outro dispositivo** e oferece revisar e aceitar ali.
- **O rascunho é dado, não árvore** (mantenedor, 2026-09-12). Em vez de uma branch com o
  espaço de trabalho já modificado, o seeya guarda um **documento de proposta**: evidência
  (repositórios, trackers, sessões) e mudanças propostas (estado atual, questões abertas, próximos
  passos, ponto de retomada, lacunas achadas), com identidade do dispositivo, carimbo de hora e
  status (`pending`/`accepted`/`rejected`). Esboço:

  ```json
  {
    "schemaVersion": 1,
    "proposalId": "desktop-2026-09-12T18:00:00Z",
    "deviceId": "desktop",
    "status": "pending",
    "capturedAt": "2026-09-12T18:00:00Z",
    "evidence": { "repositories": [], "trackers": [], "sessions": [] },
    "proposedChanges": { "currentStatus": [], "openQuestions": [], "nextSteps": [] }
  }
  ```

  **O aceite em outro dispositivo não resolve conflito nenhum:** o seeya aplica as mudanças
  propostas sobre a árvore **atual** e monta o commit proposto para a pessoa aceitar. Isso não
  fere a D-039 — o documento é território do seeya, e quem aceita o commit continua sendo a
  pessoa. Várias propostas pendentes de vários dispositivos são aplicadas em ordem de
  `capturedAt`, cada uma mostrada antes de entrar.
- **O aceite autoriza um diff sobre uma base específica.** Dois dispositivos podem aceitar
  propostas ao mesmo tempo, e `main` pode andar entre o fetch e o push do mesmo dispositivo. A
  regra: antes de mostrar o commit, o seeya atualiza a base remota; antes do push, confere que a
  base continua a mesma; se mudou, **recompõe a proposta sobre a árvore atual e pede novo
  aceite** — porque o diff que a pessoa aprovou pode não ser mais o mesmo. Nunca resolve
  divergência de conteúdo em silêncio (D-039).
- **Conflito de conteúdo de verdade** só sobra no caso sem sincronização — a pessoa muda para um
  dispositivo desatualizado, o trabalho continua lá, e `main` já andou — ou quando a recomposição
  toca a mesma seção que outro dispositivo mudou. Aí é resolução normal do git, e o seeya
  **mostra** sem resolver.
- **Consequência para o template:** para "aplicar mudanças propostas" não ser adivinhação sobre
  prosa, os arquivos que o seeya escreve precisam ter **seções que ele reconhece** (cabeçalho
  estruturado ou blocos delimitados). O que a pessoa escreve fora dessas seções é dela e o seeya
  não toca.
- **`drafts` é o nível em que conteúdo não revisado sai da máquina.** É onde o aviso de remoto
  público pesa mais, e a escolha desse nível traz o aviso junto. Mesmo aí, o que cruza é resumo e
  ponteiro; o cru (prompts, mensagens) nunca sai de `~/.seeya/`.
- **Padrão:** `off` sem remoto configurado; ao configurar um remoto, `accepted`. Subir para
  `drafts` é escolha explícita.

**Aberto, para quando virar especificação:** o identificador de dispositivo ficou resolvido na
seção "Um repositório para todos os projetos" (gerado na instalação, com rótulo). A dúvida anterior sobre `state` versus `accepted` se
resolveu com o rascunho-como-dado: `state` e `drafts` usam a branch de estado **do dispositivo**
(`seeya/state/<device-id>`) — `state` carrega só o cabeçalho da proposta (dispositivo, hora,
status), `drafts` carrega o documento inteiro. **Uma branch por dispositivo, e cada dispositivo é o
único escritor da sua**: duas máquinas avançando a mesma branch a partir de bases diferentes
teriam push recusado mesmo gravando propostas independentes. Os outros dispositivos só buscam
(`refs/heads/seeya/state/*`) e agregam. O aceite de uma proposta alheia é registrado em `main`; o
dispositivo dono atualiza a própria branch no sync seguinte.
- **O que reduz o problema:** na v2 o transcript é complementar. O que a sessão registrou nos
  documentos e commitou já viajou pelo caminho normal; o transcript só importa para o que não foi
  registrado, e isso é detectado onde ele vive.
- Fatos derivados de transcript só entram no espaço de trabalho como resumo aceito, com teto
  de tamanho; o cru fica em `~/.seeya/`.
- O cenário multi-máquina fica **depois** do passo 5 do recorte, mas a regra "declare quando a
  visão é parcial" entra desde a primeira versão, para o caso de duas máquinas degradar de forma
  honesta em vez de errada.

**Quem configura o remoto** (decidido como direção pelo mantenedor em 2026-09-11): **o seeya
oferece a opção**, porque toda a sincronização depende dela e deixar para a pessoa fazer à mão é
deixar a funcionalidade principal sem chão. Mas a oferta vem com aviso claro, no momento da
escolha, de que **um remoto público expõe o contexto de trabalho** do projeto — decisões,
estado, fatos derivados de transcript. O seeya nunca escolhe o provedor nem cria o repositório
remoto; só aponta para o que a pessoa indicou, e recusa silêncio: sem remoto configurado,
`pause`, `end-day` e `start-day` declaram que o estado está restrito a esta máquina, em vez de
parecerem sincronizados. O `checkpoint` é local por definição e não acusa ausência de
sincronização como falha.

## Próximo spike: a abertura gerenciada (M, ainda não rodado)

O spike L validou a estrutura documental com um segundo harness. O que falta validar é a
**costura operacional**: criar um projeto no espaço de trabalho; associar dois repositórios
externos; executar `project open --with claude` (ou o equivalente manual); verificar leitura e
alteração nos repositórios associados fora do `cwd`; verificar qual instrução o harness carrega;
testar as restrições de sandbox e permissões; encerrar a sessão por completo; abrir uma sessão
limpa e retomar pelo projeto; repetir com o Codex. Cada harness terá seu custo de permissões — o L
já mostrou o do Codex no Windows.

## Relação com o Sprint 5

Nada disto invalida o Sprint 5: a v1 sai como está. O único ponto de contato é o `seeya init`
(S5-T2), que pode evoluir para o `project create`. Essa escolha fica para quando a S5-T2 for
especificada.
