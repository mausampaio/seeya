---
id: TASK-23
title: V2-T29 — Adotar uma sessão existente num projeto
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels:
  - adocao
  - d-047
milestone: m-0
dependencies:
  - TASK-20
  - TASK-22
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

**Depende da V2-T33 e da V2-T34, e segue a D-047:** adotar é **tomar o lock do projeto**
(projeto com lock de outra sessão viva recusa a adoção), e os commits da adoção passam pelas
guardas — um projeto por commit, com o identificador da sessão. Onde esta entrada disser
outra coisa, vale a D-047.

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
   registrado. A retomada é
   **interativa**, no diretório original da sessão, com o diretório do projeto liberado por
   `--add-dir` (mesma montagem da V2-T28, com o `--` já provado no aceite dela) e **sem nenhum
   modo de permissão automática** — o Claude Code pede aprovação a cada escrita.
   **Medir antes de implementar**, com uma sessão descartável criada pelo agente: o spike
   mediu `--fork-session` em modo automático e `--add-dir` em interativo, **nunca os dois
   juntos em interativo**. Se não funcionarem juntos, parar e registrar — não cair de volta
   na sessão original sem o mantenedor decidir.
3. **A instrução**, curta, num lugar só do código (texto voltado à pessoa concentrado, e dentro
   do teto de argumento medido na V2-T7, D-015). O spike mostrou que o texto decide tudo, então
   ela é específica e cobre quatro coisas:
   - **nomear os arquivos pelo caminho**: `AGENTS.md`, `INDEX.md`, o estado atual em
     `status/`, as decisões em `decisions/` — e **nunca** usar a palavra "memória" sem destino
     (a sessão do spike entendeu como a memória do próprio Claude Code e escreveu fora do
     projeto);
   - **o saber-fazer, pelo nome**: como se opera naquele trabalho — ferramentas e skills usadas,
     caminhos de acesso, configuração por ambiente, convenções — num arquivo próprio dentro de
     `context/` (nome fixado no glossário antes do código). É o que o relato do mantenedor
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
