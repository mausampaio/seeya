# Interface — especificação das telas

Especificada pelo PO em 2026-09-30, a partir do inventário da janela atual e de uma proposta
visual revista tela a tela pelo mantenedor. **É a fonte de verdade do que a janela mostra**: toda
tarefa que muda o que a pessoa vê atualiza este arquivo antes do código (regra de processo no fim).

- **Visual:** `design/IDENTIDADE_VISUAL.md` — tokens, temas, tipografia, espaçamento, raios,
  movimento, tom de voz e acessibilidade. Este arquivo não repete valores de lá; cita os nomes.
- **Camada:** D-051 — Preact, componentes próprios, tokens como variáveis CSS, fontes empacotadas;
  D-052 — a estrutura dos componentes (pastas, primitivas de disposição, CSS modules, testes).
- **Protótipo:** a proposta visual vive fora do repositório, numa página privada do mantenedor.
  Tudo que ela decidiu está escrito aqui; nenhuma tarefa depende de abri-la.
- **Idioma:** o texto da tela é inglês (D-028), com os nomes do produto (`end day`, `snooze`,
  `handoff`…), nunca metáfora de marca como rótulo (identidade, seção 7).

## Princípios

1. **Tema:** `System` (padrão), `Light` ou `Dark`, escolhido em Settings. O terminal segue o tema
   — não existe terminal escuro fixo num tema claro.
2. **Listas grandes não moram na lateral.** Projetos e sessões crescem sem limite; a lateral mostra
   só o atalho (favoritos, recentes, contadores) e o resto vive em abas com busca e filtro.
3. **Página é aba, não modal.** Today, Projects e Sessions abrem como abas, ao lado dos terminais:
   convivem com o trabalho, não somem ao alternar e guardam os filtros.
4. **A ação segue o estado.** Um botão só oferece o que o estado permite, e diz o que vai
   acontecer (ex.: projeto travado por outra sessão oferece `Read only…`, não `Open`).
5. **Nada de texto da CLI despejado na tela.** O que hoje é `<pre>` com o relatório da CLI vira
   informação estruturada. A CLI continua com o texto dela; a janela lê os mesmos dados, não a
   mesma frase.
6. **Estado sempre com texto ou ícone, nunca só cor** (identidade, seção 8).

## Estrutura da janela

```
┌──────────────┬──────────────────────────────────────────────────────┐
│ lateral      │ barra de abas ............................. Settings │
│ (280 px,     ├──────────────────────────────────────────────────────┤
│ recolhível,  │                                                      │
│ redimensio-  │ conteúdo da aba ativa (terminal, Today, Projects,    │
│ nável)       │ Sessions)                                            │
│              │                                                      │
│ ── rodapé ── │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

**Moldura da janela:** a janela usa a barra de título do próprio sistema (minimizar, maximizar e
fechar do SO), **sem a barra de menu** do Electron ("File Edit View Window"), que o app não usa.
No macOS fica só o menu mínimo do app, com o menu Edit (sem ele, copiar e colar não funcionam
nos campos de texto).

**Um botão de recolher por vez** (aceite do mantenedor, 2026-10-01): com a lateral aberta, só o
botão do cabeçalho da lateral aparece; com ela recolhida, só o botão de expandir no início da barra
de abas. Os dois juntos na tela confundem.

**Movimento e profundidade da lateral** (aceite do mantenedor, 2026-10-01): abrir e recolher a
lateral tem transição de largura (180–240 ms, easing da identidade, seção 6.5; sem animação com
`prefers-reduced-motion`). A lateral fica visualmente **acima** do conteúdo: sombra suave na borda
direita (no tema escuro, sombra menor e borda reforçada, identidade 6.3). A exceção está registrada na
identidade visual, seção 6.3.

Continuam valendo: recolher a lateral (botão e `Ctrl+B`), redimensionar (180–480 px, padrão
280, lembrado por máquina), foco devolvido ao terminal ao fechar um diálogo.

## 1. Lateral

De cima para baixo:

1. **Logo** (`seeya-logo.svg` ou `-on-dark`, conforme o tema) e o botão de recolher.
2. **Cartão Today:** `Plan for <dia>` e o contador `N to resume`. Clique abre a aba Today.
   Destacado quando a aba Today está ativa. Sem briefing pendente: `Nothing to resume`, sem
   contador.
3. **Favorites:** projetos marcados com estrela, com o botão `+` (New project) no cabeçalho da
   seção. Cada linha: estrela, nome e o estado do lock quando houver (`open here` na cor da marca,
   `locked` na cor de atenção). O projeto aberto nesta janela mostra, recuadas, as sessões dele
   com ponto de estado, nome e id curto.
   O projeto da aba ativa tem destaque próprio na lateral (fundo `surface-subtle`, como no
   protótipo); as sessões dele aparecem como linha com ponto de estado, nome e id curto em mono —
   nunca o texto cru `nome [id] (estado)`. Linha longa trunca com reticências; a lateral nunca
   rola na horizontal.
4. **Recent:** até 5 projetos pela última atividade, sem repetir favoritos. Derivado, não gravado.
5. **All projects** com o total → abre a aba Projects. Um subdiretório do espaço de trabalho cujo
   `seeya.json` não valida nunca some em silêncio (V2-T72 item 2): aparece como **Ignored
   projects**, uma linha por entrada, com o id (derivado do nome do diretório) e o motivo — a
   mesma informação que `seeya project list` já mostra em "Ignored entries", nunca uma segunda
   redação.
6. **Sessions** com o contador das que têm processo rodando (`3 running`, pílula de sucesso) →
   abre a aba Sessions. Nenhuma lista de sessões na lateral.
7. **Rodapé**, fixo:
   - `End of day HH:MM` e quanto falta (`in 2 h 10 min`), ou o estado da agenda (`skipped
     today`, `already ran today`, `not configured`, `due now`).
   - `Snooze ▾` (menu com +15m, +30m, +1h) e `Skip today`, lado a lado, com a mesma largura —
     só quando a agenda permite (mesmas regras de hoje, `canSnooze`/`canSkip`).
   - `End day…`, largura total, botão primário.
   - **Pílula do daemon**, largura total: `Daemon running` (sucesso) com botão de parar; `Daemon
     stopped` (neutro) com botão de iniciar; `Daemon: cannot verify` desabilitado quando não dá
     para saber. Durante a ação, o botão vira indicador de trabalho.

**Sai da lateral:** o painel de status em texto, a busca por id, `Other sessions` e o botão de
autostart (vai para Settings).

## 2. Barra de abas

- Uma aba por terminal ou página, com ícone do tipo: projeto (pasta), sessão retomada ou adotada
  (balão), shell (terminal), página (calendário para Today, pasta para Projects, balão para
  Sessions). Rótulos como hoje (nome do handoff, id do projeto, nome da sessão).
- Aba cujo processo saiu: `· exited` no rótulo; o `×` passa a remover.
- Hover distinto: passar sobre a aba realça a aba inteira; passar sobre o `×` realça só o `×`
  (fundo próprio, cor de texto mais forte), para ficar claro qual clique fecha.
- O terminal tem margem interna (16 px nas laterais, 12 px em cima e embaixo); o texto nunca
  encosta na borda, e o ajuste de colunas/linhas do terminal desconta essa margem.
- `+` abre o popover **New tab**: seletor `claude` · `codex` · `Shell` · `Other…` (este abre um
  campo de comando livre), campo `Directory` com botão de escolher pasta e até três diretórios
  recentes como atalho. `Open` e `Cancel`.
- **Settings** fica no canto direito da barra (ícone de ajustes).

## 3. Aba Today

- Título `Plan for <dia>` (`(N days ago)` quando for o caso) e uma linha de contexto: quando foi
  capturado e quantas sessões.
- Um cartão por sessão: caixa de marcar, nome, id curto, diretório (mono) e a primeira linha do
  plano. Estados:
  - `neverResumed`: marcável.
  - `resumedEarlier`: marcável, com a pílula `Resumed earlier · closed`.
  - `runningNow`: sem caixa, com ícone de concluído e a pílula `Running now · open in a tab`.
- Sessão que mudou de diretório: dentro do cartão, uma caixa informativa com o histórico e a
  frase de que memória e configuração são por diretório, mais o seletor `Resume in` (só
  diretórios que existem; o mais recente por padrão).
- Rodapé fixo da aba: `N selected`, `Clear selection` e `Resume selected` (desabilitado sem
  seleção, com o motivo).
- Progresso da retomada (`Resuming i of N: <nome>…`) e resultado por seção (Resumed, Skipped, Not
  resumed…) aparecem na própria aba, acima dos cartões.
- Sem briefing: estado vazio com o texto de hoje (nada capturado ainda, ou tudo já retomado).

## 4. Aba Projects

- Título `Projects`, total, e `New project` (primário).
- Busca por nome; filtro `All` · `With a running session` · `Locked`.
- Tabela: estrela (favoritar direto na linha), nome, lock (`Open in this window`, `Unlocked`,
  `Locked by session <id>`), sessões, repositórios, última atividade (ordenação padrão).
- Ação da linha segue o lock: `Go to tab` (aberto nesta janela), `Open` (livre), `Read only…`
  (travado por outra sessão — abre a confirmação da seção 9).
- **Ignored projects** (V2-T72 item 2): seção própria, abaixo da tabela, só visível quando há pelo
  menos uma entrada — um `seeya.json` que não valida, id (derivado do nome do diretório) e o
  motivo, a mesma informação da lateral (seção 1) e de `seeya project list`'s "Ignored entries".
  Sem ação de linha nesta tarefa — consertar é editar o arquivo fora do `seeya` (por enquanto: o
  único jeito de tocar `seeya.json` continua sendo `seeya project add-repo`/comandos do `seeya`,
  nunca um editor pela janela).

## 5. Aba Sessions

- Título `Sessions`, total e quantas rodando.
- Busca por nome **ou** id (inteiro ou prefixo — mantém a busca direta da V2-T55, inclusive fora
  de `relevanceHours`); filtros de estado (`All` · `Running` · `Not running`), projeto
  (`Any project`, `No project`, cada projeto) e diretório.
- Tabela: nome, id curto copiável, estado (rótulo de `core/session-state-label.ts`), diretório,
  projeto (`No project` quando não há), última atividade.
- Ação da linha segue o estado: `Go to tab` (aberta numa aba), `Resume` (sem processo), `Adopt…`
  (sem projeto e elegível — os motivos de inelegibilidade de hoje viram dica no botão
  desabilitado).
- Substitui o modal de sessões por diretório e a busca por id da lateral.

## 6. End day

1. **Prévia** (não chama o modelo, como hoje): lista `Will be captured · N` com nome, diretório,
   estado e modo (`lean`/`deep`); lista `Not captured · N` com o motivo; caixa informativa com o
   teto de custo. `Cancel` e `Run end day`.
2. **Em andamento:** `Capturing i of N: <nome>…`, barra de progresso, lista com o estado de cada
   sessão (captured, capturing, waiting) e o botão `Hide`, que fecha o diálogo sem interromper a
   captura (o progresso continua visível no rodapé da lateral).
3. **Resultado:** o mesmo diálogo com as listas finais (capturadas, falhas com o motivo, puladas)
   e `Open Today`.

## 7. Adoção

1. **Escolher projeto** (um diálogo só, juntando o seletor e a explicação de hoje): cartão da
   sessão (nome, id, diretório, estado), escolha `Existing project` (lista) ou `New project`
   (campo de id), e os três passos numerados — a cópia abre numa aba no diretório original, ela
   escreve no projeto com a sua aprovação, você revisa e decide o commit. `Cancel` e `Open the
   copy`.
2. **Revisar e commitar**, quando a cópia fecha: lista dos arquivos com o tipo (M/A) e as linhas,
   `Discard` e `Commit`.
3. Resultado de falha: mesmo diálogo com o motivo, nunca fechando em silêncio (regra da V2-T34).

## 8. Settings

Diálogo com navegação à esquerda. Cada campo salva ao sair dele; erro na própria linha, com o
valor recusado e um exemplo do formato certo; etiqueta `custom` ou `default` por campo. Rodapé:
a frase de que o daemon relê a configuração a cada ciclo, e `Done`.

- **General:** `Theme` (System · Light · Dark) e `Start with the system` (o autostart, como
  interruptor; indisponível com o motivo quando o app não é dono do autostart).
  No fim da seção, a versão instalada (`seeya 0.1.0`), em texto terciário, selecionável para
  copiar.
- **Schedule:** horário de fim do dia, avisos antes, intervalo entre avisos, limiar de atraso.
- **Capture, Discovery, Terminal:** as demais chaves de hoje, com rótulos legíveis no lugar do
  nome da chave (o nome da chave fica como dica, em mono).
- **Projects:** a política por projeto, só leitura, como hoje.

## 9. Confirmações e criação

Todas com título que diz o fato, uma linha de contexto, o que cada opção faz escrito ao lado dela,
e o primário à direita.

- **Projeto travado:** quem segura o lock e desde quando; `Cancel` e `Open read-only`.
- **Mudanças pendentes de outra sessão:** a lista de arquivos (M/A); `Continue without
  committing` e `Commit now`, cada um explicado.
- **Retomada que não deu como estava:** o motivo e as saídas como cartões explicados (`Resume
  without the plan` recomendado quando existe); `Skip this one`, `Open a fresh session`, `Resume
  without the plan`.
- **Transição de posse do daemon:** o que cada escolha faz e que a pergunta é única;
  `Leave it as it is` e `Let seeya take over`. Passa a ter o estilo dos demais diálogos.
- **New project:** campo `Project id` com o formato explicado no erro (`Use lowercase letters,
  digits and hyphens — for example payments-webhooks.`).

## Dados novos em disco

Nomes a entrar no glossário do `AGENTS.md` na tarefa que os implementa, antes do código:

- **`theme`** em `config.json`: `'system' | 'light' | 'dark'`, padrão `'system'`.
- **Favoritos**: preferência pessoal desta máquina, em `~/.seeya/` (nunca no `seeya.json` do
  projeto). Nome sugerido: `favorite-projects.json` / `projectIds`.

## Ordem de entrega

1. **Fundação:** Preact, tokens dos dois temas, fontes, componentes base (botão, campo, seleção,
   caixa de marcar, interruptor, controle segmentado, diálogo, pílula de estado, linha de tabela,
   caixa informativa, estado vazio), o esqueleto da janela com lateral e barra de abas, e a
   medição de desempenho da D-051. Absorve a V2-T51.
2. **Lateral e rodapé** (seção 1), com o daemon em pílula.
3. **Barra de abas e New tab** (seção 2), com o terminal seguindo o tema.
4. **Settings** (seção 8), com tema e autostart.
5. **Today** (seção 3).
6. **Projects e favoritos** (seção 4).
7. **Sessions** (seção 5).
8. **End day** (seção 6).
9. **Adoção** (seção 7).
10. **Confirmações e criação** (seção 9).

Cada entrega apaga o código de DOM à mão que substitui e diz o custo de desempenho, conforme a
régua de `docs/DESEMPENHO.md`.

## Regra de processo

**Tarefa que muda o que a pessoa vê atualiza este arquivo antes do código.** Funcionalidade nova
nasce especificada com a tela: o que mostra, os estados, as ações e o texto. A tela que não está
aqui não foi decidida.
