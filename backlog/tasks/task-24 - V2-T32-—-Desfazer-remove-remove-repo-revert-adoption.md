---
id: TASK-24
title: 'V2-T32 — Desfazer: remove, remove-repo, revert-adoption'
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels:
  - desfazer
  - d-047
milestone: m-0
dependencies:
  - TASK-20
  - TASK-23
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T32 — Desfazer: `seeya project remove` e `seeya project remove-repo`.** Especificada
pelo PO em 2026-09-22, a partir de uma pergunta do mantenedor no mesmo dia (*"criamos
remove/delete project?"*). Não criamos: hoje o projeto só tem `create`, `list`, `show`,
`add-repo` e `open`, e nada que desfaça.

**O que entra:**
1. **`seeya project remove <id>`** apaga o diretório do projeto do espaço de trabalho e
   **commita a remoção**. Como o espaço de trabalho é um repositório git, remover não é
   destruir: o conteúdo continua no histórico, e a saída do comando diz em uma linha como
   recuperar (o commit anterior). Pede confirmação antes, com o nome do projeto e quantos
   arquivos ele tem.
2. **`seeya project remove-repo <id> <nome>`** tira o repositório do `seeya.json` e commita.
   A entrada no mapa do dispositivo (`repository-map.json`) só sai se nenhum outro projeto
   usar a mesma identidade.
3. **`seeya project revert-adoption <id>`** (acrescentado pela D-047 item 4): lista os commits
   da sessão adotada naquele projeto — é o identificador de sessão que cada commit carrega
   desde a V2-T33 que torna isso possível —, mostra, pede confirmação e reverte do mais novo
   para o mais antigo. **Recusa e diz qual** se algum commit posterior de outra sessão mexeu
   nos mesmos arquivos: nunca reverte pela metade. Depois de reverter, apaga a cópia de
   adoção e desmarca a sessão original, que volta a poder ser adotada. **Depende da V2-T33 e
   da V2-T29.**
**Revisão do PO em 2026-09-24**, depois que a V2-T29 construiu a adoção (`adoptions.json`, a cópia
promovida que sai do `forks.json`, o lock com o id da cópia):

5. **`revert-adoption <id> [<sessão>]`** — um projeto pode ter mais de uma sessão adotada (a D-047
   só proíbe uma sessão em dois projetos), então a sessão é obrigatória quando houver mais de uma
   adoção no projeto; com uma só, pode ser omitida. A sessão é identificada pelo nome ou prefixo,
   como no `adopt`, e casa com `adoptions.json` pela original **ou** pela cópia.
6. **A cópia adotada pode ter continuado em uso** — pela D-047 ela vira a sessão do projeto. Antes
   de apagá-la no revert, o seeya compara o transcript da cópia com o momento da adoção
   (`adoptedAt`): se ela cresceu depois, **avisa, diz quanto, e só apaga com confirmação explícita**
   (a resposta padrão é manter). A autorização para apagar vem do registro em `adoptions.json` — a
   cópia promovida já saiu do `forks.json` —, e continua valendo a regra de só apagar o que o seeya
   criou e registrou (D-012).
7. **`remove` com adoções**: remover um projeto tira de `adoptions.json` as adoções daquele projeto
   (as originais voltam a poder ser adotadas) e **não** apaga as cópias — pelo item 4, remover nunca
   apaga sessão; elas passam a ser sessões comuns na descoberta. A saída diz quais eram.
8. **Lock (D-047):** `remove`, `remove-repo` e `revert-adoption` recusam, com o texto de aviso da
   V2-T35, quando outra sessão viva segura o lock do projeto; com o lock livre, tomam e soltam no fim,
   como o `open`.

4. **Nada toca fora do espaço de trabalho e do `~/.seeya/`.** Remover um projeto nunca apaga
   repositório associado, sessão ou transcript — o seeya só é dono do que ele criou.

**O que não entra:** "mover" uma sessão adotada para outro projeto como operação própria —
pela D-047, uma sessão não é adotada por dois projetos; mudar de projeto é reverter a adoção
(item 3) e adotar de novo.

**Cuidados:** nenhuma dependência nova; confirmação obrigatória no `remove`; testes com
espaço de trabalho descartável.

**Aceite do mantenedor:** remover o projeto de teste criado no aceite da V2-T28, ver que o
repositório associado continua intacto, e recuperar o projeto pelo histórico seguindo a linha
que o comando imprime. E, com uma adoção de teste aceita, rodar `revert-adoption`: os commits da
adoção somem do projeto, a sessão original volta a poder ser adotada, e a cópia só é apagada
depois da pergunta.
<!-- SECTION:DESCRIPTION:END -->
