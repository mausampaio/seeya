---
id: TASK-34
title: V2-T44 — O esqueleto do projeto não escreve CLAUDE.md
status: Review
assignee: []
created_date: '2026-09-24 10:45'
updated_date: '2026-09-24 17:28'
labels: []
dependencies: []
references:
  - backlog/decisions
priority: medium
type: bug
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T44 — O esqueleto do projeto não escreve `CLAUDE.md`.** Achado da revisão das decisões
(V2-T39, 2026-09-24), resolvido pelo mantenedor no mesmo dia.

**O defeito.** A **D-030** diz que o `seeya` não escreve arquivo específico de harness. Mas
`packages/engine/src/core/project-skeleton.ts#buildClaudeMd` cria um `CLAUDE.md` em **todo** projeto
novo, incondicionalmente — um arquivo com o nome de um harness, escrito por `core/`, sem olhar o
`defaultHarness` do projeto. O ponteiro de uma linha para o `AGENTS.md` é fiel ao rumo, mas o
arquivo em si não deveria existir.

**A correção decidida pelo mantenedor:** **só `AGENTS.md`**. Não é para gerar `CLAUDE.md` nem
condicioná-lo ao `defaultHarness` — some inteiro. O motivo medido: a versão atual do Claude Code já
lê `AGENTS.md` direto, então o ponteiro deixou de comprar alguma coisa (mantenedor, 2026-09-24).

**O que entra:**

1. Remover `buildClaudeMd` e a entrada correspondente de `buildProjectSkeleton`. O esqueleto passa a
   ser `AGENTS.md` + `INDEX.md` + as seis pastas.
2. Atualizar os testes que afirmam a lista de arquivos do esqueleto —
   `tests/unit/core/project-skeleton.test.ts` e o que mais assertar sobre `writeProjectSkeleton`. O
   teste tem de afirmar **a lista inteira**, não só "contém `AGENTS.md`": é o que impede o arquivo
   voltar sem ninguém ver.
3. Conferir se algum texto de saída da CLI (`seeya project create`/`show`) ou do `README.md` promete
   o `CLAUDE.md`; se prometer, corrigir junto.
4. Citar **D-030** no comentário do módulo, no lugar do trecho que hoje justifica o `CLAUDE.md` pelo
   `docs/V2-RUMO.md`. O comentário atual está certo sobre a convenção e errado sobre a conclusão —
   reescreva a conclusão, preserve a parte medida.

**O que NÃO entra: mexer em projeto que já existe.** O `seeya` não apaga um arquivo que a pessoa
pode ter editado. Projetos criados antes desta tarefa ficam com o `CLAUDE.md` que já têm; a correção
vale para os próximos. Diga isso no relatório — não é esquecimento, é escopo.

**Aceite:** `seeya project create` num espaço de trabalho descartável produz um projeto **sem**
`CLAUDE.md`, e `npm run verificar` passa.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Correção.** `packages/engine/src/core/project-skeleton.ts#buildClaudeMd` foi removida por
inteiro. `buildProjectSkeleton` agora escreve só `AGENTS.md` + `INDEX.md` + as seis pastas
(`context/`, `decisions/`, `plans/`, `status/`, `journal/`, `references/`). O comentário do
módulo (topo do arquivo) ganhou um parágrafo citando D-030 no lugar da justificativa antiga
(a que citava `docs/V2-RUMO.md` para explicar por que `CLAUDE.md` existia); o parágrafo sobre a
convenção agents.md/idioma (D-028/D-033) foi preservado, como pedido.

**Lista de arquivos do esqueleto.**
- Antes: `['AGENTS.md', 'CLAUDE.md', 'INDEX.md']`
- Depois: `['AGENTS.md', 'INDEX.md']`

**Teste de regressão.** `tests/unit/core/project-skeleton.test.ts` — a asserção
`expect(paths).toEqual([...])` agora afirma a lista inteira (`['AGENTS.md', 'INDEX.md']`), não só
"contém AGENTS.md". Rodei esse teste contra o código antigo (antes de tocar
`project-skeleton.ts`) para confirmar que falha:

```
FAIL  |unit| tests/unit/core/project-skeleton.test.ts > buildProjectSkeleton > writes exactly
AGENTS.md and INDEX.md — never CLAUDE.md (D-030), never seeya.json (the adapter serializes that
itself)
AssertionError: expected [ Array(3) ] to deeply equal [ 'AGENTS.md', 'INDEX.md' ]
- Expected
+ Received
  [
    "AGENTS.md",
+   "CLAUDE.md",
    "INDEX.md",
  ]
```

Depois da correção esse teste passa. Também removi o teste
`"CLAUDE.md only points to AGENTS.md..."`, que não tem mais o que afirmar.
`tests/integration/workspace/fs-workspace-repository.test.ts` já deriva a lista de arquivos
esperados de `skeleton.files` (não tem uma lista fixa própria) — passou sem alteração, e prova a
escrita real em disco (diretório temporário, `makeTmpDir()`), não só o construtor puro.

**Outros lugares que citavam `CLAUDE.md` do projeto gerado (não deste repositório).** Busquei em
todo o repositório por `CLAUDE.md` e separei o que é sobre o `CLAUDE.md` *deste* repositório
(comentários tipo `// CLAUDE.md § "..."`, `README.md` "`CLAUDE.md` just points to it", spikes e
`docs/QUESTOES.md` históricos) do que promete o `CLAUDE.md` do *esqueleto gerado*:
- `packages/cli/src/index.ts:357` — descrição do comando `project` listava
  `AGENTS.md, CLAUDE.md, INDEX.md, seeya.json, ...`; removi `CLAUDE.md` da lista.
- `docs/V2-RUMO.md` § "Projeto persistente" — a árvore de exemplo tinha a linha
  `├── CLAUDE.md          # só aponta para o AGENTS.md`; removida (doc é rumo, não decisão, "nada
  aqui está travado" — editável, ao contrário de `docs/DECISOES.md`/`ESPECIFICACAO.md`).
- `docs/PLANO-DE-ENTREGA.md` — cita `CLAUDE.md` no esqueleto (linhas ~7922/7965); **não toquei**:
  é histórico congelado até 2026-09-22, "consulte, não escreva nele" (AGENTS.md).
- `backlog/tasks/task-28`, `task-29`, `task-30` — registros da revisão de decisões que já citam
  este próprio achado (a task-29 é a origem da task-34, a task-30 registra que "virou a task-34");
  não toquei, são registro histórico de outra tarefa.
- `README.md:256`, `docs/spikes/*`, `docs/QUESTOES.md:274`, comentários `// ... CLAUDE.md § "..."`
  em `tests/`/`adapters/` — todos se referem ao `CLAUDE.md` **deste** repositório seeya (que
  segue existindo e aponta pra `AGENTS.md`, fora do escopo desta tarefa), não ao arquivo que o
  esqueleto gerava. Não toquei.
- `packages/cli/src/project-command.ts`, `format-project.ts`, `README.md` (seção de comandos) —
  não prometem `CLAUDE.md` em lugar nenhum da saída de `project create`/`show`; nada a corrigir.

**Escopo — projetos já existentes não são tocados.** A correção só muda o que
`buildProjectSkeleton` gera dali pra frente. Projeto criado antes desta tarefa mantém o
`CLAUDE.md` que já tinha; `seeya` nunca apaga arquivo que a pessoa pode ter editado — isso é
recorte deliberado da tarefa, não esquecimento.

**Prova de `seeya project create` sem `CLAUDE.md`.** Rodei o comando de verdade
(`runProjectCreateCommand`/`buildProjectContext`, o mesmo caminho que `packages/cli/src/index.ts`
usa) contra um diretório descartável em `%TEMP%` (nunca `~/.seeya`), e limpei o diretório depois:

```
disposable home: <usuario>\AppData\Local\Temp\seeya-v2t44-proof-IKw3Rx
--- CLI report ---
Created project "v2-t44-proof" at ...\.seeya\workspace\v2-t44-proof.
--- project directory listing ---
[
  'AGENTS.md',  'INDEX.md',
  'context',    'decisions',
  'journal',    'plans',
  'references', 'seeya.json',
  'status'
]
cleaned up disposable home.
```

Sem `CLAUDE.md`.

**Incidente durante a tarefa (registrado para transparência).** Numa primeira tentativa de provar
o comando pela CLI, usei uma variável de ambiente `SEEYA_HOME` que não existe no projeto (a CLI
resolve o home por `os.homedir()`, sem override por variável de ambiente) — o comando caiu no
home real e criou o projeto `v2-t44-proof` no espaço de trabalho real do mantenedor
(`~/.seeya/workspace`, commit `4e0fa2d` sobre `aaee62e`). O mantenedor foi avisado no momento,
recusou minhas tentativas de desfazer isso sozinho (`git reset --hard`/`git revert`, ambas negadas
pelo sandbox) e disse que a limpeza é dele. Não toquei mais em `~/.seeya` depois disso; a prova
final acima usa um diretório descartável de verdade em `%TEMP%`, sem tocar variável de ambiente
`HOME`/`USERPROFILE` nem `~/.seeya`.

**Portão.** `npm run verificar` passou: format, tipos, lint, `dependencias` (410 módulos, 0
violações), build, e `cobertura` (226 arquivos de teste, 2334 passaram, 4 skipped, cobertura
96.56% statements / 92.56% branches / 95.52% funcs / 96.88% lines — acima dos pisos de
`src/core/` 95% e demais 80%).

Branch `tarefa/V2-T44-esqueleto-sem-claude-md`, commit `5b36df5`.
<!-- SECTION:NOTES:END -->
