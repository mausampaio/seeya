---
id: decision-49
title: 'D-049 — Gancho antes do push agora, pull request quando fechar'
date: '2026-09-24 10:21'
status: accepted
---
## Contexto

O `main` recebe push direto: o PO mescla a branch da tarefa, roda o portão local e publica. A CI roda
**depois** do push. Quando ela acusa vermelho, o conteúdo ruim já está no `main`, e o que resta é
alguém ver e corrigir — foi o que aconteceu duas vezes esta semana (o teste com caminho de Windows
que só quebrou no Linux/macOS, e o script do `.deb` que só quebrou ao empacotar).

O mantenedor cortou o raciocínio do PO em 2026-09-24, depois de o PO ter escrito que manter
`backlog/` fora do filtro da CI protegeria os títulos: *"colocar isso no ci não ajuda em nada
também, para o ci rodar implica que o push já foi aceito e foi parar no remote... a única forma de
garantir seria passar a usar MR e pipe quebrada não mergiar"*. Está certo: CI depois do push é
**detecção**, não guarda — e a D-047 item 5 já diz que o que precisa valer sempre é garantido por
código, não por alguém ver.

## Decisão

**Agora: gancho local antes do push**, com as verificações rápidas (formatação, tipos, lint,
fronteiras de camada e as guardas), versionado no repositório para valer em qualquer clone. O que é
caro — a suíte inteira e a cobertura — continua no portão do PO e na CI.

**Depois, quando o seeya estiver fechado: pull request com verificação obrigatória**, sem push
direto no `main`, com merge bloqueado enquanto a verificação não passar. Palavras do mantenedor:
*"nesse momento em que só a gente faz isso e você revisa tudo, então acho que podemos ir de 2 por
enquanto e quando o seeya estiver fechado aí sim fazemos o 3"*.

## Consequências

- **O erro barato para de chegar ao remoto.** Formatação, tipo, lint e guarda quebrados param na
  máquina, em segundos, antes de o push existir.
- **O caro continua depois.** A suíte inteira leva minutos; pô-la no push tornaria o push
  insuportável e empurraria todo mundo para o `--no-verify`. Fica no portão do PO e na CI.
- **O guarda-corpo termina no `--no-verify`** e em quem empurra de um clone sem os ganchos
  instalados. Não cobre o contorno deliberado; cobre o descuido, que é o que aconteceu de verdade
  aqui.
- **A CI não muda de papel:** continua rodando nos três sistemas e continua sendo a única que vê
  Linux e macOS. Ela deixa de ser tratada como garantia e passa a ser tratada como o que é — a
  segunda rede.
- **A troca para pull request é uma decisão futura já tomada**, não uma ideia solta: quando o
  produto fechar, o `main` deixa de aceitar push direto. O custo declarado é a espera da CI antes de
  cada merge.
