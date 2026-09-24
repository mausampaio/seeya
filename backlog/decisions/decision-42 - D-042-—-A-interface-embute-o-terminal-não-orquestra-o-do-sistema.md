---
id: decision-42
title: 'D-042 — A interface embute o terminal; não orquestra o do sistema'
date: '2026-09-24 00:45'
status: accepted
---
## Contexto

Título original completo: "A interface embute o terminal; não orquestra o terminal do sistema".

**Decisão do mantenedor, em 2026-09-13**, contra a recomendação inicial do PO.

**A recomendação que caiu:** começar por um painel local com abas abertas no terminal que a
pessoa já usa (`wt` no Windows), por ser o caminho mais barato para validar o fluxo. **O
argumento que a derrubou:** *"no Windows ainda temos o `wt`, mas no Linux e no macOS existe uma
infinidade de terminais possíveis; no Linux, que uso no meu dia a dia, cada distro usa um
terminal como padrão. Talvez resolva como validação, mas como produto não vejo sentido."* Gerir N
terminais por sistema é complexidade que não termina, e validar com um mecanismo que não é o do
produto valida pouco.

## Decisão

A interface é uma aplicação de desktop com **terminal embutido** — `xterm.js` no renderer e um
PTY por aba — e o harness roda dentro dela, no contexto do projeto. Um runtime só, TypeScript, o
núcleo no mesmo processo (`@seeya-ai/engine`). **Tauri está descartado** (casca em Rust com o
núcleo em Node como subprocesso, ou reescrita do núcleo): três runtimes num produto de uma pessoa.
A aplicação se distribui como instalador (GitHub Releases), não pelo npm.

**Um fato que muda a ordem de validação:** o dia a dia do mantenedor é **Linux**; o Windows é o
notebook pessoal. O spike da interface (M) valida o PTY e o TUI dos harnesses dentro do `xterm.js`
**no Linux e no Windows** (ConPTY) como cidadãos de primeira classe; macOS fica na CI. As lições
da S4-T6/D-038 sobre console e janela valem para o PTY do Windows.

## Consequências

**O que continua valendo da proposta anterior:** o painel em si (projetos na lateral, prioridade e
estado, `pause` e `end-day` por projeto, notificações com ações) é o mesmo — só a aba muda de
lugar. E a limitação honesta permanece: só entra numa aba a sessão que a interface abriu; uma
sessão num terminal externo aparece na lista das descobertas, com retomada pela v1.
