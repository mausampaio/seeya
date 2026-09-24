---
id: decision-27
title: 'D-027 — O diretório de dados é ~/.seeya/, igual ao comando'
date: '2026-09-24 00:25'
status: accepted
---
## Contexto

O projeto tinha três nomes em circulação: o produto **See You Tomorrow AI**, o pacote
`see-you-tomorrow-ai`, o comando `seeya` — e um diretório de dados `~/.see-you-tomorrow/` que não
batia com nenhum deles. Era resíduo do nome anterior ao `-ai`.

## Decisão

`~/.seeya/`, igual ao comando que a pessoa digita.

O argumento decisivo é de descoberta: quem se pergunta "onde o `seeya` guarda as coisas?" chuta o
nome do comando. É o precedente do próprio Claude Code — comando `claude`, diretório `~/.claude/`.
Nome de pacote é coisa de quem instala; nome de comando é coisa de quem usa.

## Consequências

- Trocado enquanto custava uma substituição em documento: **zero linha de código** usava o
  caminho, porque `adapters/armazenamento` (S1-T5) ainda era stub. Depois do S1-T5 e de uma
  semana de uso, custaria código de migração, detecção de diretório antigo e o risco de handoff
  órfão numa pasta que ninguém olha mais.
- A raiz continua **injetável**: nenhum teste toca o diretório real, e o nome não fica espalhado
  pelo código.
- **Não adotamos XDG** (`~/.config/seeya`, `~/.local/share/seeya`) na v1. É a convenção correta
  no Linux e triplicaria a resolução de caminho por plataforma; fica anotado para a v2, quando
  houver usuário Linux de verdade reclamando — não antes.

## Regra que vale além deste caso

Nome de diretório, arquivo de estado ou chave persistida é decisão **barata antes do primeiro
byte gravado e cara depois**. Quando perceber divergência de nomenclatura, corrija enquanto não
há dado de ninguém dentro.
