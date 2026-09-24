---
id: decision-34
title: 'D-034 — Notificação sem ações no v1: o botão pertence à GUI, não ao CLI'
date: '2026-09-24 00:28'
status: accepted
---
## Contexto

**Decisão do mantenedor, em 2026-09-05**, ao fechar a Q-038.

O Spike B previa dois níveis por sistema: um backend **com ações** (`terminal-notifier` no
macOS, `notify-send -A` no Linux, toast com `activationType="protocol"` no Windows) e um
degradado sem elas. A S4-T1 implementou **um por SO, sem ações**, porque ações estavam fora do
contrato dela. E em 2026-09-05 o `activationType="protocol"` foi **validado à mão**: o botão foi
clicado, o Windows chamou o handler registrado, e ele recebeu `seeya://snooze30/`.

Ou seja: a capacidade **existe e está provada**. A decisão de não usá-la é deliberada.

## Decisão

O `Notifier` do v1 tem contrato mínimo — **título e corpo, sem ações** — e é assim que fica.
Ações não entram no Sprint 5 nem em tarefa nenhuma desta versão.

**O argumento, e ele é de arquitetura, não de prazo.** Este CLI é a base de uma versão futura com
**interface gráfica**. Nela, notificação com ação é **trivial e nativa**: não depende de binário
externo que pode não estar instalado, nem de escrever `seeya://` no registro do usuário.
Construir ações agora significa pagar três integrações frágeis — uma por SO — para entregar no v1
algo que a v2 ganha de graça, e depois manter as três.

**Por que isto é decisão e não item de backlog.** Do jeito que estava, o contrato mínimo parecia
uma **lacuna**: o spike previa ações, a validação deu certo, e nada explicava a ausência. O
próximo agente que lesse aquilo concluiria descuido e "consertaria". **O risco não é esquecerem
de construir ações — é alguém construir.**

## Consequências

**O que fica registrado como conhecimento, não como pendência:** a validação do protocolo no
Windows (Spike B, seção "VALIDADO") continua valendo e é insumo da v2. Inclusive o detalhe medido
que só aparece usando: o handler recebe `seeya://snooze30/`, **com barra no fim** — quem
interpretar essas URIs não pode comparar por igualdade exata.

**Consequência prática:** a cadeia de fallback do `adapters/notification/` fica como está, com um
backend por SO. Nenhum `terminal-notifier`, nenhum `notify-send -A`, nenhuma escrita em registro
no caminho de produção. Se alguém propuser acrescentar, a resposta está aqui.

## Fechamento (confirmado pelo mantenedor em 2026-09-17, V2-T5b)

A interface chegou, e a pergunta que esta decisão deixava em aberto — "quando a GUI existir, ela
ganha o botão?" — tem resposta: não. A D-034 fica exatamente como está, em todo SO, inclusive
agora que há onde colocar um botão. As ações que o Spike B previa para a notificação (adiar,
pular) moram na **faixa de horário** da própria janela (V2-T5b item 1: Snooze +15m/+30m/+1h, Skip
today) — visíveis e clicáveis sempre que a pessoa tem a janela aberta, sem depender de o SO
entregar um clique de volta a um app específico. O toast do SO continua título e corpo; o único
comportamento novo que um clique nele ganha (V2-T5b item 5, só Windows nesta versão) é trazer a
janela para frente — não uma ação sobre o dia, só foco. Isto não reabre a decisão; fecha o "e se"
que ela deixou pendurado.
