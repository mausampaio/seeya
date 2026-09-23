---
id: TASK-16
title: V2-T24 — Notificação do macOS com identidade errada
status: To Do
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels:
  - parada
  - macos
  - precisa-decisao
milestone: m-1
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
priority: low
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T24 (precisa de decisão do mantenedor antes de virar tarefa) — No macOS a notificação
se apresenta como "Editor de Scripts", e clicar nela abre o editor.** Medido pelo mantenedor
em 2026-09-20, com captura: o aviso prévio chegou na hora certa e com o texto certo, mas com
**o ícone do Editor de Scripts**, e o clique abre uma janela dele.

**Causa, e por que não é descuido.** No macOS o aviso é enviado por `osascript`
(`adapters/notification/macos-osascript.ts`), e o sistema atribui a notificação ao aplicativo
que a enviou — que é o próprio interpretador de scripts, não o seeya. Não há como um
`display notification` dizer "sou outro app": a identidade vem do processo que chama. O
spike B já havia registrado que `osascript` não tem ação de clique; o que ninguém tinha visto
é que ele também **empresta a própria identidade** ao aviso.

**As saídas, com o custo de cada uma — decisão do mantenedor:**
1. **Deixar como está e documentar.** Custo zero, e o aviso continua chegando na hora. O
   preço é a marca errada na notificação e um clique que abre um editor de scripts, que é
   pior que um clique que não faz nada.
2. **O app posta o aviso quando está aberto** (a API de notificação do próprio Electron, com
   a identidade e o ícone do seeya, e clique que foca a janela), e o `osascript` fica só
   para quando o app não está rodando. Precisa de um caminho do daemon para a janela, que
   hoje não existe — é o item de maior custo, e o único que resolve de verdade.
3. **Depender de um utilitário de terceiro** capaz de identidade e ação (o mesmo que o spike
   B descartou). Resolve com pouco código, mas a pessoa precisa instalar uma ferramenta a
   mais, e o seeya passa a depender de algo que pode não estar lá.

**Recomendação do PO:** (1) agora, registrado como limite conhecido, e (2) quando a
notificação virar assunto de novo — provavelmente junto do `end-day` global, que muda o que
os avisos dizem. O que não vale é (3): trocar uma marca errada por uma dependência que a
pessoa tem de instalar.
<!-- SECTION:DESCRIPTION:END -->
