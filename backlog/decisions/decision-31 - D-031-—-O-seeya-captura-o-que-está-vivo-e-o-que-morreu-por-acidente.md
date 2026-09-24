---
id: decision-31
title: 'D-031 — O seeya captura o que está vivo, e o que morreu por acidente'
date: '2026-09-24 00:26'
status: accepted
---
## Contexto

**Proposta do mantenedor, em 2026-08-30**, depois do primeiro teste ponta a ponta real.

O produto existe para fazer um **corte do trabalho em andamento** e devolver a pessoa a ele no
dia seguinte. Sessão fechada não é trabalho em andamento — e, pior, **não diz nada sobre por que
foi fechada**: pode ter sido concluída, abandonada, ou fechada para continuar depois. Nada no
rastro distingue os três.

A analogia do mantenedor, que é o argumento inteiro em uma frase: seria o equivalente a, em vez
de olhar os documentos **abertos** no fim do dia, varrer o computador inteiro atrás de todos os
arquivos alterados naquele dia. E a escala não é hipotética — ele abre e fecha **mais de 40
sessões** num dia de trabalho normal.

**O sinal que separa os casos já estava medido.** O Spike E mediu que a entrada do registro
existe apenas enquanto o processo vive e **é apagada na saída graciosa**; entrada obsoleta
sobrevive só a terminação anormal — kill, crash, queda de energia. Nas palavras do próprio spike:
*"entrada obsoleta é acidente, nunca registro confiável de trabalho concluído"*. Isso dá três
populações, não duas:

| situação | significado | escopo |
|---|---|---|
| registro + PID vivo (`alive`/`idle`) | sessão viva | **captura** |
| registro + PID morto (`ended`) | morreu **sem** sair graciosamente | **captura** |
| só transcript, sem registro (`unknown`) | saiu graciosamente: a pessoa fechou | **fora** |

## Decisão

A captura do fim do dia cobre a sessão viva e a que morreu por acidente. A sessão fechada
deliberadamente **sai do escopo da captura**.

A segunda linha não é concessão: terminal fechado no braço, máquina que suspendeu e não voltou,
`claude` que caiu — a pessoa **perdeu** aquilo sem escolher, que é exatamente quando um handoff
mais serve. Só a saída graciosa é decisão dela.

**A sessão fechada aparece no briefing como listagem, nunca como captura.** E a listagem só se
justifica se identificar a sessão **para um humano**: "code-6d, fechada 17h" não diz nada a
ninguém.

## A listagem da sessão fechada

**Medido em 2026-08-30, depois de o mantenedor perguntar de onde vem o "recap" que ele usa para
reconhecer as próprias sessões.** O recap longo que ele mostrou **não está em disco**: varredura
de todo o `~/.claude` atrás das frases dele achou só a mensagem em que ele próprio o citou
(`history.jsonl` e o transcript da sessão). É gerado para exibição, não persistido.

Mas duas entradas do transcript servem, e saem de graça:

| entrada | forma | nesta sessão |
|---|---|---|
| `ai-title` | `{ type, aiTitle, sessionId }` | 388 ocorrências — regravada conforme a sessão evolui |
| `last-prompt` | `{ type, lastPrompt, leafUuid, sessionId }` | 387 ocorrências |

O `aiTitle` desta sessão, no momento da medição: *"Planejar desenvolvimento do app
see-you-tomorrow"*. Não é o recap rico — é bem mais curto. Mas as 388 ocorrências mostram que ele
**acompanha o assunto ao longo do dia** em vez de congelar no começo. E o `last-prompt` mostra que
o Claude Code **já persiste o último prompt sozinho**, sem precisarmos derivá-lo de
`SessionFacts.lastPrompts`.

**A linha da listagem passa a ser título + último prompt**: o título diz do que a sessão trata, o
prompt diz onde ela parou. Nenhum dos dois custa chamada de modelo — o Claude Code já pagou por
eles. Isso resolve o "qual das 40 era aquela" sem pagar captura por nenhuma.

**E encaixa exatamente na população certa:** o `aiTitle` mora no **transcript**, não no registro.
O registro some na saída graciosa (Spike E); o transcript não. Ou seja, ele sobrevive justamente
nas sessões para as quais esta listagem existe.

**Ressalva, mesma classe de risco do `--append-system-prompt-file`:** `ai-title` é entrada interna
não documentada. Ela já está catalogada em `KNOWN_ENTRY_TYPES` (`adapters/transcript/schemas.ts`)
— o projeto sabe que ela existe e hoje **não a lê**, porque só `user` e `assistant` têm schema
estrutural. Se a listagem depender dela, ela merece teste de contrato como o do flag. E o D-025
se aplica: entrada ausente vira **listagem sem título**, nunca título inventado.

## Consequências

**O que isto custa, dito na cara.** O varrimento de transcript (segunda estratégia da D-016) não
enxerga só as fechadas com carinho: é também o que encontra **sessões vivas que não se
registraram** (D-018). Sem registro elas não têm PID, então caem todas no mesmo estado `unknown`
— **não há como separar "viva e não registrada" de "fechada graciosamente"**. Esta decisão tira a
captura das duas juntas. A perda é parcialmente antiga: a D-029 já tinha recusado construir
maquinaria para essa população e escolhido **avisar** em vez de contornar. O aviso continua; a
captura é que sai.

**Três decisões que isto revisa, e nenhuma delas é pequena:**

1. **D-001.** A consequência "funciona mesmo para sessões que já morreram" deixa de ser
   **objetivo** e passa a ser efeito colateral a conter. A decisão de gerar por fora continua
   valendo inteira — pelos motivos que sobrevivem (não gastar o contexto da sessão viva, não
   interromper o turno, um mecanismo só), e não pela impossibilidade técnica que o texto dela
   ainda alega. Ver a correção separada sobre o canal de mensagens.
2. **D-016.** O papel da segunda estratégia muda: ela continua descobrindo, para listar e para
   avisar, mas deixa de alimentar a captura.
3. **D-011.** É a revisão mais interessante, e vem de graça. O padrão enxuto foi escolhido porque
   ~US$ 0,50 por sessão no modo profundo é proibitivo — **vezes 40**. Vezes três ou cinco, é
   plausível. Se o conjunto candidato encolhe para as sessões vivas, o argumento que sustentava o
   enxuto por padrão enfraquece, e o profundo entrega ao modelo a conversa inteira.

**Por que isso importa mais do que parece.** O primeiro teste real mostrou o modelo dizendo,
corretamente, que não havia confirmação no contexto sobre o que tinha sido feito — enquanto a
conversa dizia, em texto do assistente, "4 concluídas, 6 pendentes". O modo enxuto nunca vê o
texto do assistente: `processAssistantEntry` extrai dele apenas timestamp e caminhos de arquivo.
Reavaliar a D-011 com a conta nova pode resolver isso **por escopo** — o modelo passando a ler o
que o Claude escreveu — em vez de por remendo no prompt.
