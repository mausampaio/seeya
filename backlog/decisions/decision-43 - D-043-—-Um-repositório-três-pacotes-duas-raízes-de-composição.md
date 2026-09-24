---
id: decision-43
title: 'D-043 — Um repositório, três pacotes; duas raízes de composição'
date: '2026-09-24 00:46'
status: accepted
---
## Contexto

Título original completo: "Um repositório, três pacotes: `@seeya-ai/engine`, `@seeya-ai/cli`,
`@seeya-ai/app`; duas raízes de composição".

**Decidida em 2026-09-13: o mantenedor aprovou a V2-T1 e ela foi mesclada no mesmo dia.**

**Por quê.** A D-042 exige que a interface consuma o núcleo no mesmo processo, nunca por
subprocesso, e que não exista uma segunda implementação. Um pacote que a interface e a CLI
importam é a forma de isso ser verdade por construção. O escopo `@seeya-ai` (D-040) já foi criado
para isto.

## Decisão

O repositório passa a ser um monorepo com `npm workspaces`:

| pacote | conteúdo | quem consome |
|---|---|---|
| `@seeya-ai/engine` | as camadas `core/`, `application/`, `adapters/` e `scheduler/` de hoje | `cli` e `app`, **no mesmo processo** |
| `@seeya-ai/cli` | a camada `cli/` de hoje e o binário `seeya` | a pessoa, o autostart, o `npm link` |
| `@seeya-ai/app` | a interface (D-042); **só o nome fica reservado agora** | a pessoa |

**Emenda à D-020.** "`cli/` é a única raiz de composição" passa a ser "**`cli/` e `app/` são as
duas raízes de composição**, e nenhuma outra": os dois nomeiam adapters concretos; `core/`,
`application/` e `scheduler/` continuam sem nomear nenhum. A matriz de camadas (D-020, 20 pares)
continua exaustiva **dentro** de `@seeya-ai/engine`, e o dependency-cruiser continua sendo o
guard — agora sobre os dois pacotes.

## Consequências

Nenhum comportamento, nenhuma API entre camadas, nenhum arquivo renomeado além do movimento de
diretório, nenhuma chave em disco muda. O binário continua `seeya`; o `npm link` passa a ser feito
em `packages/cli`. A cobertura por diretório, os guards e o portão continuam com os mesmos pisos —
só os caminhos mudam.

## Por que `engine`, e não `core`

**Mantenedor, 2026-09-13.** A primeira versão desta decisão chamava o pacote de `@seeya-ai/core`,
e ele contém a camada `core/`: os imports ficariam `@seeya-ai/core/core/…`, e ninguém saberia qual
dos dois é o pacote. Renomear a camada tocaria a D-020, a matriz de 20 pares e o glossário;
renomear o pacote, que ainda não existia, custou zero. `engine` diz o papel: é a parte que
trabalha, e `cli` e `app` são as duas cascas que a acionam. Os imports leem-se como "a camada
`core` do motor": `@seeya-ai/engine/core/…`, `@seeya-ai/engine/adapters/…`.
