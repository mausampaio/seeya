// Declaração de tipos para `verificar-termos-locais.mjs`, só para o consumo de fora de `scripts/`
// (o teste em `tests/unit/scripts/verificar-termos-locais.test.ts`). O programa raiz
// (`tsconfig.json`) não liga `allowJs` de propósito (ver `scripts/tsconfig.json`'s own comment) —
// sem este arquivo, `tsc -p tsconfig.json --noEmit` não conseguiria resolver o `.mjs` importado
// pelo teste. `scripts/tsconfig.json` (allowJs+checkJs) continua sendo quem tipa o `.mjs` em si;
// este arquivo nunca é a fonte da verdade sobre o comportamento, só a assinatura pública que o
// teste precisa enxergar.

export interface LinhaAdicionada {
  readonly arquivo: string;
  readonly linha: string;
}

export interface PadraoSuspeitoEncontrado {
  readonly nome: string;
  readonly valor: string;
}

export function linhasAdicionadasPorArquivo(diffStdout: string): LinhaAdicionada[];
export function ehCampoDeprecatedDoLockfile(arquivo: string, linha: string): boolean;
export function acharPadroesSuspeitos(conteudo: string): PadraoSuspeitoEncontrado[];
export function acharPadroesSuspeitosPorLinha(
  linhas: readonly LinhaAdicionada[],
): PadraoSuspeitoEncontrado[];
