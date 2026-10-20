import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { montarCsv } from '../../src/shared/csv/escritor-csv.js';
import { NOMES_COLUNAS, type NomeColuna } from '../../src/modules/importacao/validacao/colunas.js';

export type LinhaTeste = Partial<Record<NomeColuna, string>>;

export const ARQUIVO_EXEMPLO = readFileSync(
  fileURLToPath(new URL('../../../samples/modelo-importacao-desafio.csv', import.meta.url)),
);

export function linhaValida(sobrescrever: LinhaTeste = {}): LinhaTeste {
  return {
    cnpj: '01.234.567/0001-89',
    nome_posto: 'Posto Exemplo Comércio de Combustíveis Ltda',
    nome_fantasia: 'Posto Exemplo',
    bandeira: 'Ipiranga',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    complemento: '',
    bairro: 'Bela Vista',
    municipio: 'São Paulo',
    uf: 'SP',
    cep: '01310-100',
    cpf_responsavel: '012.345.678-90',
    nome_responsavel: 'Maria Silva',
    email_responsavel: 'maria@empresa.com.br',
    cargo_responsavel: 'Gerente de Posto',
    combustiveis: 'Gasolina Comum, Etanol',
    status: 'ativo',
    data_inauguracao: '25/03/2015',
    numero_bicos: '8',
    numero_pistas: '4',
    observacoes: '',
    ...sobrescrever,
  };
}

/** CSV no formato do contrato, a partir de linhas parciais (colunas não informadas ficam vazias). */
export function csvDe(linhas: LinhaTeste[], colunas: readonly string[] = NOMES_COLUNAS): Buffer {
  return Buffer.from(
    montarCsv(
      colunas,
      linhas.map((linha) => colunas.map((coluna) => linha[coluna as NomeColuna] ?? '')),
    ),
    'utf8',
  );
}
