# Decisões

As decisões de produto e arquitetura deste projeto vivem em `backlog/decisions/`, uma por
arquivo, na convenção do [Backlog.md](https://github.com/MrLesk/Backlog.md) (D-048). Este
arquivo é só o índice — o identificador `D-0NN` continua sendo como código, comentários e
documentos citam cada uma, e é por ele que este índice está ordenado.

**Consultar:** `backlog decision list` no terminal (ou `backlog browser` para o quadro no
navegador), ou abra o arquivo linkado abaixo diretamente.

**O agente dev não altera nenhuma decisão.** Se uma tarefa parecer exigir a violação de uma,
pare e abra uma questão em `docs/QUESTOES.md` em vez de decidir sozinho.

**Status.** `accepted` — vigente. `superseded` — substituída por inteiro, com o ponteiro para a
decisão nova no próprio arquivo. `proposed` — escrita e ainda não confirmada pelo mantenedor.
Uma decisão **emendada** (só uma parte mudou) continua `accepted` e carrega, no corpo, uma seção
dizendo o que mudou e por qual decisão — "emendada" não é status.

| Decisão | Arquivo |
|---|---|
| D-001 — O handoff é gerado por fora da sessão, nunca por dentro | `backlog/decisions/decision-1 - D-001-—-O-handoff-é-gerado-por-fora-da-sessão-nunca-por-dentro.md` |
| D-002 — Encerrar a sessão viva é opt-in, por sessão | `backlog/decisions/decision-2 - D-002-—-Encerrar-a-sessão-viva-é-opt-in-por-sessão.md` |
| D-003 — Geração híbrida: fatos e entendimento | `backlog/decisions/decision-3 - D-003-—-Geração-híbrida-fatos-e-entendimento.md` |
| D-004 — "Iniciar o dia" retoma a sessão original | `backlog/decisions/decision-4 - D-004-—-Iniciar-o-dia-retoma-a-sessão-original.md` |
| D-005 — Daemon próprio para o agendamento | `backlog/decisions/decision-5 - D-005-—-Daemon-próprio-para-o-agendamento.md` |
| D-006 — Adiar por incrementos, ou pular o dia | `backlog/decisions/decision-6 - D-006-—-Adiar-por-incrementos-ou-pular-o-dia.md` |
| D-007 — Estado global em `~/.seeya` | `backlog/decisions/decision-7 - D-007-—-Estado-global-em-seeya.md` |
| D-008 — Node 22 + TypeScript, tudo em português | `backlog/decisions/decision-8 - D-008-—-Node-22--TypeScript-tudo-em-português.md` |
| D-009 — Só Claude na v1, mas atrás de uma interface | `backlog/decisions/decision-9 - D-009-—-Só-Claude-na-v1-mas-atrás-de-uma-interface.md` |
| D-010 — O binário se chama `seeya` | `backlog/decisions/decision-10 - D-010-—-O-binário-se-chama-seeya.md` |
| D-011 — Captura enxuta por padrão, profunda por opção | `backlog/decisions/decision-11 - D-011-—-Captura-enxuta-por-padrão-profunda-por-opção.md` |
| D-012 — Os forks são responsabilidade do `seeya` | `backlog/decisions/decision-12 - D-012-—-Os-forks-são-responsabilidade-do-seeya.md` |
| D-013 — Transcript é uma fonte de evidência, não a fonte | `backlog/decisions/decision-13 - D-013-—-Transcript-é-uma-fonte-de-evidência-não-a-fonte.md` |
| D-014 — O wrapper PTY é v2, e é aditivo | `backlog/decisions/decision-14 - D-014-—-O-wrapper-PTY-é-v2-e-é-aditivo.md` |
| D-015 — Contexto vai por stdin ou arquivo, nunca por argumento | `backlog/decisions/decision-15 - D-015-—-Contexto-vai-por-stdin-ou-arquivo-nunca-por-argumento.md` |
| D-016 — Descoberta por duas estratégias, não uma | `backlog/decisions/decision-16 - D-016-—-Descoberta-por-duas-estratégias-não-uma.md` |
| D-017 — O `seeya` declara o ambiente que dá ao `claude`, nunca herda | `backlog/decisions/decision-17 - D-017-—-O-seeya-declara-o-ambiente-que-dá-ao-claude-nunca-herda.md` |
| D-018 — Detectar a supressão e dizer como resolver | `backlog/decisions/decision-18 - D-018-—-Detectar-a-supressão-e-dizer-como-resolver.md` |
| D-019 — O que é proibido é ler o relógio, não construir uma data | `backlog/decisions/decision-19 - D-019-—-O-que-é-proibido-é-ler-o-relógio-não-construir-uma-data.md` |
| D-020 — `cli/` é a única raiz de composição (emendada pela D-043) | `backlog/decisions/decision-20 - D-020-—-cli-é-a-única-raiz-de-composição.md` |
| D-021 — Campo de exibição nunca torna uma sessão invisível | `backlog/decisions/decision-21 - D-021-—-Campo-de-exibição-nunca-torna-uma-sessão-invisível.md` |
| D-022 — Lista de fonte externa valida item por item, nunca em bloco | `backlog/decisions/decision-22 - D-022-—-Lista-de-fonte-externa-valida-item-por-item-nunca-em-bloco.md` |
| D-023 — Terceira estratégia de descoberta: processo e `.key` sem `.json` (**superseded** pela D-029) | `backlog/decisions/decision-23 - D-023-—-Terceira-estratégia-de-descoberta-processo-e-.key-sem-.json.md` |
| D-024 — Schema é fiel, domínio torna inválido irrepresentável | `backlog/decisions/decision-24 - D-024-—-Schema-é-fiel-domínio-torna-inválido-irrepresentável.md` |
| D-025 — Ausência de dado não vira afirmação sobre o mundo | `backlog/decisions/decision-25 - D-025-—-Ausência-de-dado-não-vira-afirmação-sobre-o-mundo.md` |
| D-026 — Anti-duplicidade compara evidência, não transcript | `backlog/decisions/decision-26 - D-026-—-Anti-duplicidade-compara-evidência-não-transcript.md` |
| D-027 — O diretório de dados é `~/.seeya/`, igual ao comando | `backlog/decisions/decision-27 - D-027-—-O-diretório-de-dados-é-~-.seeya-igual-ao-comando.md` |
| D-028 — Inglês no que é público, português no que é interno | `backlog/decisions/decision-28 - D-028-—-Inglês-no-que-é-público-português-no-que-é-interno.md` |
| D-029 — Revoga a terceira estratégia: avisar, em vez de contornar | `backlog/decisions/decision-29 - D-029-—-Revoga-a-terceira-estratégia-avisar-em-vez-de-contornar.md` |
| D-030 — A costura de harness é a porta, não a classe | `backlog/decisions/decision-30 - D-030-—-A-costura-de-harness-é-a-porta-não-a-classe.md` |
| D-031 — O `seeya` captura o que está vivo, e o que morreu por acidente | `backlog/decisions/decision-31 - D-031-—-O-seeya-captura-o-que-está-vivo-e-o-que-morreu-por-acidente.md` |
| D-032 — Evidência de git segue arquivos tocados, por repositório | `backlog/decisions/decision-32 - D-032-—-Evidência-de-git-segue-arquivos-tocados-por-repositório.md` |
| D-033 — A moldura é pública; o conteúdo gerado espelha a sessão | `backlog/decisions/decision-33 - D-033-—-A-moldura-é-pública-o-conteúdo-gerado-espelha-a-sessão.md` |
| D-034 — Notificação sem ações no v1: o botão pertence à GUI, não ao CLI | `backlog/decisions/decision-34 - D-034-—-Notificação-sem-ações-no-v1-o-botão-pertence-à-GUI-não-ao-CLI.md` |
| D-035 — O que vira config e o que fica constante | `backlog/decisions/decision-35 - D-035-—-O-que-vira-config-e-o-que-fica-constante.md` |
| D-036 — Agendamento vencido não age sozinho: captura sim, encerra não (emendada pela D-046) | `backlog/decisions/decision-36 - D-036-—-Agendamento-vencido-não-age-sozinho-captura-sim-encerra-não.md` |
| D-037 — Um mundo, um seeya: enxerga as sessões de onde foi instalado | `backlog/decisions/decision-37 - D-037-—-Um-mundo-um-seeya-enxerga-as-sessões-de-onde-foi-instalado.md` |
| D-038 — Todo processo do seeya é invisível, salvo a sessão pedida | `backlog/decisions/decision-38 - D-038-—-Todo-processo-do-seeya-é-invisível-salvo-a-sessão-pedida.md` |
| D-039 — O seeya é secretário: agrega, organiza, sintetiza — nunca decide | `backlog/decisions/decision-39 - D-039-—-O-seeya-é-secretário-agrega-organiza-sintetiza-—-nunca-decide.md` |
| D-040 — O produto se chama `seeya`; no npm, escopo `@seeya-ai` | `backlog/decisions/decision-40 - D-040-—-O-produto-se-chama-seeya-no-npm-escopo-seeya-ai.md` |
| D-041 — Sprint 5 mínimo, depois a v2; publicação só na fronteira da v2 | `backlog/decisions/decision-41 - D-041-—-Sprint-5-mínimo-depois-a-v2-publicação-só-na-fronteira-da-v2.md` |
| D-042 — A interface embute o terminal; não orquestra o do sistema | `backlog/decisions/decision-42 - D-042-—-A-interface-embute-o-terminal-não-orquestra-o-do-sistema.md` |
| D-043 — Um repositório, três pacotes; duas raízes de composição | `backlog/decisions/decision-43 - D-043-—-Um-repositório-três-pacotes-duas-raízes-de-composição.md` |
| D-044 — A CI não roda para push que só toca `docs/` ou `AGENTS.md` | `backlog/decisions/decision-44 - D-044-—-A-CI-não-roda-para-push-que-só-toca-docs-ou-AGENTS.md.md` |
| D-045 — Na v2 o app é dono do daemon/autostart; a CLI vira cliente (emendada pela D-047) | `backlog/decisions/decision-45 - D-045-—-Na-v2-o-app-é-dono-do-daemon-autostart-a-CLI-vira-cliente.md` |
| D-046 — Encerramento muito vencido vira pendência, não roda sozinho | `backlog/decisions/decision-46 - D-046-—-Encerramento-muito-vencido-vira-pendência-não-roda-sozinho.md` |
| D-047 — Uma sessão escreve o projeto por vez, garantido por código | `backlog/decisions/decision-47 - D-047-—-Uma-sessão-escreve-o-projeto-por-vez-garantido-por-código.md` |
| D-048 — As tarefas saem do plano único e vão para o Backlog.md | `backlog/decisions/decision-48 - D-048-—-As-tarefas-saem-do-plano-único-e-vão-para-o-Backlog.md.md` |
| D-049 — Gancho antes do push agora, pull request quando fechar | `backlog/decisions/decision-49 - D-049-—-Gancho-antes-do-push-agora-pull-request-quando-fechar.md` |
