---
id: TASK-39
title: V2-T49 — Clique no aviso com notify-send antigo
status: To Do
assignee: []
created_date: '2026-09-24 17:53'
labels: []
milestone: m-2
dependencies: []
references:
  - packages/engine/src/adapters/notification/linux-notify-send.ts
priority: low
type: bug
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**V2-T49 — Clique no aviso do Linux com `notify-send` anterior a 0.7.10.** Achado no aceite da V2-T8
(2026-09-24), no Ubuntu de uso diário do mantenedor.

**O que se mediu lá:**

- `~/.seeya/protocol-handler.json` existe, com `activeScheme: "seeya"`;
- `xdg-mime query default x-scheme-handler/seeya` → `seeya.desktop` (o `.deb` registrou o esquema);
- `xdg-open seeya://open` **traz a janela para frente**;
- `notify-send --version` → **0.7.9**.

O aviso prévio apareceu, e clicar nele não fez nada. Não é defeito da V2-T8: ela só põe ação de
clique a partir da 0.7.10 (`linux-notify-send.ts#versionSupportsActionFlag`), porque `--action` e
`--wait` não existem antes disso, e mandar uma flag desconhecida quebraria o aviso inteiro. O
resultado, porém, é que **na versão do Ubuntu 22.04 o aviso nunca é clicável** — e é a máquina de
todo dia do mantenedor.

**Hipótese a medir antes de construir:** falar com `org.freedesktop.Notifications` diretamente pelo
`gdbus` (vem com o GLib, presente em qualquer GNOME), chamando `Notify` com a ação `default` e
escutando o sinal `ActionInvoked` — o mesmo protocolo que o `notify-send` 0.7.10+ usa por baixo.
Nenhuma dependência nova.

**Medir (spike curto, antes do código):**

1. O `gdbus` existe no Ubuntu 22.04 padrão, e `Notify` + `ActionInvoked` funcionam com ele.
2. **O clique vindo da lista de notificações** (depois de o aviso sumir da tela) chega ao processo
   que está escutando — o mantenedor clicou por lá, e é o uso normal de quem não estava olhando.
3. Quanto tempo o processo de escuta precisa viver, e o que acontece quando a notificação é
   descartada sem clique (o processo tem de terminar, nunca ficar pendurado).

**O que entra, se a medição sustentar:** um caminho de envio para `notify-send` < 0.7.10 pelo
`gdbus`, escolhido pela versão já detectada hoje; o mesmo `xdg-open <esquema ativo>://open` no clique;
processo destacado e invisível como o atual (D-038). Se a medição não sustentar, a tarefa fecha
registrando o limite onde a pessoa vê: o aviso diz que é só informativo nessa versão.

**Aceite do mantenedor:** no Ubuntu 22.04, clicar num aviso prévio — na tela **e** na lista de
notificações — e a janela vir para frente.
<!-- SECTION:DESCRIPTION:END -->
