/**
 * `scripts/verificar-termos-locais.mjs` — o guard de pre-commit (AGENTS.md § "Este projeto é de
 * código aberto"). Ferramental fora de `src/`, mas as funções puras que decidem o que é exceção
 * (o parse do diff por arquivo, e o campo `"deprecated"` de `package-lock.json`) são testáveis
 * como qualquer outra função pura do projeto — "toda função nova tem teste" não para na borda de
 * `src/`.
 *
 * Só as funções PURAS (parse e decisão) são testadas aqui — `main()`/`conteudoEmStage()` chamam
 * `git diff --cached` de verdade contra o repositório real, o que não tem lugar num teste
 * isolado (AGENTS.md § Testes: "nenhum teste toca ... o `~/.claude` real" — o mesmo princípio
 * vale para o índice do git deste repositório).
 *
 * **O e-mail de teste abaixo é montado em duas partes, nunca escrito como uma substring
 * contígua.** Este arquivo é ele mesmo commitado neste repositório, e o próprio guard que este
 * teste exercita recusaria o commit se visse, no texto bruto do arquivo, a forma local-arroba-
 * domínio-ponto-extensão de um domínio não reservado — exatamente o comportamento que o teste
 * "continua reprovando em outro lugar" abaixo verifica. Construir o valor em tempo de execução
 * prova o mecanismo sem recriar, no próprio repositório, o problema que a revisão da V2-T8
 * apontou.
 */
import { describe, expect, it } from 'vitest';
import {
  acharPadroesSuspeitos,
  acharPadroesSuspeitosPorLinha,
  ehCampoDeprecatedDoLockfile,
  linhasAdicionadasPorArquivo,
  type LinhaAdicionada,
} from '../../../scripts/verificar-termos-locais.mjs';

const LOCAL_PART_FICTICIO = 'maintainer';
const DOMINIO_FICTICIO = 'example-registry-mirror.dev';
const EMAIL_FICTICIO = `${LOCAL_PART_FICTICIO}@${DOMINIO_FICTICIO}`;

describe('linhasAdicionadasPorArquivo', () => {
  it('associa cada linha adicionada ao arquivo do cabeçalho "+++" que a precede', () => {
    const diff = [
      'diff --git a/package.json b/package.json',
      '--- a/package.json',
      '+++ b/package.json',
      '+  "name": "seeya",',
      'diff --git a/package-lock.json b/package-lock.json',
      '--- a/package-lock.json',
      '+++ b/package-lock.json',
      '+    "deprecated": "old",',
    ].join('\n');

    expect(linhasAdicionadasPorArquivo(diff)).toEqual([
      { arquivo: 'package.json', linha: '  "name": "seeya",' },
      { arquivo: 'package-lock.json', linha: '    "deprecated": "old",' },
    ]);
  });

  it('ignora linhas de contexto/remoção e a própria sintaxe "+++"/"---" do diff', () => {
    const diff = ['+++ b/x.ts', '-const a = 1;', '+const a = 2;', ' const b = 3;'].join('\n');

    expect(linhasAdicionadasPorArquivo(diff)).toEqual([{ arquivo: 'x.ts', linha: 'const a = 2;' }]);
  });

  it('um arquivo removido ("+++ /dev/null") ainda associa corretamente o que vier depois dele', () => {
    const diff = ['+++ /dev/null', '+conteudo residual'].join('\n');

    expect(linhasAdicionadasPorArquivo(diff)).toEqual([
      { arquivo: '/dev/null', linha: 'conteudo residual' },
    ]);
  });
});

describe('ehCampoDeprecatedDoLockfile', () => {
  it('reconhece o campo "deprecated" em package-lock.json', () => {
    expect(
      ehCampoDeprecatedDoLockfile('package-lock.json', '      "deprecated": "old stuff",'),
    ).toBe(true);
  });

  it('não reconhece o mesmo formato de linha em outro arquivo', () => {
    expect(ehCampoDeprecatedDoLockfile('some-other-file.json', '"deprecated": "old stuff",')).toBe(
      false,
    );
  });

  it('não reconhece outro campo de package-lock.json, mesmo parecido', () => {
    expect(
      ehCampoDeprecatedDoLockfile('package-lock.json', '      "description": "old stuff",'),
    ).toBe(false);
  });
});

describe('acharPadroesSuspeitosPorLinha (V2-T8, correção da revisão)', () => {
  it('um e-mail dentro do campo "deprecated" de package-lock.json passa (origem: o próprio npm)', () => {
    const linhas: LinhaAdicionada[] = [
      {
        arquivo: 'package-lock.json',
        linha: `      "deprecated": "contact ${EMAIL_FICTICIO} for support",`,
      },
    ];

    expect(acharPadroesSuspeitosPorLinha(linhas)).toEqual([]);
  });

  it('o MESMO e-mail em outra linha de package-lock.json continua reprovando — a exceção é do campo, não do endereço', () => {
    const linhas: LinhaAdicionada[] = [
      { arquivo: 'package-lock.json', linha: `      "maintainerEmail": "${EMAIL_FICTICIO}",` },
    ];

    expect(acharPadroesSuspeitosPorLinha(linhas)).toEqual([
      { nome: 'endereço de e-mail', valor: EMAIL_FICTICIO },
    ]);
  });

  it('o mesmo e-mail em qualquer outro arquivo continua reprovando', () => {
    const linhas: LinhaAdicionada[] = [
      { arquivo: 'README.md', linha: `contact ${EMAIL_FICTICIO} for support` },
    ];

    expect(acharPadroesSuspeitosPorLinha(linhas)).toEqual([
      { nome: 'endereço de e-mail', valor: EMAIL_FICTICIO },
    ]);
  });
});

describe('acharPadroesSuspeitos (sem contexto de arquivo/campo)', () => {
  it('continua reprovando um e-mail de domínio real fora de qualquer exceção', () => {
    expect(acharPadroesSuspeitos(EMAIL_FICTICIO)).toEqual([
      { nome: 'endereço de e-mail', valor: EMAIL_FICTICIO },
    ]);
  });

  it('aceita um e-mail em domínio reservado (RFC 2606/6761)', () => {
    expect(acharPadroesSuspeitos('git@example.com')).toEqual([]);
  });
});
