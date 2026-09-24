---
id: decision-32
title: 'D-032 — Evidência de git segue arquivos tocados, por repositório'
date: '2026-09-24 00:28'
status: accepted
---
## Contexto

**Proposta do mantenedor, em 2026-09-02**, depois de uma captura real da própria sessão de
trabalho dele voltar com `facts.git: null`.

**Medido.** A sessão foi lançada de `C:\code`, que **não é repositório**. Todo o trabalho
aconteceu em `C:\code\see-you-tomorrow-ai` — dezenas de commits na semana. O handoff registrou
`sources: ["transcript","registry"]` e **zero** fatos de git.

Não é caso de canto: é o fluxo declarado dele. Ele lança o `claude` do diretório do usuário **de
propósito**, porque trabalha em vários repositórios ao mesmo tempo e quer uma memória só para o
projeto inteiro. O `cwd` de lançamento, nesse fluxo, não é onde o trabalho está.

**A derivação, verificada nos dados reais.** Agrupando os 47 `touchedFiles` daquela sessão por
raiz de repositório (subindo de cada arquivo até achar um `.git`):

```
 35  c:\code\see-you-tomorrow-ai
 12  (fora de repositório)
```

A evidência estava a um passo. O `touchedFiles` já é extraído dos blocos de tool-use (D-013) e já
carrega caminhos reais.

## Decisão

A evidência de git deixa de ser atrelada ao `cwd` de lançamento e passa a ser derivada dos
**arquivos efetivamente tocados**, reportando **cada repositório encontrado**, não um só.

`HandoffFacts.git` deixa de ser `GitFacts | null` e passa a ser uma **lista**.

**Por que plural, e por que a medição não decidiu isto.** Medi três sessões reais e nenhuma tocou
mais de um repositório — mas **as três eram sessões construindo este próprio projeto**,
estruturalmente de um repositório só. Aquela amostra não poderia responder a pergunta nem se a
resposta fosse "plural": frontend e backend na mesma sessão, que é o caso comum que o mantenedor
descreve, nunca apareceria ali. **Amostra enviesada é outro jeito de afirmar além da evidência**,
e o registro fica aqui para ninguém citar aquele "0 de 3" como se fosse resposta.

O que decide é o fluxo declarado por quem usa: uma sessão que mexe em frontend e backend tem dois
repositórios com histórico próprio, e reportar um só seria escolher em silêncio.

## Consequências

- **Migração de esquema não é opcional.** `HANDOFF_SCHEMA_VERSION` é **1**, e
  `resolveSchemaVersion` **lança** quando a versão não bate — não adivinha, não degrada. Subir
  para 2 sem migração torna **ilegível todo handoff já gravado**, e o `seeya start-day` lê
  exatamente isso: o briefing de ontem. Handoff versão 1, com `git` singular, tem que ser lido
  como lista de um elemento. São poucas linhas, e é a diferença entre a mudança ser invisível e a
  mudança comer o histórico de quem já usa.
- **Normalizar a raiz antes de desduplicar**, reusando `core/cwd-normalization.ts` (S3-T5). Sem
  isso, `c:\code\x` e `C:\code\x` viram dois repositórios — aconteceu na medição que originou esta
  decisão.
- **Arquivos fora de qualquer repositório são contados e declarados.** Foram 12 de 47 na sessão
  medida. Sumir com eles esconderia atividade; declarar a contagem é o D-025 aplicado.
- **O `cwd` de lançamento continua valendo quando for repositório.** Quem abre dentro do projeto
  não pode perder nada.
- **Limite de quantos repositórios visitar, rotulado como E/S e não julgamento de produto** — cada
  um custa comandos de git. Mesma distinção que a Q-025 fixou para `MAX_BRIEFING_SCAN_DAYS`, com o
  excedente **declarado** em vez de omitido.
- **`sources` continua listando `git` quando ao menos um repositório respondeu** (D-013):
  evidência parcial é evidência, e a ausência de um repositório específico aparece na lista, não
  no silêncio.
