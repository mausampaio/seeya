---
id: TASK-69
title: V2-T79 — Texto do botão centralizado com loading
status: Review
assignee: []
created_date: '2026-10-02 09:46'
updated_date: '2026-10-02 07:40'
labels:
  - ui
dependencies: []
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Achado do mantenedor (2026-10-02, instalador de 01:00): o texto de Open (aba Projects), Skip today (rodapé) e Create (New project) aparece deslocado para a direita, enquanto Cancel/Snooze/New project ficam centralizados. Causa: renderer/components/Button/Button.tsx reserva um slot invisível do spinner à esquerda do rótulo sempre que a prop loading é passada (true OU false), a 'folga permanente' aceita na V2-T65 — e todo botão que usa loading herda o deslocamento. Correção: padrão de sobreposição — durante loading o rótulo fica com visibility hidden (mantém a largura) e o Spinner aparece absolutamente centralizado por cima; fora de loading não há slot nenhum, e o texto é centralizado igual a um botão sem a prop. Conferir o mesmo padrão em Switch (que também reserva slot) e IconButton. Teste renderizado que trava: com loading=false a estrutura é a mesma de um botão sem a prop (nenhum slot no fluxo), e com loading=true o rótulo continua no DOM ocupando espaço. Capturas reais nos dois temas de Open, Skip today, Create e um botão em loading.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Branch e commits** (`tarefa/V2-T79-botao-centralizado`, a partir de `origin/main`):
`b6a54fc` (o fix em Button.tsx/Button.module.css + teste), `9d21beb` (revisão de Switch/IconButton,
sem mudança de comportamento), `93ea5a8` (instrumentação de verificação + AGENTS.md).

**O defeito e a correção.** `Button.tsx` montava um `<span class="spinnerSlot">` de layout
(flex-flow) à ESQUERDA do rótulo sempre que `loading` era passado — `true` OU `false` — porque a
V2-T65-estado-na-tela reservava o slot nos dois casos para a largura não mudar na transição. Dentro
de um botão `justify-content: center`, aquele slot invisível empurrava o rótulo para a direita do
centro geométrico mesmo em repouso — exatamente "Open"/"Skip today"/"Create" (que sempre passam
`loading`) versus "Cancel"/"Snooze"/"New project" (que nunca passam a prop), a assimetria que o
mantenedor viu no instalador.

Novo padrão, de sobreposição: fora de `loading` (omitido OU `false` — os dois agora produzem
exatamente o mesmo HTML, nenhum slot no fluxo), o botão é estruturalmente idêntico a um sem a prop.
Com `loading={true}`, o rótulo (`<Text>`) continua no DOM, só com `visibility: hidden`
(`.labelHidden`) — mantém a largura exata, porque a própria caixa do rótulo nunca sai do fluxo — e
o `Spinner` aparece `position: absolute`, centralizado por `top/left: 50%` +
`transform: translate(-50%, -50%)` sobre `.button` (que ganhou `position: relative`). `disabled` +
`aria-busy="true"` continuam como antes.

**Switch:** conferido e deixado como estava, de propósito. O `.row` nunca é
`justify-content: center` (é `inline-flex` com o padrão `flex-start`), então o slot reservado do
spinner (sempre montado, só alternando `visibility`) nunca desloca nada visível — ele só acrescenta
espaço em branco à direita do rótulo, e o único chamador de produção (`GeneralSection.tsx`'s own
autostart switch) é o primeiro elemento, à esquerda, da própria `Stack` vertical. Docstring
atualizado para registrar essa checagem explicitamente (`Switch.tsx`/`Switch.module.css`).

**IconButton:** conferido — já troca o ícone na MESMA caixa de tamanho fixo (nunca reservou um
segundo elemento), então não precisava de correção nenhuma. Docstring também atualizado para
registrar a checagem.

**Testes.** `tests/unit/app/renderer/components/Button.test.tsx`: o teste antigo que afirmava "o
slot fica sempre montado, só a classe de esconder alterna" foi substituído pela regra nova —
`loading={false}` agora produz HTML byte-a-byte idêntico a um botão sem a prop (`innerHTML`
comparado diretamente); `loading={true}` mantém o rótulo no DOM (hidden) e monta o spinner;
`loading` volta a `false` remove o spinner de novo (mount/unmount a cada transição, não mais o
mesmo nó persistente). `Switch.test.tsx`/`IconButton.test.tsx` ficaram intactos (nenhuma mudança de
comportamento neles).

**Instrumentação de verificação nova** (`packages/app/src/main/main.ts`, registrada em AGENTS.md):
`SEEYA_APP_VERIFY_BUTTON_CENTERING_DIR` (uma pasta, três capturas — `01-open-and-skip.png`,
`02-create.png`, `03-loading.png`) e `SEEYA_APP_VERIFY_HOLD_SKIP_MS` (segura a resposta REAL do
`CHANNELS.skipToday` pelos ms informados antes de devolvê-la — a escrita local em `estado.json` já
aconteceu de verdade, só a resposta fica retida — para que a captura do botão em `loading` nunca
corra contra a latência quase instantânea de uma escrita local).

**Prova visual** (scratchpad desta sessão, fora do repo, nunca commitada;
`node scripts/build.mjs` em `packages/app`, NUNCA `--dev`; `electron.exe` lançado direto, nunca
`npm run app`; `SEEYA_APP_HOME_OVERRIDE` numa home descartável com um projeto livre criado pela
própria CLI compilada (`HOME`/`USERPROFILE` apontando para o diretório descartável — a técnica
sancionada por `docs/FLUXO-DE-AGENTES.md`), `daemon-ownership-transition.json` pré-gravado
`declined`, `--user-data-dir` descartável por tema — necessário porque a máquina já tinha outros
processos `electron.exe` reais rodando (de outra sessão), e o lock de instância única do Electron
por padrão teria feito esta janela perder a corrida e fechar em silêncio, o que de fato aconteceu
na primeira tentativa antes de eu notar e isolar o `userData`):

| Arquivo | Prova |
|---|---|
| `light/01-open-and-skip.png` / `dark/01-open-and-skip.png` | "Open" (linha do projeto livre na aba Projects) e "Skip today" (rodapé, `endOfDayTime` configurado) centralizados, em repouso, no mesmo quadro |
| `light/02-create.png` / `dark/02-create.png` | Diálogo "New project" aberto, botão "Create" centralizado |
| `light/03-loading.png` / `dark/03-loading.png` | "Skip today" depois de um clique real (resposta real segurada por `SEEYA_APP_VERIFY_HOLD_SKIP_MS`), rótulo escondido, spinner perfeitamente centralizado na caixa do botão — sem deslocamento |

Confirmado (só leitura) antes e depois de toda a sessão: `HKCU:\Software\Classes\seeya` e
`\seeya-dev` presentes sem mudança; hash de `~/.seeya/protocol-handler.json` real idêntico
(`E3D8A283D81E8FEEF088CBD050C06100CED744F976A2845DC1C3B842EA013072`) — nenhuma escrita no sistema
real, nenhum processo `electron` meu sobrou rodando ao final (todos saíram com código 0 no horário
esperado).

**`npm run verificar` do zero** (dist apagado antes, duas vezes): verde — 375 arquivos de teste,
3581 testes passando (4 pulados, pré-existentes), cobertura 95.86%/91.61%/95.45%/96.06%
(stmts/branch/funcs/lines) — idêntica ao baseline da V2-T67, sem regressão. `dependency-cruiser`
sem violação.

**Recusas encontradas:** nenhuma recusa de permissão bloqueou a tarefa. Um comando inicial
(`USERPROFILE=... HOME=... node ... project create`, tudo numa linha só) foi recusado pelo guard de
isolamento de worktree por "atribuição de HOME dentro de uma construção complexa demais para
verificar". Não contornado — movido para um script `.mjs` que passa as variáveis via `env` do
`spawnSync` em vez de prefixo inline no shell, exatamente a direção que a própria mensagem de
recusa dava ("separe em comandos simples"). O mesmo aconteceu, pela mesma razão, com uma chamada a
`backlog task edit --notes` com heredoc — contornado editando este markdown diretamente, como o
próprio `AGENTS.md` prevê para esse caso.
<!-- SECTION:NOTES:END -->
