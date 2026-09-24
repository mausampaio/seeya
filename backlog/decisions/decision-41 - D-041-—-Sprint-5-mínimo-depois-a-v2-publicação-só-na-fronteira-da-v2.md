---
id: decision-41
title: 'D-041 — Sprint 5 mínimo, depois a v2; publicação só na fronteira da v2'
date: '2026-09-24 00:44'
status: accepted
---
## Contexto

**Decisão do mantenedor, em 2026-09-13**, depois dos argumentos dos dois lados.

## Decisão

**O que entra agora:** o que a v2 herda intacta e o que dói no uso diário — o autostart do daemon
(S5-T1; a tampa fechada de 12/09 matou o daemon e o encerramento ficou sem ninguém para disparar),
as ações da CI num runtime obsoleto (S5-T5) e o portão de segurança (S5-T6), mais a renomeação
(S5-T0).

**O que espera a fronteira da v2:** `seeya init` (a v2 redefine o fluxo de instalação por
completo), README e publicação no npm, a bateria manual nos três sistemas e o `--sessions`.
Publicar acontece uma vez, com o nome resolvido e a unidade de projeto no lugar.

## Consequências

**O custo aceito, nas palavras dele:** a v1 não recebe validação externa. *"Eu estou desenvolvendo
ele para mim e para minhas necessidades; se isso atender mais alguém, ótimo; se não, tá tudo bem
também."* O projeto continua open source e público, mas o critério de pronto é o uso dele, não
adoção.
