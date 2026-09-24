---
id: decision-47
title: 'D-047 — Uma sessão escreve o projeto por vez, garantido por código'
date: '2026-09-24 00:50'
status: accepted
---
## Contexto

Título original completo: "Um projeto, uma sessão escrevendo por vez; e o que precisa valer
sempre é garantido por código, não por instrução".

**Decisão do mantenedor, em 2026-09-22**, construída numa conversa com o PO sobre a adoção de
sessões (D-045 item 4) e sobre como desfazê-la. Rege tudo o que escreve dentro de um projeto do
espaço de trabalho.

**O que a motivou.** Três perguntas do mantenedor, em sequência. (1) Uma sessão adotada no projeto
errado deixaria "sujeira" que precisaria ser revertida — e o espaço de trabalho é **um**
repositório git para todos os projetos, então commits de projetos diferentes se misturam. (2) Um
projeto pode ter mais de uma sessão viva? Se sim, elas escrevem no mesmo repositório sem saber uma
da outra. (3) O PO propôs que cada sessão escrevesse um diário próprio e que os arquivos canônicos
só mudassem no `pause`, consolidados pelo seeya. O mantenedor recusou, com o argumento que decidiu
a questão: **consolidar diários no `pause` é o problema do transcript mudado de lugar** — alguém
teria de ler diários enormes, arbitrar conflitos entre sessões que nunca se viram e gastar tokens
redecidindo o que já tinha sido decidido durante o trabalho. A alternativa veio de uma ferramenta
de orquestração de agentes que ele usa: um **lock** no diretório de trabalho. Por fim, sobre como
fazer as sessões obedecerem: *"regra em agents.md pode ser seguida, mas não é certeza, se
quisermos que isso aconteça sempre tem que virar determinístico"* — por experiência dele, mesmo
com regra escrita, o agente às vezes ignora (contexto grande, compactação, ou simplesmente porque
o harness não é determinístico).

## Decisão

**1. Uma sessão escreve o projeto por vez, e escreve na hora.** Antes de escrever no projeto, a
sessão segura o **lock do projeto**. Com ele, edita os arquivos canônicos (`AGENTS.md`,
`INDEX.md`, decisões, estado) **no momento em que decide** — sem rascunho paralelo para consolidar
depois. Quem chega com o lock tomado pode abrir o projeto **para ler** e trabalhar no próprio
código; não escreve no projeto até o lock ser liberado. O motivo, nas palavras do mantenedor: o
repositório do projeto é o tracker — quem está atuando vai escrever regras novas, e o próximo tem
de agir em cima delas, não de algo que está sendo modificado.

**2. O lock tem de sobreviver ao mundo real.** O risco número um é o lock abandonado: sessão que
fecha sem liberar, máquina que reinicia, compactação que faz o agente esquecer que o segura. Por
isso o lock guarda a identidade do processo da sessão e **lock de processo morto é velho e pode
ser tomado**, com aviso — a mesma checagem de vivacidade que o `daemon.lock` já usa (pid +
`procStart`). Ele mora dentro do projeto, para o agente enxergar, e **nunca é commitado** — é
estado operacional, não conteúdo. Liberação explícita no `pause`, no fim do dia e ao sair.

**3. O diário é rascunho, não arquivo.** Cada sessão pode manter o seu, mas ele só vive enquanto
algo não virou regra; quando vira, sai dali. Sem essa limpeza, o diário vira um transcript pior que
o transcript — sem limite e sem compactação. Como tudo está em git, limpar não perde nada.

**4. Quem segura o lock commita, e todo commit diz de quem é e de qual projeto.** O commit leva o
identificador da sessão e toca **um único projeto**. É isso que torna o desfazer preciso: reverter
uma adoção é reverter os commits daquela sessão naquele projeto, do mais novo para o mais antigo,
recusando se algum commit posterior de outra origem mexeu nos mesmos arquivos. Isso também corrige
um defeito que já existe: o commit do seeya hoje faz `git add -A` no espaço de trabalho inteiro.

**5. O que precisa valer sempre é garantido por código.** A instrução no `AGENTS.md` do projeto
continua existindo — explica o porquê —, mas quem garante é a guarda. Cada regra acima que tem de
valer sempre vira verificação determinística, em camadas:
- **ganchos de git no repositório do espaço de trabalho**, instalados e reafirmados pelo seeya:
  recusam commit sem o identificador da sessão, commit que toca mais de um projeto, commit de quem
  não segura o lock do projeto, e commit que inclua o próprio arquivo de lock;
- **gancho do harness no diretório do projeto** (onde o harness permitir; no Claude Code, as
  configurações de projeto), que recusa os comandos que furam os ganchos de git, como
  `--no-verify`;
- **auditoria do seeya** nos pontos em que ele já passa (abrir, `pause`, fim do dia): o histórico
  desde a última auditoria é conferido contra as mesmas regras, e o que escapou é mostrado.

**6. A adoção segue estas regras.** Adotar é tomar o lock do projeto: projeto com lock de outra
sessão viva recusa a adoção. A adoção roda numa **cópia** da sessão (onde o harness oferecer uma,
medida): a cópia vira a sessão do projeto — ela tem o histórico e sabe o que escreveu —, e a
original fica intocada como ponto de restauração, marcada como já adotada para não ser adotada de
novo. Harness sem cópia medida não adota até haver uma forma que não toque a original.

## Consequências

**Onde o guarda-corpo termina, dito sem rodeio:** cobre o descuido e o agente que "esqueceu" a
regra; não cobre o contorno deliberado — alguém que forje o identificador de outra sessão, ou um
harness sem gancho que rode `--no-verify`. Nesse caso a terceira camada, a auditoria, é o que
aparece, depois do fato.

**O que não muda:** a D-045 (quem é dono do daemon) e a separação entre `~/.seeya/` e o espaço de
trabalho (V2-T27).
