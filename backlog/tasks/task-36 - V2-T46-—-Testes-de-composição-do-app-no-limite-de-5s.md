---
id: TASK-36
title: V2-T46 — Testes de composição do app no limite de 5s
status: Review
assignee: []
created_date: '2026-09-24 14:27'
updated_date: '2026-09-24 16:11'
labels: []
dependencies: []
references:
  - tests/integration/app/composition.test.ts
priority: medium
type: bug
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T46 — Dois testes de composição do app vivem no limite de 5s.** Encontrado pelo PO em
2026-09-24, no portão da V2-T45; o agente da V2-T43 já tinha visto o mesmo sintoma no mesmo dia.

**O sintoma.** `npm run verificar` falhou **duas vezes seguidas** no mesmo ponto,
`tests/integration/app/composition.test.ts`, com `Test timed out in 5000ms`:

- `buildAppContext > reads config.json for relevanceHours and wires a SessionProvider that discovers real fixture sessions`
- `buildAppContext > checkDaemonOwnershipTransitionOffer resolves to a boolean without throwing`

**Não é da V2-T45** (que não toca em TypeScript): medido no `main` sem ela, o arquivo sozinho,
com `--reporter verbose`, dá **3.180 ms** e **4.495 ms** para esses dois testes. A folga do segundo
é de meio segundo; com a suíte inteira rodando em paralelo, estoura. É repetível nesta máquina, não
um acaso.

**O que entra:**

1. **Medir para onde vão os 4,5 s.** A suspeita é que `buildAppContext` monta os adaptadores de
   verdade, e `checkDaemonOwnershipTransitionOffer` consulta o estado real da máquina — a detecção
   de instalação (registro do Windows) e o autostart. Depois de 2026-09-24 esta máquina tem o app
   instalado por máquina, o que pode ter mudado o caminho percorrido. Confirme ou descarte com
   medição, não com leitura.
2. **Se o teste lê estado global da máquina, isso é o defeito**, não o tempo: "nenhum teste toca...
   o `~/.seeya` real" existe porque o resultado passa a depender de em que máquina ele roda. A
   correção é o teste não depender disso (duplo nomeado implementando a porta, como manda o
   `AGENTS.md`), e o que ele protege continuar protegido.
3. **Só aumentar o timeout não é correção.** Se, depois do item 1, algum custo for legítimo e
   inevitável, o timeout novo cita a medição no comentário.

**Aceite:** `npm run verificar` verde três vezes seguidas nesta máquina, e o tempo de cada um dos
dois testes, antes e depois, no relatório.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Medição (arquivo sozinho, `--reporter verbose`, antes de qualquer mudança, nesta máquina):**

- `reads config.json for relevanceHours...`: 3141 ms
- `checkDaemonOwnershipTransitionOffer resolves to a boolean without throwing`: 4565 ms

**Para onde iam os segundos — confirmado com medição isolada de cada chamada `powershell.exe`
(mesmo `CommandRunner`/`spawnCommand` que os adaptadores usam), não com leitura de código:**

- `buildAppContext` resolve `daemonOwner` chamando `AppInstallation.find()` incondicionalmente,
  em TODO teste do arquivo (12 chamadas) — no Windows, uma consulta ao registro do Windows via
  `powershell.exe` (três raízes: `HKCU`, `HKLM`, `HKLM\...\WOW6432Node`). Medido: ~420 ms depois de
  "aquecido", ~3.06 s no primeiro spawn de `powershell.exe` do arquivo inteiro (é exatamente esse
  custo frio que caiu sobre o primeiro teste do arquivo, `reads config.json...`).
- `checkDaemonOwnershipTransitionOffer` chama `Autostart.status()`, que no Windows roda
  `Get-ScheduledTask` — medido em **~1.3-4.0 s por chamada, TODA chamada**, porque o módulo
  PowerShell `ScheduledTasks` recarrega dentro de cada processo `powershell.exe` novo (não há
  estado "quente" para esse, ao contrário da consulta de registro). Esse é o custo dominante do
  segundo teste flagged: ~420 ms (installation, já não é mais o primeiro spawn) + ~4.05 s
  (Get-ScheduledTask) ≈ 4.47 s, bate com os 4.565 s medidos.

Esta máquina tem o `seeya` instalado por máquina com autostart registrado (confirmado pela própria
saída da consulta real durante a medição) — exatamente a suspeita do item 1 da tarefa. **O teste lê
estado real da máquina** (registro do Windows via `AppInstallation`, Task Scheduler via
`Autostart`), então esse é o defeito, não o tempo em si (item 2 da tarefa).

**O que mudou:**

1. `packages/app/src/composition/index.ts` — `buildAppContext` ganhou um segundo parâmetro
   opcional, `BuildAppContextOverrides` (`appInstallation?`, `autostart?`), com default `{}` que
   preserva o comportamento real de sempre (`electron/main.ts` não muda nada, continua chamando
   `buildAppContext(homeDir)`).
2. `tests/integration/app/_fake-app-installation.ts` (novo) — `FakeAppInstallation`, duplo nomeado
   implementando a porta `AppInstallation` (AGENTS.md: "duplo de I/O é classe/objeto nomeado
   implementando a porta"). Reaproveitado `FakeAutostart`, que já existia em
   `tests/unit/cli/_autostart-fakes.ts` (mesmo padrão de import cruzado que
   `tests/integration/cli/status-command.test.ts` já usa).
3. `tests/integration/app/composition.test.ts` — todo `buildAppContext(fixture.root)` passou a
   injetar `{ appInstallation: new FakeAppInstallation() }` (e, no teste do
   `checkDaemonOwnershipTransitionOffer`, também `autostart: new FakeAutostart()`), EXCETO o teste
   "daemonOwner is resolved for real, one of the three D-024 states", cujo propósito declarado é
   provar a fiação real — esse continua batendo no adaptador de verdade.
4. Ao concentrar nesse único teste o único acesso real restante do arquivo, ele passou a estourar
   o timeout padrão de 5000 ms **dentro da suíte completa** (`npm run verificar`), por contenção de
   CPU/disco com ~226 arquivos de teste rodando em paralelo — não isolado (medi 5.035-5.037 ms de
   timeout, e com o timeout temporariamente ampliado, durações reais de 5.334/6.144/6.342/5.546 s
   em quatro rodadas). Isso não existia antes porque esse teste nunca tinha sido medido sozinho —
   corria ao lado de outro teste que pagava um custo real maior e mascarava o dele. É custo
   legítimo e inevitável (é exatamente o que esse teste existe para provar), então segui o item 3
   da tarefa: timeout próprio de 15 s nesse teste, comentário cita a medição (~2.4x de folga sobre
   os 6.342 s observados).

**Depois (arquivo sozinho, `--reporter verbose`):**

- `reads config.json for relevanceHours...`: 19-22 ms
- `checkDaemonOwnershipTransitionOffer resolves to a boolean without throwing`: 5-6 ms
- `daemonOwner is resolved for real, one of the three D-024 states`: ~3.0 s isolado, 5.3-6.3 s
  dentro da suíte completa (timeout próprio de 15 s, ver acima)

**`npm run verificar` — três rodadas seguidas, código de saída lido em cada uma, na revisão final:**

- Rodada 1: exit 0 — 226 arquivos, 2335 testes passaram, 4 skipped
- Rodada 2: exit 0 — 226 arquivos, 2335 testes passaram, 4 skipped
- Rodada 3: exit 0 — 226 arquivos, 2335 testes passaram, 4 skipped

(Rodei o portão fresco na máquina um total de 7 vezes durante a tarefa; a 4ª rodada, feita logo
depois do primeiro commit e antes do ajuste de timeout, pegou exatamente o estouro descrito acima
no teste "daemonOwner is resolved for real" — é o que motivou o segundo commit. As três rodadas
finais citadas acima já são com os dois commits aplicados.)

**Sem dependência nova. Nenhuma escrita fora de diretório temporário** — os dois testes que ainda
tocam o SO de verdade (o de instalação e o `AppInstallation.find()`/`Autostart.status()` reais do
teste "for real") são leitura, nunca escrita; `daemon.lock`/autostart real/registro real nunca
foram escritos por esta tarefa.

**Nada para `docs/QUESTOES.md`** — a spec não foi contradita, nenhuma premissa técnica se provou
errada; é a mesma correção que o item 2 da própria tarefa já prescrevia.
<!-- SECTION:NOTES:END -->
