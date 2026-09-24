---
id: decision-29
title: 'D-029 — Revoga a terceira estratégia: avisar, em vez de contornar'
date: '2026-09-24 00:26'
status: accepted
---
## Contexto

**Revoga D-023.** Proposta do mantenedor, em 2026-08-19.

O D-023 criou uma terceira estratégia de descoberta para enxergar sessões que não se registram e
não deixam transcript. Ela custou: uma terceira forma na união de tipos do núcleo, enumeração de
processos por sistema operacional (Linux por `/proc`, macOS por `lsof`, Windows sem suporte),
captura de linha de comando com a questão de privacidade que ela abre, e um identificador — o PID
— que não é estável entre varreduras.

**O argumento que decide, e ele já estava no repositório.** O **D-018** enfrenta a mesma causa
raiz — sessão aberta de dentro de outra sessão — e escolhe resposta oposta: **informar a causa
provável e a correção**, uma vez por sessão, deixando o usuário resolver. O projeto estava dando
duas respostas incoerentes para o mesmo problema: explicar num caso, construir maquinaria no
outro.

E a perda é pequena: a sessão-filha invisível foi lançada por uma **sessão pai que é visível e tem
transcript próprio**. O trabalho não desaparece do alcance do `seeya`; muda de sujeito.

## Medição feita antes de revogar (2026-08-19, Windows 11)

O D-023 afirma que uma sessão "lançada com prompt como argumento" não produz `<pid>.json` e
produz `<pid>.<hash>.key`. Testado com amostragem contínua — necessária porque a entrada do
registro é apagada na saída graciosa (Spike E), e uma primeira tentativa que conferiu só ao final
viu "nada" por isso:

| binário | aninhado? | `.json` | `.key` | transcript |
|---|---|---|---|---|
| 2.1.235 | sim (`CLAUDE_CODE_CHILD_SESSION=1`) | **sim** | não | sim |
| 2.1.233 | sim (idem) | **sim** | não | sim |

A 2.1.233 é a versão que os documentos apontam como portadora do supressor. Nas duas, a sessão se
registrou normalmente. **A hipótese de versão está descartada** — e essa checagem não foi zelo: o
projeto já concluiu errado uma vez por testar numa versão diferente da observada (Spike D), e o
D-023 não registra sob qual versão mediu.

**O que continua não testado**, e por isso a decisão não se apoia nisso: o caminho real, com
script intermediário, aninhamento mais profundo e sessões de vida longa. As sessões de teste
viveram de 4 a 6 segundos. O fenômeno observado pelo mantenedor é real; o que caiu foi a **causa
atribuída**, não a observação.

## Decisão

A descoberta volta a ter **duas** estratégias (D-016). No lugar da terceira:

1. **A detecção barata fica.** Listar `~/.claude/sessions/` e ver `.key` sem `.json` custa uma
   listagem de diretório. Isso continua, e alimenta o aviso.
2. **O aviso substitui o contorno**, como extensão do D-018 e da S1-T7: o `seeya` diz quantas
   sessões existem que ele **não consegue inspecionar**, e aponta o caminho conhecido (sessão
   aberta de dentro de outra). Não afirma a causa como certa — ela não está estabelecida.
3. **Sai tudo o que vinha depois:** enumeração de processos, leitura de `cwd`, captura de linha de
   comando, e a terceira forma da união de tipos.

## Consequências

- O `.key` continua sendo lido **apenas pelo nome**. Nunca o conteúdo (modo 600).
- **Q-011 deixa de existir**: sem captura de linha de comando, não há segredo indo para disco.
- **Q-010 deixa de existir**: sem essa origem, nada é deduplicado por PID.
- A união de tipos volta a **duas** formas, e o núcleo simplifica.
- O buraco do Windows (sem `cwd` sem código nativo) para de importar.
- Se o gatilho verdadeiro for identificado um dia, isto reabre — mas aí com causa conhecida, e a
  resposta provavelmente continua sendo avisar, não contornar.
