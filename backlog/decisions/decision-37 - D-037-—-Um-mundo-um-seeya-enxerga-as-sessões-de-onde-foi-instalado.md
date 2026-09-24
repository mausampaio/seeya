---
id: decision-37
title: 'D-037 — Um mundo, um seeya: enxerga as sessões de onde foi instalado'
date: '2026-09-24 00:40'
status: accepted
---
## Contexto

Título original completo: "Um mundo, um seeya: ele enxerga as sessões de onde foi instalado, e
não faz ponte".

**Decisão do mantenedor, em 2026-09-06**, ao avaliar migrar o desenvolvimento para o WSL e
perceber que nunca tinha decidido de que lado rodaria o `claude`. **Provisória e explicitamente
revisável:** *"depois avaliamos isso melhor à medida que for usando"*.

**Isto não é limitação de plataforma.** O código já roda em Linux: a CI cobre três sistemas e o
`verificar:linux` roda em contêiner a cada tarefa. Rodar dentro do WSL exige apenas Node instalado
lá e o link feito com o npm de lá — o que **não** aconteceu na tentativa que originou esta decisão
(o Ubuntu não tinha Node, o `npm` resolveu para o do Windows pela ponte de interoperabilidade, e o
`npm link` foi parar no prefixo global do Windows de novo).

**Por que não fazer a ponte, medido e não suposto.** No WSL, `~/.claude/projects` é outro
diretório e estava vazio: sessão aberta no Windows é registrada na casa do Windows. Apontar um
lado para o diretório do outro **não** resolveria, e não por pouco:

- os `pid` do registro são de processos do Windows — um processo do WSL não consegue conferir
  liveness (`adapters/process/liveness.ts`) nem encerrar (D-002);
- os `cwd` são `C:\...`, e a normalização (`core/cwd-normalization.ts`) trata **um** formato por
  execução;
- o `resume` teria que ser lançado do outro lado, com o binário do outro lado.

Atravessar mundos não é ajuste de configuração; é outro desenho.

## Decisão

O `seeya` cuida das sessões do ambiente em que ele roda. Quem trabalha em dois mundos (Windows e
WSL, ou duas máquinas) instala nos dois, e cada instalação tem o seu `~/.seeya`, o seu daemon e o
seu briefing. **Não existe ponte, e a ausência dela não é omissão — é o escopo do v1.**

## Consequências

**O que muda na prática:** uma linha no README (Sprint 5) dizendo que ele enxerga as sessões do
mundo onde foi instalado, e que quem usa os dois instala nos dois. Nada no código.

**O que reabriria isto:** o mantenedor passar a trabalhar de fato nos dois mundos e sentir o custo
real — duas memórias, dois briefings de manhã, lembrar em qual janela abriu o quê. É por isso que
a decisão é provisória: hoje o custo é hipotético, e decidir arquitetura por custo hipotético é o
que a D-032 já ensinou a não fazer.

**Consequência para o próprio desenvolvimento do seeya, e ela é permanente.** A parte mais
arriscada do projeto só existe no Windows — janelas de console (S4-T6), toast, encerramento de
processo, autostart. **O defeito da S4-T6 é a prova:** invisível no Linux, invisível em teste, e só
apareceu quando o daemon rodou de verdade, sem console. Desenvolver no WSL é possível; **validar o
seeya continua exigindo Windows**, com uma instalação de teste do lado de lá.
