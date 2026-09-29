---
id: TASK-51
title: 'V2-T61 — O projeto ganha CLAUDE.md gerado, com Compact Instructions'
status: Review
assignee: []
created_date: '2026-09-29 10:05'
updated_date: '2026-09-29 11:21'
labels: []
milestone: m-0
dependencies: []
priority: high
type: feature
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T61 — O projeto ganha CLAUDE.md gerado, com Compact Instructions.** Implementa a **D-050**
(decisão do mantenedor em 2026-09-29), a partir do spike O (V2-T41) e da leitura de documentação que
o completou: o Claude Code garante reinjetar o `CLAUDE.md` da raiz depois da compactação, e não diz
nada sobre o `AGENTS.md` — que é o único arquivo de instruções que o esqueleto gera desde a V2-T44.

**O que entra:**

1. **`CLAUDE.md` gerado a cada `open`, fora do git** — mesmo mecanismo do `.claude/settings.json`
   (V2-T34): escrito em `<projeto>/CLAUDE.md` por `seeya project open` (CLI e janela), nunca
   commitado (padrão no `.gitignore` do espaço de trabalho, conferido com `git status --ignored`
   real). Conteúdo, num lugar só em `core/`:
   - a linha `@AGENTS.md` (o conteúdo continua só no `AGENTS.md`);
   - uma seção `## Compact Instructions`, em inglês, dizendo ao resumo que preserve: a tarefa em
     andamento e o próximo passo; decisões tomadas na sessão que ainda não estão em `decisions/`;
     arquivos mudados e ainda não commitados; o que se aprendeu sobre ferramentas, acessos e
     ambiente que ainda não está em `context/know-how.md`. E que, depois de compactar, a sessão
     releia `INDEX.md` e `status/` antes de continuar. Curta.
2. **Projeto antigo com `CLAUDE.md` versionado** (criado antes da V2-T44): o `open` **não** o
   sobrescreve nem o apaga; imprime uma linha dizendo que o projeto tem um `CLAUDE.md` próprio e
   por isso não recebe o gerado (D-025). Nada de migração automática.
3. **Regras de trabalho** (`core/project-working-rules.ts`): acrescentar que o `CLAUDE.md` é gerado
   pelo seeya e não se edita — instruções do projeto vão no `AGENTS.md`.
4. **Adoção:** nada muda (a cópia roda no diretório original da sessão, V2-T29).

**Duas medições baratas, com sessões descartáveis (modelo `haiku`, teto de US$ 3 no total):**

- **(a) Duplicação no início:** com `CLAUDE.md` (`@AGENTS.md`) e `AGENTS.md` juntos na raiz, o
  conteúdo do `AGENTS.md` entra uma vez ou duas no contexto inicial? Se entrar duas, parar e
  registrar em `docs/QUESTOES.md` com a saída bruta — não escolher sozinho uma alternativa.
- **(b) Uma compactação real** (mesma técnica do spike O, a automática): depois dela, o conteúdo do
  `AGENTS.md` (via import) volta ao contexto? E a seção Compact Instructions aparece refletida no
  resumo? Registrar a saída bruta anonimizada num apêndice do `docs/spikes/O-gancho-antes-da-compactacao.md`.
  Os transcripts ficam no lugar para o PO conferir; listar as pastas no relatório.

**Cuidados:** a janela e a CLI usam a mesma geração (sem duplicar texto); nada no espaço de trabalho
real, no `~/.seeya` real ou no `~/.claude` além do que o próprio `claude` grava das sessões
descartáveis; comando bloqueado por permissão ou pela proteção da worktree **não se contorna** (nem
reescrevendo em script) — para o passo e reporta.

**Aceite do mantenedor:** abrir um projeto, ver o `CLAUDE.md` gerado e fora do `git status`; ler o
apêndice do spike.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementado nos itens 1-4 da tarefa.

O que entrou:
- packages/engine/src/core/project-claude-md.ts#buildGeneratedClaudeMd() - texto puro (import
  @AGENTS.md + secao Compact Instructions), o unico lugar que carrega o conteudo.
- packages/engine/src/application/claude-md-bridge.ts#ensureGeneratedClaudeMdInstalled - decide
  written/skippedVersioned (D-024) a partir da porta nova WorkspaceRepository.isClaudeMdVersioned;
  nunca sobrescreve nem apaga um CLAUDE.md ja versionado (D-025).
- Duas portas novas em core/ports.ts (isClaudeMdVersioned, installGeneratedClaudeMd), implementadas
  em adapters/workspace/index.ts sobre o comando de listagem de rastreados e escrita atomica; o
  arquivo de exclusoes do espaco de trabalho ganhou o nome nu CLAUDE.md (casa em qualquer
  profundidade, como .seeya-lock) em IGNORED_WORKSPACE_PATTERNS.
- application/project-open.ts#openProject chama a nova funcao no mesmo ponto onde o gancho do
  harness ja e reafirmado - serve CLI e janela sem duplicar texto (a janela nao precisou de nenhuma
  mudanca propria: ela ja chama openProject).
- cli/format-project.ts#formatClaudeMdLines + project-command.ts imprimem uma linha so quando
  skippedVersioned (item 2), via o mesmo onBeforeLaunch que ja carrega audit/missing/lock.
- core/project-working-rules.ts ganhou a linha 'CLAUDE.md e gerado por seeya, nao se edita'.
- Glossario do AGENTS.md atualizado (linha 'CLAUDE.md gerado com Compact Instructions') antes do
  codigo, como pedido.
- Adocao (item 4): nada mudou - seeya project adopt nunca chama openProject/o HarnessLauncher que
  este codigo toca; confirmado por leitura, sem necessidade de alteracao.

Testes: unidade para o texto (tests/unit/core/project-claude-md.test.ts), para a decisao
versionado-nao-gera (tests/unit/application/claude-md-bridge.test.ts, mais os cenarios em
project-open.test.ts), para a linha da CLI (format-project.test.ts) e para a regra nova
(project-working-rules.test.ts). Integracao com o binario real de controle de versao em
tests/integration/workspace/fs-workspace-repository.test.ts (bloco 'CLAUDE.md bridge'): o comando
de status com a flag de ignorados mostrando o CLAUDE.md gerado como ignorado (caso permitido), e um
CLAUDE.md versionado a forca (simulando um projeto anterior a V2-T44) continuando rastreado
normalmente (caso proibido/preexistente) - mais o caso de erro (listagem sem repositorio
inicializado).

Medicoes (com sessoes descartaveis reais, modelo economico, ambiente sem as seis variaveis de
D-017, prompt por stdin nunca por argumento):

(a) Duplicacao - NAO houve. Tres perguntas: contagem simples de uma sentinela (resposta '1'),
reproducao literal de tudo que estava no contexto (mostrou o CLAUDE.md e, logo em seguida, o
AGENTS.md uma unica vez, nenhum outro bloco repete o conteudo), e uma terceira que pedia citacao
literal - essa terceira induziu o modelo a inventar uma segunda fonte (contradita pelo proprio
registro de uso da propria chamada, que mostra zero uso de ferramenta), achado registrado como
nota metodologica no apendice, nao como duplicacao real. Nada foi registrado em docs/QUESTOES.md
porque nao houve duplicacao.

(b) Compactacao automatica real - uma tentativa inicial com o enchimento do segundo turno maior que
o proprio teto de 200k tokens falhou com 'Prompt is too long' (confirma o achado ja registrado no
corpo do spike: compactar so reduz o historico anterior, nunca o turno pendente) e, ao ser repetida
na mesma sessao, produziu uma segunda compactacao em cima da primeira ja degradada - os quatro
fatos vieram como 'nenhum' nesse caminho contaminado (a sentinela do AGENTS.md ainda voltou certa).
Uma segunda tentativa, limpa (sessao nova, um unico corte de ~50k tokens no segundo turno,
exatamente uma compactacao real, preTokens 221761 para postTokens 53217), trouxe as cinco
respostas certas: os quatro fatos que o Compact Instructions pede para preservar (tarefa e proximo
passo, decisao nao escrita, arquivo nao commitado, aprendizado de ambiente) e a sentinela do
AGENTS.md via import. O resumo real (lido do transcript) mostra as quatro categorias refletidas em
secoes proprias (Pending Tasks, Current Work) - com a ressalva honesta registrada no apendice de
que o formato padrao de resumo do Claude Code ja tem secoes genericas que tenderiam a capturar isso
de qualquer forma, entao nao da para isolar quanto e efeito do Compact Instructions. Apendice
completo, com saida bruta anonimizada, em docs/spikes/O-gancho-antes-da-compactacao.md.

Custo total das sete chamadas reais: US$ 1,99 (dentro do teto de US$ 3). Pastas de transcript
criadas em ~/.claude/projects/ (nao apagadas, por instrucao da tarefa) - tres diretorios de projeto
descartavel (dup-check-project, compact-project-t61 - a tentativa contaminada,
compact-project-t61b - a medicao limpa), fora do repositorio, dentro do scratch deste agente;
nenhuma sessao real do mantenedor nem o home real do mantenedor foram tocados.

Recusa registrada: a chamada de teste com identidade global vazia de controle de versao foi
recusada pela protecao da worktree (mensagem: operations must target its own worktree) - nao
contornada, conforme instrucao. npm run verificar rodou verde tres vezes, antes e depois dos
commits.

npm run verificar: verde (tipos, lint, build, dependencias, cobertura - 96,24 por cento
statements, 92 por cento branches, 95,18 por cento funcoes, 96,49 por cento linhas, todos os pisos
por diretorio respeitados).

Nenhuma questao nova para docs/QUESTOES.md - nem a duplicacao (nao ocorreu) nem a decisao de nao
estender o formatProjectOpenOutcomeText do packages/app para citar skippedVersioned (mesmo padrao
que a janela ja segue para audit e missing-repository, que tambem nao aparecem la - consistencia,
nao descoberta de problema).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: PO
created: 2026-09-29 11:21
---
Revisão do PO em 2026-09-29: mesclado, portão verde (2873 testes) e também sem identidade global do git (rodado pelo PO — a proteção da worktree recusou esse comando ao agente, que parou e reportou, sem contornar, como pedido). Conferido no transcript da medição limpa: uma compactação real (221.761 → 53.217 tokens) e o bloco CLAUDE.md + conteúdo do AGENTS.md presente de novo depois dela — a reinjeção via import está provada; sem duplicação no início. Custo das medições US$ 1,99. Ressalva do agente mantida: não dá para isolar quanto do resumo é efeito das Compact Instructions. Falta o aceite do mantenedor: abrir um projeto, ver o CLAUDE.md gerado e fora do git status.
---
<!-- COMMENTS:END -->
