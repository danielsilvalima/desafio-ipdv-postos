import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Pool } from 'pg';
import QueryStream from 'pg-query-stream';
import { BOM, linhaCsv } from '../../shared/csv/escritor-csv.js';
import { mascararCep, mascararCnpj, mascararCpf } from '../../shared/formatacao/documentos.js';
import { NOMES_COLUNAS, type NomeColuna } from '../importacao/validacao/colunas.js';

type LinhaExportacao = Record<NomeColuna, string | number | null>;

/** Cada coluna sai com o nome do contrato, para o arquivo voltar ao importador sem ajustes. */
const SQL_EXPORTACAO = `
  SELECT p.cnpj, p.razao_social AS nome_posto, p.nome_fantasia, b.nome AS bandeira,
         p.logradouro, p.numero, p.complemento, p.bairro, p.municipio, p.uf, p.cep,
         r.cpf AS cpf_responsavel, r.nome AS nome_responsavel, r.email AS email_responsavel,
         r.cargo AS cargo_responsavel, comb.nomes AS combustiveis, p.status,
         to_char(p.data_inauguracao, 'DD/MM/YYYY') AS data_inauguracao,
         p.numero_bicos, p.numero_pistas, p.observacoes
    FROM postos p
    JOIN bandeiras b ON b.id = p.bandeira_id
    JOIN responsaveis r ON r.id = p.responsavel_id
    LEFT JOIN LATERAL (
      SELECT string_agg(c.nome, ',' ORDER BY pc.ordem) AS nomes
        FROM posto_combustiveis pc
        JOIN combustiveis c ON c.id = pc.combustivel_id
       WHERE pc.posto_id = p.id
    ) comb ON true
   ORDER BY p.id
`;

/** Lote lido do cursor por vez: a memória fica constante, seja qual for o total de postos. */
const TAMANHO_LOTE = 500;

/**
 * CNPJ, CPF e CEP saem com máscara: o Excel trata como texto e não apaga zeros à esquerda
 * nem converte o CNPJ para notação científica. O importador aceita os dois formatos.
 */
function formatarLinha(linha: LinhaExportacao): (string | number | null)[] {
  return NOMES_COLUNAS.map((coluna) => {
    const valor = linha[coluna];
    if (typeof valor !== 'string') return valor;
    if (coluna === 'cnpj') return mascararCnpj(valor);
    if (coluna === 'cpf_responsavel') return mascararCpf(valor);
    if (coluna === 'cep') return mascararCep(valor);
    return valor;
  });
}

/**
 * Escreve o CSV de todos os postos em `destino`, lendo do banco por cursor.
 * O pipeline respeita o backpressure: se o cliente baixa devagar, a leitura do banco espera.
 * `aoConectar` roda só depois de obter a conexão, para que uma falha de banco ainda vire resposta JSON.
 */
export async function exportarPostosCsv(pool: Pool, destino: Writable, aoConectar?: () => void): Promise<void> {
  const client = await pool.connect();
  let falha: Error | undefined;

  try {
    aoConectar?.();
    const linhas = client.query(new QueryStream(SQL_EXPORTACAO, [], { batchSize: TAMANHO_LOTE }));
    await pipeline(
      linhas,
      async function* (origem: AsyncIterable<LinhaExportacao>) {
        yield BOM + linhaCsv(NOMES_COLUNAS);
        for await (const linha of origem) yield linhaCsv(formatarLinha(linha));
      },
      destino,
    );
  } catch (err) {
    falha = err as Error;
    throw err;
  } finally {
    // Cursor interrompido no meio deixa a conexão num estado incerto: ela é descartada em vez de voltar ao pool.
    client.release(falha);
  }
}
