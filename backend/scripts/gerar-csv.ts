/**
 * Gera um CSV grande de postos fictícios para testar importação e exportação em volume.
 *
 *   npm run gerar:csv                         -> 10.000 linhas válidas
 *   npm run gerar:csv -- 50000                -> 50.000 linhas
 *   npm run gerar:csv -- 10000 --com-erros    -> ~3% das linhas com erros propositais
 *   npm run gerar:csv -- 10000 --saida C:\temp\postos.csv
 */
import { createWriteStream, mkdirSync } from 'node:fs';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOM, linhaCsv } from '../src/shared/csv/escritor-csv.js';
import { NOMES_COLUNAS } from '../src/modules/importacao/validacao/colunas.js';
import { gerarPostos, valoresNaOrdem } from './gerador-postos.js';

const FRACAO_COM_ERRO = 0.03;
const PASTA_PADRAO = fileURLToPath(new URL('../../samples/gerados/', import.meta.url));

function lerArgumentos(argv: string[]) {
  const quantidade = Number(argv.find((arg) => /^\d+$/.test(arg)) ?? 10_000);
  const comErros = argv.includes('--com-erros');
  const indiceSaida = argv.indexOf('--saida');
  const saida =
    indiceSaida >= 0 && argv[indiceSaida + 1]
      ? resolve(argv[indiceSaida + 1]!)
      : resolve(PASTA_PADRAO, `postos-${quantidade}${comErros ? '-com-erros' : ''}.csv`);
  return { quantidade, comErros, saida };
}

async function main() {
  const { quantidade, comErros, saida } = lerArgumentos(process.argv.slice(2));
  if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
    throw new Error('Informe a quantidade de linhas como um número inteiro positivo.');
  }

  mkdirSync(dirname(saida), { recursive: true });
  const arquivo = createWriteStream(saida, { encoding: 'utf8' });
  const inicio = performance.now();

  arquivo.write(BOM + linhaCsv(NOMES_COLUNAS));
  for (const linha of gerarPostos(quantidade, { fracaoComErro: comErros ? FRACAO_COM_ERRO : 0 })) {
    if (!arquivo.write(linhaCsv(valoresNaOrdem(linha)))) await once(arquivo, 'drain');
  }
  arquivo.end();
  await once(arquivo, 'finish');

  const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
  console.log(`[gerar-csv] ${quantidade} linhas gravadas em ${saida} (${segundos}s).`);
}

main().catch((err: Error) => {
  console.error(`[gerar-csv] ${err.message}`);
  process.exit(1);
});
