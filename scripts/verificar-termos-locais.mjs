#!/usr/bin/env node
// Guard de pre-commit: recusa o commit se o conteúdo em stage contiver algum termo listado
// em `.termos-locais`.
//
// Por que existe: parte do contexto que motiva as decisões deste projeto vem de ambientes que
// não são este repositório — nomes de ferramentas de terceiros, caminhos, identificadores. Esse
// material é útil para decidir e não deve ser publicado. Documentar bem e publicar são decisões
// separadas, e é fácil tratar como uma só quando se está escrevendo rápido.
//
// Como usar: crie `.termos-locais` na raiz, um termo por linha. O arquivo é ignorado pelo git —
// os termos nunca saem da máquina. Linhas vazias e começadas com `#` são ignoradas. Se o arquivo
// não existir, este guard não faz nada, então clones de outras pessoas não são afetados.
//
// A comparação é case-insensitive e por substring, de propósito: é melhor barrar um commit
// legítimo de vez em quando do que deixar passar um termo por diferença de caixa.

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizDoRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARQUIVO_DE_TERMOS = path.join(raizDoRepo, '.termos-locais');

/** @returns {string[]} */
function lerTermos() {
  if (!existsSync(ARQUIVO_DE_TERMOS)) {
    return [];
  }
  return readFileSync(ARQUIVO_DE_TERMOS, 'utf8')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0 && !linha.startsWith('#'));
}

/**
 * Conteúdo que está sendo ADICIONADO em stage, mais os nomes dos arquivos (um caminho pode vazar
 * tanto quanto o texto).
 *
 * Só as linhas `+` do diff, nunca as `-`. Ao remover um dado que não deveria estar publicado, o
 * diff necessariamente contém o valor antigo na linha removida — checar o diff inteiro faria o
 * guard impedir a própria limpeza. Isso aconteceu de verdade na primeira versão deste script.
 */
function conteudoEmStage() {
  // `spawnSync` recusa por padrão qualquer saída acima de 1 MB (`ENOBUFS`, `status: null`) — e
  // sem este limite maior, o próprio guard falhava fechado (a intenção correta) diante de um
  // stage legítimo: uma fixture sintética de transcript >1 MB (S1-T4, docs/TESTES.md) já produz,
  // sozinha, um diff de adição maior que 1 MB. 64 MB é folga generosa acima de qualquer fixture
  // prevista neste projeto sem abrir mão do "falha fechada" para um stage realmente descontrolado.
  const maxBuffer = 64 * 1024 * 1024;
  const diff = spawnSync('git', ['diff', '--cached', '--unified=0'], {
    cwd: raizDoRepo,
    encoding: 'utf8',
    shell: false,
    maxBuffer,
  });
  const nomes = spawnSync('git', ['diff', '--cached', '--name-only'], {
    cwd: raizDoRepo,
    encoding: 'utf8',
    shell: false,
    maxBuffer,
  });
  if (diff.status !== 0 || nomes.status !== 0) {
    // Não dá para verificar: falha fechada. Um guard que se rende em silêncio não é guard.
    console.error('Não foi possível ler o conteúdo em stage para verificar os termos locais.');
    process.exitCode = 1;
    return null;
  }
  return { diffStdout: diff.stdout, nomesStdout: nomes.stdout };
}

/**
 * O texto de `.termos-locais` é comparado por substring simples contra tudo que foi adicionado —
 * sem exceção por arquivo ou campo, ao contrário de `acharPadroesSuspeitosPorLinha` abaixo. É a
 * lista de termos que já se sabe terem vazado uma vez; não faz sentido essa lista "esquecer" um
 * deles por causa de onde ele aparece.
 *
 * O sinal de adição inicial é sintaxe de diff, não conteúdo — precisa sair antes de qualquer
 * casamento. Mantê-lo produzia falso positivo real: uma linha adicionada contendo só um import
 * no formato arroba-mais-nome-de-arquivo casava com o padrão de e-mail, porque o sinal de adição
 * é caractere válido em local-part e a extensão parece um TLD. Isso recusou um commit legítimo,
 * e guard que barra o certo é guard que alguém desliga.
 * @param {{ diffStdout: string, nomesStdout: string }} stage
 * @returns {string}
 */
function conteudoParaTermosLocais(stage) {
  const linhasAdicionadas = stage.diffStdout
    .split(/\r?\n/)
    .filter((linha) => linha.startsWith('+') && !linha.startsWith('+++'))
    .map((linha) => linha.slice(1))
    .join('\n');
  return `${linhasAdicionadas}\n${stage.nomesStdout}`;
}

/**
 * Uma linha adicionada, com o arquivo a que pertence — só assim dá para aplicar uma exceção por
 * CAMPO de um arquivo específico (o campo `"deprecated"` de `package-lock.json`, ver
 * `ehCampoDeprecatedDoLockfile`) sem afrouxar a checagem em nenhum outro lugar: mesma linha em
 * outro arquivo, ou outra linha do mesmo arquivo, continuam passando por `acharPadroesSuspeitos`
 * normalmente.
 * @typedef {{ arquivo: string, linha: string }} LinhaAdicionada
 */

/**
 * Percorre o diff unificado (`git diff --unified=0`) mantendo o arquivo atual — atualizado a cada
 * cabeçalho `+++ b/<caminho>` — e devolve só as linhas adicionadas, cada uma já associada ao seu
 * arquivo.
 * @param {string} diffStdout
 * @returns {LinhaAdicionada[]}
 */
export function linhasAdicionadasPorArquivo(diffStdout) {
  /** @type {LinhaAdicionada[]} */
  const linhas = [];
  let arquivoAtual = '';
  for (const linhaBruta of diffStdout.split(/\r?\n/)) {
    if (linhaBruta.startsWith('+++ ')) {
      // "+++ b/caminho/do/arquivo" — "+++ /dev/null" nunca carrega conteúdo adicionado depois.
      const alvo = linhaBruta.slice(4);
      arquivoAtual = alvo.startsWith('b/') ? alvo.slice(2) : alvo;
      continue;
    }
    if (linhaBruta.startsWith('+') && !linhaBruta.startsWith('+++')) {
      linhas.push({ arquivo: arquivoAtual, linha: linhaBruta.slice(1) });
    }
  }
  return linhas;
}

/**
 * Padrões que têm forma de vazamento, independente de qualquer lista. A lista de termos só
 * conhece o que já vazou uma vez; estes padrões pegam o próximo, que ninguém previu.
 *
 * Este projeto é de código aberto: tudo aqui é lido por qualquer pessoa, para sempre. Caminho
 * de home, endereço de e-mail e identificador de sessão real não acrescentam nada a quem lê e
 * não têm como ser retirados depois que saem.
 */
const PADROES_SUSPEITOS = [
  {
    nome: 'caminho de home com usuário real',
    // Aceita placeholder entre <> ou ~, recusa nome de usuário literal.
    regex: /(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\)(?!<)[A-Za-z0-9._%+-]{2,}/g,
  },
  {
    nome: 'endereço de e-mail',
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    nome: 'UUID de aparência real',
    // Um UUID de exemplo deve ser obviamente falso: só dígitos repetidos e letras em sequência.
    // Este padrão casa qualquer UUID e a filtragem de falsos positivos vem depois.
    regex: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
  },
];

/**
 * Domínios que a própria IETF reserva para documentação e teste, e que portanto **não podem** ser
 * endereço de ninguém: RFC 2606 (`example.com`, `example.net`, `example.org`) e RFC 6761 (os
 * sufixos `.test`, `.example`, `.invalid`, `.localhost`).
 *
 * Isto não afrouxa o guard. Ele existe para impedir que endereço real seja publicado, e um
 * endereço nestes domínios é real de ninguém por definição — barrá-lo não protegia nada e cobrava
 * atrito: fixture de git precisa de `user.email`, e sem esta exceção toda tarefa que mexer com
 * repositório de teste esbarra aqui (aconteceu na S2-T1).
 *
 * O que continua barrado é o que sempre esteve: endereço em domínio que existe de verdade.
 */
const DOMINIOS_RESERVADOS = ['example.com', 'example.net', 'example.org'];
const SUFIXOS_RESERVADOS = ['.test', '.example', '.invalid', '.localhost'];

/**
 * @param {string} email
 * @returns {boolean}
 */
function ehDominioReservado(email) {
  const dominio = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return (
    DOMINIOS_RESERVADOS.includes(dominio) ||
    SUFIXOS_RESERVADOS.some((sufixo) => dominio.endsWith(sufixo))
  );
}

/**
 * UUIDs que são constantes públicas conhecidas, não identificadores de ninguém. Cada entrada
 * precisa de um comentário dizendo de onde vem — sem isso, esta lista vira um lugar para
 * silenciar avisos.
 */
const UUIDS_PUBLICOS = new Set([
  // AppUserModelID do PowerShell, usado como remetente de toast no Windows (Spike B).
  '1ac14e77-02e7-4e5d-b744-2eb1ae5198b7',
]);

/**
 * `npm ci`/`npm install` copiam o campo `"deprecated"` da metadata de um pacote no registro do
 * npm para dentro de `package-lock.json`, verbatim — é a mensagem de descontinuação que o próprio
 * mantenedor do pacote escreveu (V2-T8: apareceu com `glob@7.2.3`, dependência transitiva de
 * `electron-builder`, e citava o contato dele). Este projeto não escreve esse texto, não escolhe
 * o que ele diz, e não tem como reescrevê-lo sem parar de refletir o que o `npm` realmente gravou
 * — a exceção é do **campo**, não do endereço específico que apareceu uma vez: revisão do PO
 * (V2-T8) apontou que uma lista de endereços (`EMAILS_PUBLICOS`, removida aqui) ainda escrevia o
 * e-mail de uma pessoa real neste repositório, o que a regra de "anonimizar contexto de fora"
 * (AGENTS.md) já proíbe mesmo quando o endereço é público. Reconhecer a ORIGEM em vez de listar
 * VALORES cobre o próximo pacote descontinuado que citar outro contato, sem precisar prever qual.
 *
 * Só o próprio campo, só em `package-lock.json`: a mesma string aparecendo em qualquer outro
 * campo do lockfile (um "resolved" ou um "integrity" nunca deveria conter um e-mail de verdade) ou
 * em qualquer outro arquivo continua sendo pega — a exceção não é "este endereço nunca importa",
 * é "este CAMPO, desta ORIGEM específica, não é texto deste projeto".
 */
const ARQUIVO_LOCKFILE = 'package-lock.json';
const CAMPO_DEPRECATED_REGEX = /^\s*"deprecated"\s*:\s*".*"\s*,?\s*$/;

/**
 * @param {string} arquivo
 * @param {string} linha
 * @returns {boolean}
 */
export function ehCampoDeprecatedDoLockfile(arquivo, linha) {
  return arquivo === ARQUIVO_LOCKFILE && CAMPO_DEPRECATED_REGEX.test(linha);
}

/**
 * Um UUID de exemplo é aceitável se for obviamente sintético: no máximo 4 símbolos distintos.
 * Ex.: `11111111-1111-4111-8111-111111111111` tem 3 (`1`, `4`, `8`).
 * @param {string} uuid
 * @returns {boolean}
 */
function pareceSintetico(uuid) {
  const distintos = new Set(uuid.toLowerCase().replace(/-/g, ''));
  return distintos.size <= 4;
}

/**
 * @param {string} conteudo
 * @returns {{ nome: string, valor: string }[]}
 */
export function acharPadroesSuspeitos(conteudo) {
  /** @type {{ nome: string, valor: string }[]} */
  const achados = [];
  for (const { nome, regex } of PADROES_SUSPEITOS) {
    for (const ocorrencia of conteudo.matchAll(regex)) {
      const valor = ocorrencia[0];
      if (nome === 'endereço de e-mail' && ehDominioReservado(valor)) {
        continue;
      }
      if (nome === 'UUID de aparência real') {
        if (UUIDS_PUBLICOS.has(valor.toLowerCase()) || pareceSintetico(valor)) {
          continue;
        }
      }
      achados.push({ nome, valor });
    }
  }
  return achados;
}

/**
 * A versão por linha de `acharPadroesSuspeitos` — o ponto em que `ehCampoDeprecatedDoLockfile`
 * entra: uma linha que é o campo `"deprecated"` de `package-lock.json` não passa por checagem
 * NENHUMA (não só a de e-mail) — é texto de origem externa por inteiro, e nenhum dos padrões
 * desta lista tem como distinguir "forma de vazamento" de "citação exata de um terceiro" dentro
 * dele. Qualquer outra linha, mesmo do mesmo arquivo, continua indo para `acharPadroesSuspeitos`
 * normalmente.
 * @param {LinhaAdicionada[]} linhas
 * @returns {{ nome: string, valor: string }[]}
 */
export function acharPadroesSuspeitosPorLinha(linhas) {
  /** @type {{ nome: string, valor: string }[]} */
  const achados = [];
  for (const { arquivo, linha } of linhas) {
    if (ehCampoDeprecatedDoLockfile(arquivo, linha)) {
      continue;
    }
    achados.push(...acharPadroesSuspeitos(linha));
  }
  return achados;
}

/**
 * @param {string} titulo
 * @param {string[]} itens
 * @param {string} orientacao
 */
function reportar(titulo, itens, orientacao) {
  console.error('');
  console.error(`Commit recusado: ${titulo}`);
  console.error('');
  for (const item of itens) {
    console.error(`  - ${item}`);
  }
  console.error('');
  console.error(orientacao);
  console.error('');
}

function main() {
  const stage = conteudoEmStage();
  if (stage === null) {
    return;
  }

  const termos = lerTermos();
  const conteudoMinusculo = conteudoParaTermosLocais(stage).toLowerCase();
  const termosEncontrados = termos.filter((termo) =>
    conteudoMinusculo.includes(termo.toLowerCase()),
  );

  if (termosEncontrados.length > 0) {
    reportar(
      'o conteúdo em stage contém termo listado em .termos-locais.',
      termosEncontrados,
      'Reescreva o trecho de forma genérica antes de commitar. Se o termo é legítimo aqui,\n' +
        'remova-o de .termos-locais — mas remova por decisão, nunca por pressa.',
    );
    process.exitCode = 1;
    return;
  }

  // Linhas de conteúdo passam pela exceção por campo (acharPadroesSuspeitosPorLinha); os nomes
  // dos próprios arquivos em stage não têm campo nenhum para excepcionar, então continuam na
  // checagem simples de sempre.
  const suspeitos = [
    ...acharPadroesSuspeitosPorLinha(linhasAdicionadasPorArquivo(stage.diffStdout)),
    ...acharPadroesSuspeitos(stage.nomesStdout),
  ];
  if (suspeitos.length > 0) {
    reportar(
      'o conteúdo em stage tem forma de dado que não deveria ser publicado.',
      [...new Set(suspeitos.map(({ nome, valor }) => `${nome}: ${valor}`))],
      'Troque por um placeholder — `<usuario>`, `~`, ou um UUID obviamente sintético.\n' +
        'Se for constante pública, acrescente a UUIDS_PUBLICOS neste script, com um comentário\n' +
        'dizendo de onde ela vem.',
    );
    process.exitCode = 1;
  }
}

main();
