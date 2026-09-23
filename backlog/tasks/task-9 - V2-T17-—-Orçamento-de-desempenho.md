---
id: TASK-9
title: V2-T17 — Orçamento de desempenho
status: Review
assignee: []
created_date: '2026-09-22 11:10'
updated_date: '2026-09-23 10:46'
labels: []
milestone: m-2
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: task
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T17 — Orçamento de desempenho: quatro números medidos, e a regra de como usá-los.**
Especificada pelo PO em 2026-09-20 a pedido do mantenedor no mesmo dia; **entra depois da
V2-T16**.

**Por quê.** O mantenedor declarou o objetivo: *"quero fazer do seeya um caso de uso de um
bom app feito em electron, algo leve, rápido"*. A diferença entre um app leve e um pesado
quase nunca é uma decisão grande — é um laço a mais, uma consulta periódica, uma leitura
extra por ciclo, e meses depois ninguém sabe de onde veio o peso. Sem número, a conversa
vira "acho que ficou pesado". **Esta tarefa não otimiza nada**: ela mede, registra e cria a
régua. Se um número sair ruim, a otimização é tarefa própria, decidida com o número na mão.

**O que entra:**
1. **Os quatro números, medidos no Windows.** (a) tempo do lançamento até a lista de sessões
   na tela; (b) memória em repouso, janela aberta e nenhuma aba, somando **toda a árvore de
   processos** do app (o Electron é vários processos — um número só do processo principal
   mente); (c) trabalho de processador parado, amostrado por pelo menos 60 segundos sem
   ninguém tocar na janela — hoje o laço de atualização acorda a cada 10 segundos e, desde a
   V2-T14, lê um arquivo a cada ciclo, custo que ninguém mediu; (d) tamanho do app instalado
   em disco. Cada um com o método descrito o bastante para outra pessoa repetir e chegar
   perto, e com a variação entre execuções (medir três vezes, registrar a faixa — um número
   único sem faixa esconde o ruído).
2. **Onde mora.** Documento novo `docs/DESEMPENHO.md`, em português: o objetivo, o método de
   cada medida, a linha de base com data e máquina (anonimizada — "Windows 11, 8 núcleos",
   nunca o nome da máquina), e o que fazer quando um número piorar. Uma linha no `AGENTS.md`
   aponta para ele, para o agente da próxima tarefa de interface encontrar sem procurar.
3. **A régua, em uma frase operável.** Tarefa de interface que acrescente trabalho em
   repouso, na subida ou no tamanho **diz o custo na própria especificação**; piora sem
   explicação vira questão em `docs/QUESTOES.md`, não passa calada. Sem portão automático
   nesta tarefa: um piso de desempenho no CI, medido em máquina compartilhada e variável,
   só produziria falha intermitente — isso fica registrado como escolha, não como esquecimento.
4. **A instrumentação mínima para (a).** Se medir a subida exigir marcar o tempo dentro do
   app, siga o padrão das variáveis `SEEYA_APP_*` já existentes (só instrumentação, nunca
   lida pelo `npm run app`, documentada onde é lida e no glossário), escrevendo o resultado
   num arquivo indicado por variável. Nada de saída no console solto (`AGENTS.md`
   § "Registro e saída").

**O que não entra:** otimizar qualquer coisa; medir no Linux e no macOS (entra quando houver
máquina para isso — o documento deixa a tabela pronta para receber); comparar com outros
apps; piso automático no CI.

**Cuidados:** nenhuma dependência nova; a medição usa `SEEYA_APP_HOME_OVERRIDE` numa pasta
descartável, nunca o `~/.seeya` real; nenhum agente instala o app — a medida de tamanho sai
do que o `npm run dist:windows` produz, e a de memória, da janela em desenvolvimento, com a
diferença entre as duas formas registrada no documento (D-025: dizer o que a medida é, não o
que se gostaria que ela fosse).

**Relatório.** Os quatro números, na máquina do mantenedor (Windows 11 Home, 8 núcleos
lógicos, 16 GB RAM — `docs/DESEMPENHO.md` tem o baseline completo, 2026-09-20):

| # | Medida | Faixa (3 execuções) |
|---|---|---|
| (a) | Tempo até a lista de sessões na tela | 5782–5801 ms |
| (b) | Memória em repouso, árvore inteira | 335,6–338,0 MiB |
| (c) | CPU parado (janela de 60s) | 0,39%–0,57% de um núcleo lógico |
| (d) | Instalador / instalado (`npm run dist:windows`) | ~112,1 MiB / ~390,6 MiB (instalado
idêntico byte-a-byte nas três rodadas) |

**Instrumentação (item 4).** `main.ts#writeStartupTiming` grava, via `SEEYA_APP_
STARTUP_TIMING_PATH` (novo, mesmo padrão `SEEYA_APP_*`, documentado no glossário do
`AGENTS.md`), o instante (`Clock.now()`, D-019) em que o primeiro `sessionsUpdate` foi
enviado ao renderer — não o instante em que os pixels apareceram (D-025, a distância entre
os dois é desprezível perto dos ~240ms do `SessionProvider.list()` que precede o envio, ver
a docstring nova em `main.ts`). Três scripts de medição, tooling fora de `src/`
(`packages/app/scripts/measure-startup.mjs`, `measure-idle.mjs`,
`process-tree-stats.ps1`), reproduzem as quatro medidas — `docs/DESEMPENHO.md` tem o passo a
passo.

**Achado incidental, não bug desta tarefa.** Enquanto (b)/(c) eram medidas, a máquina já
tinha uma cópia **instalada** do app rodando em segundo plano (de uma tarefa de instalador
anterior) — árvore de processos própria, pid raiz diferente do processo sob medição.
`process-tree-stats.ps1` soma pela árvore de pids a partir do processo recém-lançado (via
`Win32_Process.ParentProcessId`), nunca por nome de processo, exatamente para nunca somar
essa cópia alheia por engano — confirmado depois de cada medição (`Get-CimInstance
Win32_Process` antes/depois, mesmos quatro pids da cópia instalada, intocados). Registrado
em `docs/DESEMPENHO.md` como a causa mais provável da pouca memória livre desta sessão, não
como contaminação do número.

**O que ficou sem medir.** Linux e macOS (sem máquina disponível — fora do escopo desta
tarefa, a tabela em `docs/DESEMPENHO.md` já tem a coluna pronta); memória/CPU de uma cópia
**instalada** de verdade (proibido instalar nesta tarefa — a medição de memória é do bundle
de desenvolvimento contra o mesmo `dist/electron/**` que o instalador empacota, diferença
registrada no documento em vez de assumida igual).

**Q-084:** para (b)/(c), as três amostras vieram de três janelas de 60s dentro de **um**
processo contínuo, não de três lançamentos — desvio da leitura literal de "medir três
vezes", justificado (regime, não variância de lançamento; menos um Electron aberto numa
máquina que às vezes fica apertada) e registrado com o raciocínio completo.

**Portão:** `npm run verificar` completo, em primeiro plano, sem partição — 202 arquivos de
teste, 2095 testes passando, 4 pulados; cobertura 96,46%/92,59%/95,09%/96,83% (acima dos
pisos por diretório). `tests/integration/app/composition.test.ts` não estourou prazo desta
vez. `npm run verificar:linux` não foi rodado (opcional, e o portão principal já mede sob
cobertura na máquina real do mantenedor, que é o alvo desta tarefa).

Fica em `[~]` para revisão do PO/mantenedor.
<!-- SECTION:DESCRIPTION:END -->
