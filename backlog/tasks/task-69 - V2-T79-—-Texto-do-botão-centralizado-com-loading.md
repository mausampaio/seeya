---
id: TASK-69
title: V2-T79 — Texto do botão centralizado com loading
status: To Do
assignee: []
created_date: '2026-10-02 09:46'
labels:
  - ui
dependencies: []
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Achado do mantenedor (2026-10-02, instalador de 01:00): o texto de Open (aba Projects), Skip today (rodapé) e Create (New project) aparece deslocado para a direita, enquanto Cancel/Snooze/New project ficam centralizados. Causa: renderer/components/Button/Button.tsx reserva um slot invisível do spinner à esquerda do rótulo sempre que a prop loading é passada (true OU false), a 'folga permanente' aceita na V2-T65 — e todo botão que usa loading herda o deslocamento. Correção: padrão de sobreposição — durante loading o rótulo fica com visibility hidden (mantém a largura) e o Spinner aparece absolutamente centralizado por cima; fora de loading não há slot nenhum, e o texto é centralizado igual a um botão sem a prop. Conferir o mesmo padrão em Switch (que também reserva slot) e IconButton. Teste renderizado que trava: com loading=false a estrutura é a mesma de um botão sem a prop (nenhum slot no fluxo), e com loading=true o rótulo continua no DOM ocupando espaço. Capturas reais nos dois temas de Open, Skip today, Create e um botão em loading.
<!-- SECTION:DESCRIPTION:END -->
