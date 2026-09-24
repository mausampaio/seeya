---
id: decision-45
title: 'D-045 — Na v2 o app é dono do daemon/autostart; a CLI vira cliente'
date: '2026-09-24 00:48'
status: accepted
---
## Contexto

Título original completo: "Na v2, o app é o produto: ele é dono do daemon e do autostart, a CLI
vira cliente, e o handoff sai do centro".

**Decisão do mantenedor, em 2026-09-19**, a partir de uma confusão medida e de três conversas no
mesmo dia.

**O que a motivou.** Com o instalador (V2-T8), a máquina do mantenedor passou a ter duas cópias do
seeya controlando a mesma coisa: o autostart e a CLI no `PATH` apontavam para o checkout, a janela
de uso diário era o app instalado, e o daemon rodava o código de quem o tivesse subido por último.
O lock impede dois daemons ao mesmo tempo, mas nada mostrava qual versão estava no comando, e um
clique no toast chegou a abrir a versão errada (V2-T10). Nas palavras do mantenedor: *"a confusão
acontece por existir dois mecanismos que controlam a mesma coisa"*, e *"na v2 o cli serve mais
como uma ferramenta de apoio para o app, algo para usar em scripts e integrar com outras
ferramentas, quase que como uma API local"*.

## Decisão

**1. Quem é dono do daemon e do autostart.** Se o app está instalado, **o daemon e o autostart são
só dele**; a CLI age como cliente, e os comandos dela que controlam o daemon (`daemon`,
`autostart enable`) recusam e apontam para o app. Se a CLI está instalada sozinha (servidor, WSL,
máquina sem interface), ela continua dona do próprio daemon, como na v1. As transições:
- **CLI antes, app depois:** na primeira abertura, o app encontra o daemon e o autostart da CLI e
  **pergunta uma vez** se pode assumir; aceitando, para o daemon da CLI, reaponta o autostart para
  si e sobe o próprio. Os dados em `~/.seeya` são os mesmos — nada migra. Perguntar, e não assumir
  calado: derrubar um processo que a pessoa subiu, sem avisar, surpreende.
- **App antes, CLI depois:** o instalador do app já põe um `seeya` no `PATH`; uma CLI instalada à
  parte detecta o app e age como cliente — dois clientes no `PATH` são inofensivos.
- **App desinstalado:** o desinstalador remove o autostart do app; a CLI volta a poder ser dona,
  **só quando a pessoa pedir** (`seeya autostart enable`).

**2. Como se sabe que o app está instalado: pelo registro do próprio sistema**, não por um arquivo
nosso. Observação do mantenedor: um marcador em `~/.seeya` serve para validar, mas *"opções assim
disponíveis para alguém ir lá e apagar são um problema"* — apagá-lo devolveria o conflito. O
sistema já registra a instalação, e esse registro só some desinstalando: no Windows, a entrada de
desinstalação que o instalador cria (a de "Aplicativos instalados", com o local da instalação); no
Linux (`.deb`), o banco de pacotes do sistema; no macOS, o app em Aplicativos. O `AppImage` não tem
registro de instalação por natureza e, portanto, **não é dono** do autostart. O arquivo em
`~/.seeya` fica só para estado de uso (qual janela está ativa, V2-T10), nunca para posse.

**3. O handoff sai do centro.** Com projetos que têm repositório próprio, a memória durável é o
repositório do projeto (`AGENTS.md`, `INDEX.md`, estado atual, decisões) e a memória viva é a
própria sessão retomada — *"ou a gente dá resume na sessão e deixa o contexto fazer seu trabalho,
ou uma sessão limpa lê do README/AGENTS de forma muito mais limpa que o handoff"*. A V2-T7 já
mostrou isso em uso: retomar sem o plano foi preferível a perder o contexto. Da captura de hoje
ficam: os **fatos baratos** (git, cursor do transcript, arquivos tocados — sem modelo, sem custo),
que viram o `checkpoint` e alimentam o detector de lacunas; e o **entendimento do modelo**, que
deixa de ser um documento à parte e vira **proposta de atualização dos arquivos do projeto** no
`pause`, com aceite humano (V2-RUMO). O handoff da v1 continua só para sessões sem projeto, como
modo de transição. A visão da manhã passa a vir do `end-day` global, não do briefing.

**4. Adotar uma sessão existente ao criar um projeto** (sugestão do mantenedor). Quem começa a usar
o seeya já com trabalho em andamento escolhe uma sessão da lista de sessões descobertas (sem
lembrar id), o seeya cria o projeto e **retoma a sessão com uma instrução curta** explicando o que
é o projeto e pedindo que ela mesma preencha o `AGENTS.md`, o `INDEX.md`, o estado atual e as
decisões a partir do que sabe. Isso inverte quem escreve: em vez de um modelo resumir o transcript
de fora, com perda, **a sessão externaliza a própria memória**. Os arquivos escritos passam pelo
aceite humano antes de qualquer commit (a mesma regra protege contra algo sensível do contexto ir
para o repositório). Onde o seeya não conseguir entregar a instrução — o Codex hoje, ou outra
ferramenta —, ele **gera o texto para a pessoa colar** na sessão. Antes de implementar, um spike
curto mede: retomar com acesso de escrita a um diretório fora do da sessão (o Claude Code tem um
parâmetro de diretórios adicionais, nunca medido junto com o `--resume`), e se o Codex aceita uma
mensagem inicial na retomada (ele tem `codex resume <id>`; a mensagem inicial nunca foi medida).

## Consequências

**O que não muda:** o motor continua um só (D-043), com as duas raízes de composição; a CLI
continua existindo e testada; os dados em `~/.seeya` não mudam de formato por esta decisão.

## Emendada

**Emendada pela D-047** (2026-09-22): o item 4 acima deixava o mecanismo de adoção em aberto (o
spike que mede "retomar com acesso de escrita a um diretório fora do da sessão" e "mensagem
inicial na retomada"). A D-047 item 6 fecha esse mecanismo: a adoção roda **numa cópia** da
sessão, nunca na sessão original — a cópia vira a sessão do projeto, e a original fica intocada
como ponto de restauração, marcada para não ser adotada de novo; harness sem cópia medida não
adota. A D-047 é explícita, no próprio corpo, que o item 1 (quem é dono do daemon) **não muda**.
