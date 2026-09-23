---
id: TASK-21
title: 'V2-T8 — O instalador: Windows e Linux sem checkout'
status: Review
assignee: []
created_date: '2026-09-22 11:11'
updated_date: '2026-09-23 10:46'
labels: []
milestone: m-3
dependencies: []
references:
  - docs/PLANO-DE-ENTREGA.md
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T8 — O instalador: a interface instalável no Windows e no Linux, sem checkout (D-041,
D-042, D-034).** Especificada pelo PO em 2026-09-17; aprovada e despachada pelo
mantenedor no mesmo dia, com as duas decisões dele respondidas (abaixo: `electron-builder`
aprovado como dependência de desenvolvimento; Ubuntu, logo `.deb` + `AppImage`);
**mesclada na `main` em 2026-09-17** (portão na worktree do PO: 1.851 passando, 4 pulados;
`verificar:linux` verde pelo agente). **Revisão do PO:** um ajuste, já aplicado — o guard
de termos locais reconhecia o falso positivo guardando o endereço de e-mail de terceiro que
o npm copia para o `package-lock.json`; passou a reconhecer a **origem** (o campo
`deprecated` do lockfile), sem o endereço entrar no repositório. Fica em `[~]` até o aceite
do mantenedor: instalar no Ubuntu e no Windows dele, abrir pelo menu, aba de `claude`,
daemon pela janela, clique no aviso prévio. Hoje a interface só
roda de um clone (`npm run app`), e isso já custou duas vezes: o `npm ci` quebrou com a
interface aberta do mesmo checkout (TESTES.md), e o clique no toast não existe no Linux
porque o handler de `seeya://` só vem de um pacote instalado. É também o que deixa o seeya
ser usado todo dia sem o checkout de desenvolvimento embaixo.

**Duas decisões do mantenedor antes do despacho:**
- **Dependência nova (AGENTS.md) — aprovada pelo mantenedor em 2026-09-17:**
  `electron-builder` como `devDependency` de `packages/app`. Recomendação do PO: é o que resolve de uma vez os três pontos que
  dariam trabalho à mão — `asarUnpack` dos nativos do `node-pty` (e do `conpty.dll` da
  V2-T6), o registro do protocolo `seeya://` pelo próprio instalador em cada formato
  (entrada no registro no NSIS, `MimeType=x-scheme-handler/seeya` no `.desktop`,
  `CFBundleURLTypes` no `Info.plist`) e os formatos por SO numa configuração só.
  Alternativa: `electron-forge` (mais peças, mesma dependência nova).
- **Formatos de Linux — respondido pelo mantenedor em 2026-09-17: Ubuntu.** Então `.deb`
  é o formato do dia a dia (registra o protocolo pelo `.desktop` na instalação, que é o que
  o clique no toast precisa) e o `AppImage` entra como segundo artefato, para rodar sem
  instalar; nenhum formato de outra família é construído.

**O que entra:**

1. **Empacotamento** (`npm run dist` na raiz → `electron-builder` para o SO atual):
   Windows **NSIS por usuário** (sem admin, atalho no menu Iniciar, desinstalador); Linux
   `.deb` + `AppImage`; macOS `.dmg` x64 **só construído pela CI**, sem aceite nesta tarefa.
   Dentro do pacote: o bundle da interface (`dist/electron`, com fontes e licença),
   `@seeya-ai/engine` e `@seeya-ai/cli` compilados (o daemon é a CLI), `node-pty` com os
   `.node`, o `conpty.dll`/`OpenConsole.exe` e o `spawn-helper` **fora do asar**
   (`asarUnpack`). **Sem assinatura** (SmartScreen e Gatekeeper vão avisar — custo e
   certificado são decisão futura, registrada na Q-078). Nada do ferramental de dev
   (`dist-tsc`, testes, `esbuild`) vai junto. Medir e registrar o tamanho de cada
   artefato.
2. **O que só valia no dev passa a valer instalado.** A resolução do `bin` da CLI
   (`require.resolve` em `composition/index.ts`), o caminho do preload e do `index.html`
   (`import.meta.url`), e o `ensureElectronBinary`/`ensureSpawnHelperExecutable` do
   `build.mjs` (dev apenas — instalado, o builder já garante) — cada um conferido dentro de
   um pacote instalado de verdade. **O daemon subido pela janela instalada**
   (`ELECTRON_RUN_AS_NODE=1` com o script da CLI): medir se o Node do Electron lê o script
   de dentro do asar; se não ler, a CLI vai para o `asarUnpack` — registrar qual. **Não
   desligar o fuse `RunAsNode`** do Electron (endurecimento que o builder oferece): o
   daemon depende dele; registrar a troca na Q-078.
3. **O `PATH` de quem abre pelo menu.** No Linux e no macOS, um app aberto pelo lançador
   gráfico herda o `PATH` da sessão gráfica, que costuma não ter `~/.local/bin`, o `nvm` ou
   o `npm` global — onde `claude` e `codex` moram; aberto pelo terminal, funciona, e o
   defeito só aparece instalado. Correção conhecida (a mesma do VS Code): ao subir, fora do
   Windows, ler o `PATH` do shell de login da pessoa uma vez (`$SHELL -lic` com um
   marcador para separar a saída do ruído do perfil, prazo curto, e em falha ficar com o
   `PATH` herdado e dizer isso) e usá-lo em `resolve-command.ts` e no ambiente das abas.
   Módulo puro para o parse, com teste; a leitura mora na raiz de composição.
4. **O clique no toast no Linux.** O backend `notify-send` ganha, **só quando o marcador de
   protocolo existe** (V2-T5b), a ação padrão (`--action=default=Open`, que é o clique no
   corpo, não um botão — a D-034 não muda) com `--wait`, num processo destacado e invisível
   (D-038), e ao receber `default` abre `seeya://open` pelo `xdg-open`. Se a versão do
   `notify-send` não aceitar `--action` (anterior à 0.7.10), fica como hoje — medir a
   versão e registrar. macOS fica sem clique nesta tarefa: o `osascript` não entrega clique
   de volta, e a alternativa (`terminal-notifier`) é a que a D-034 recusou.
5. **A CI constrói, a pessoa baixa.** Um workflow com `workflow_dispatch` (manual) constrói
   os três artefatos na matriz de sistemas e os publica como **artefatos do workflow**, não
   como release: a D-041 guarda a publicação para a fronteira da v2. O portão de sempre
   roda antes do empacotamento no mesmo workflow.

**O que não entra:** assinatura e notarização; atualização automática; o `seeya` da CLI no
`PATH` pelo instalador (a CLI continua pelo `npm link` do checkout); o autostart apontando
para o app instalado (continua o que `seeya autostart enable` registrou — decisão para
quando a CLI for instalada junto); clique no toast no macOS; release pública (D-041).

**Cuidados:** instalar e desinstalar não tocam `~/.seeya/` (os dados são da pessoa, não do
app); o app instalado e o checkout de dev não brigam (mesmo `~/.seeya/`, mesmo lock do
daemon — só um daemon, como hoje); nenhum caminho de dev escrito em código de produção;
`process.platform` só na raiz de composição e nos adapters; **um commit por item**, portão
em primeiro plano em pedaços, `verificar:linux` lido em arquivo; **nada de `npm ci` no
checkout principal** (a interface do mantenedor roda de lá). Questão: Q-078.

*Aceite:* o agente constrói o instalador do Windows na máquina dele e **instala de verdade**
num perfil de teste só se for descartável — senão para no artefato construído e medido, e
a instalação fica com o mantenedor; o `.deb`/`AppImage` construídos no contêiner Linux, com
a inspeção do conteúdo (`dpkg -c`: `.desktop` com o `MimeType`, nativos fora do asar);
testes dos módulos novos (parse do `PATH` do shell, a decisão da ação no `notify-send`);
portão e CI verdes; o workflow manual rodado uma vez com os três artefatos. **Aceite do
mantenedor:** no **Linux** (o dia a dia), instalar o pacote, abrir pelo menu, abrir uma aba
de `claude`, subir o daemon pela janela, e clicar num aviso prévio trazendo a janela para
frente; no **Windows**, instalar pelo NSIS, abrir pelo menu Iniciar, e o mesmo clique no
toast.

**Entregue pelo agente em 2026-09-17, worktree isolada (`agent-acce757b5545380ba`), quatro
commits para cinco itens** (itens 1 e 2 num commit só — a Q-078 item 1 explica por quê: a
medição do item 2 decide o próprio `asarUnpack` do item 1, então separar teria significado
commitar uma configuração que a própria tarefa já sabia estar errada), **mais três commits de
documentação e um oitavo commit do ajuste pedido na revisão** (abaixo). Portão local em
pedaços verde antes de cada commit no Windows (`tsc -p tsconfig.json --noEmit`, `npm run
lint`, `npm run build`, `npm run dependencias`, `npm run cobertura -- --maxWorkers 2`, cada
um com o código de saída lido).

1. **Item 3 (PATH do shell de login).** `login-shell-path.ts` (puro) +
   `read-login-shell-path.ts` (a leitura, excluída da cobertura do Windows por ser
   estruturalmente inalcançável fora do POSIX, mesmo padrão de `termination-posix.ts`) +
   `AppContext.loginShellPathSource`. Testado por unidade; a integração real só roda de
   verdade no Linux/macOS da CI.
2. **Item 4 (clique no toast no Linux).** `LinuxNotifySendBackend` ganha `--wait
   --action=default=Open`, atrás do marcador de protocolo (estendido ao Linux por inferência,
   `linux-protocol-marker.ts` — Q-078 item 7) e de uma checagem de versão do `notify-send`
   (medida: 0.8.1 no contêiner, acima do piso de 0.7.10). `backend.ts#spawnDetachedListening`
   é o novo mecanismo de processo destacado e invisível (D-038) que deixa `send()` retornar
   sem esperar o clique.
3. **Itens 1+2 (empacotamento + o que só valia no dev).** `electron-builder.yml` (NSIS
   win-x64; `.deb`+`AppImage` linux-x64; `.dmg` mac-x64 só CI), `scripts/dist.mjs` (força
   `CSC_IDENTITY_AUTO_DISCOVERY=false`), `electron` movido para `devDependencies` (exigência
   medida do `electron-builder`, não um pedido do despacho). **`@seeya-ai/cli` NÃO entrou no
   `asarUnpack`** — medido contra a suposição inicial (Q-078 item 2): o fork do Electron para
   o Node lê e executa de dentro do próprio asar, em qualquer modo de execução, e o daemon
   sempre usa o binário do próprio Electron para se relançar. `node-pty` continua no
   `asarUnpack` (o `.node` genuinamente não pode). Fuse `RunAsNode` confirmado ligado
   (`@electron/fuses`), não só "não mexido".
4. **Item 5 (workflow manual).** `.github/workflows/dist.yml`, `workflow_dispatch`, matriz
   de 3 SOs, portão antes do empacotamento, artefatos da execução (nunca release, D-041) —
   não rodado de verdade (depende de push, que este agente não faz).

**Medido, número por número (Q-078 item 9 tem a lista completa):** Windows NSIS
`seeya-0.1.0-x64.exe` 116.965.798 bytes (~112MB), `NotSigned` confirmado; Linux `.deb`
`seeya-0.1.0-amd64.deb` 102.699.204 bytes (~98MB), inspecionado com `dpkg -x` (`.desktop` com
`MimeType=x-scheme-handler/seeya;`, `pty.node` fora do asar, nada de `@seeya-ai/cli` fora) e
**instalado de verdade com `apt-get install`** dentro de um contêiner Debian descartável, com
`ELECTRON_RUN_AS_NODE=1 ./seeya .../dist/index.js --version`/`sessions` confirmando o daemon
real funcionando a partir do pacote instalado; Linux `AppImage`
`seeya-0.1.0-x86_64.AppImage` 129.815.881 bytes (~124MB), não instalado (o formato não
instala nada). macOS `.dmg` não construído (sem runner macOS nesta máquina, como o próprio
despacho já previa).

**Achado à parte, registrado na Q-078 item 8:** o contêiner de teste (Debian mínimo) não
tinha `libasound2`, que o Electron precisa e a lista de dependências padrão do
`electron-builder`/`fpm` não declara — instalado à mão para o teste seguir. Uma Ubuntu
desktop real quase certamente já tem ALSA, mas isso não foi medido contra uma máquina real, só
registrado como diferença.

**`verificar:linux` rodado de verdade depois dos seis commits**, saída lida em arquivo, nunca
esperando notificação: verde, 180 arquivos de teste, 1.839 testes passando, 5 pulados,
agregado 96,37% statements / 92,85% branches / 95,15% funções / 96,78% linhas — acima do piso
em todo diretório, `tests/integration/app/daemon-launch.test.ts` (o spawn real do daemon)
incluído.

**Ajuste da revisão do PO, oitavo commit:** o primeiro commit havia resolvido o falso
positivo do e-mail de terceiro em `package-lock.json` (item 6) com uma lista de endereços
públicos (`EMAILS_PUBLICOS`) — o PO apontou que isso ainda escrevia o endereço de uma pessoa
real neste repositório, o que a regra de anonimizar contexto de fora (AGENTS.md) já proíbe
mesmo sendo público. Trocado por reconhecimento de ORIGEM
(`ehCampoDeprecatedDoLockfile`/`linhasAdicionadasPorArquivo`, novos em
`scripts/verificar-termos-locais.mjs`): o campo `"deprecated"` de `package-lock.json` é
ignorado por inteiro, nunca um valor específico — o mesmo endereço em qualquer outra linha
ou arquivo continua reprovando. `EMAILS_PUBLICOS` removida (ficou sem uso).
`tests/unit/scripts/verificar-termos-locais.test.ts` (novo, 11 testes) cobre os dois lados;
`scripts/verificar-termos-locais.d.mts` (novo) é só a assinatura de tipos que deixa o teste
importar o `.mjs` sob o programa raiz do TypeScript. Detalhe completo: Q-078 item 10.

**O que fica pendente do mantenedor (Q-078 tem a lista completa):** revisar e mesclar;
decidir sobre o e-mail placeholder (`noreply@seeya.invalid`) no `package.json`; rodar o
workflow manual uma vez; **o aceite real
da tarefa** — instalar de verdade no Linux e no Windows do mantenedor e repetir os passos que
só ele pode confirmar (menu, aba, daemon pela janela, clique no aviso prévio).
<!-- SECTION:DESCRIPTION:END -->
