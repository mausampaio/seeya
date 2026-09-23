---
id: decision-11
title: 'D-011 — Captura enxuta por padrão, profunda por opção'
date: '2026-09-23 10:54'
status: accepted
---
## Contexto

Medido no Spike A e no Spike C: `--resume` completo custa ~US$ 0,50 por sessão
(82 k tokens de contexto reescritos no cache); sessão nova com contexto enxuto custa ~US$ 0,15
(dos quais ~12 k tokens são piso fixo do próprio Claude Code, não o nosso texto).

## Decisão

O padrão é **enxuto**: o `seeya` lê o transcript, extrai o que importa e manda para
uma sessão nova. Projetos marcados com `deepCapture: true` na config usam `--resume`
completo.

## Consequências

- `GeradorDeHandoff` tem duas implementações atrás da mesma porta; a escolha é config, não `if`
  espalhado.
- A geração usa `--tools ""`, `--system-prompt` curto e `--json-schema`, para derrubar o piso de
  tokens e domar a saída (Spike C, segundo achado).

  > **CORREÇÃO (2026-08-29, medido na S2-T2).** Os três flags **não compõem**, ao contrário do
  > que esta linha sugeria. Medido com o mesmo contexto, modelo haiku, claude 2.1.235:
  >
  > | flags | tokens de entrada | custo |
  > |---|---|---|
  > | nenhuma | 23.607 | US$ 0,0488 |
  > | `--tools ""` | 7.136 | US$ 0,0159 |
  > | `--tools ""` + `--json-schema` | **40.076** | US$ 0,0831 |
  >
  > O `--tools ""` cumpre a promessa (~70% de redução). O `--json-schema` **mais que quintuplica**
  > o piso em relação a ele, ficando acima até da chamada sem otimização nenhuma. O motivo foi
  > identificado, não só observado: com ele o `stop_reason` vira `tool_use` e o `num_turns` vira 2
  > — a saída estruturada é uma chamada de ferramenta forçada internamente, que o `--tools ""`
  > não desliga.
  >
  > **Os três continuam em uso**: extração confiável pesa mais que o custo marginal, e um
  > handoff que falha ao parsear cai para determinístico, perdendo a camada de entendimento que
  > é o único motivo de chamar o modelo. Mas o piso real do modo enxuto com saída estruturada
  > está perto de **US$ 0,08–0,09** (haiku), não dos US$ 0,15 estimados no Spike C. Ver Q-020.
- O custo estimado do encerramento é mostrado no `--dry-run`.

## Reavaliação (2026-08-31, sob a D-031)

> **REAVALIAÇÃO (2026-08-31, sob a D-031).** O padrão **continua enxuto**, mas por um motivo
> diferente do original, e com uma obrigação nova.
>
> **O motivo original enfraqueceu.** O enxuto foi escolhido porque ~US$ 0,50 por sessão no modo
> profundo é proibitivo **vezes 40**. A D-031 tirou do escopo as sessões fechadas
> deliberadamente, e o conjunto candidato passou a ser um punhado de sessões vivas. Vezes
> quatro ou cinco, US$ 0,50 deixa de ser proibitivo.
>
> **Mas o profundo não é a resposta, e a razão é o que ele compra.** Ele entrega ao modelo a
> conversa **inteira**, incluindo saída de ferramenta — logs, diffs, listagens. O próprio Claude
> Code, no prompt do away summary (Spike I), manda **pular** exatamente isso: *"Skip root-cause
> narrative, fix internals, secondary to-dos"*. Pagar 5x por contexto que o próprio fornecedor
> instrui a descartar é comprar ruído a preço de sinal.
>
> **O defeito medido é outro, e é barato de consertar.** O modo enxuto monta `buildLeanPrompt`
> com cinco coisas: projeto, `cwd`, última atividade, **os dez últimos prompts do usuário** e
> arquivos tocados. O `processAssistantEntry` (`adapters/transcript/reader.ts`) extrai das
> entradas do assistente **apenas** timestamp e caminhos de arquivo. **O texto do assistente é
> descartado estruturalmente — nunca chega a existir em `SessionFacts`.**
>
> Foi assim que o primeiro teste real perdeu o "4 concluídas, 6 pendentes": a frase existia, dita
> pelo modelo, num turno de assistente. O modelo da captura não falhou — respondeu com honestidade
> sobre evidência que não tinha (D-025). **Não é problema de prompt; é ausência de dado.**
>
> **A decisão: o enxuto para de jogar fora o texto do assistente.** Isso ataca a falha observada
> pelo preço do enxuto, é reversível, e deixa o profundo como o que ele sempre foi — opção por
> projeto, para quem quiser pagar pela conversa inteira.
>
> **Com uma condição, porque senão isto vira o erro que esta própria decisão já cometeu uma vez:**
> **quanto** de texto do assistente entra tem que ser **medido**, não escolhido por analogia. A
> primeira versão desta decisão estimou US$ 0,15 para o enxuto e a medição da S2-T2 achou
> US$ 0,08–0,09 e um `--json-schema` que **quintuplica** o piso — o oposto do que se supunha.
> Mensagem de assistente é longa; escolher "os últimos N" sem medir repetiria a mesma classe de
> erro.
>
> **O que NÃO muda:** o profundo continua opt-in por projeto (`deepCapture`), a saída continua
> estruturada (Q-034 fechada: o caminho barato do cache exige abrir mão dela, e a D-031 tirou a
> pressão de custo que justificaria a troca), e o handoff que falha ao parsear continua caindo
> para determinístico (D-003).
