import { env } from '../../src/config/env.js';
import { runSeeds } from '../../src/db/migrator.js';
import { pool } from '../../src/db/pool.js';

/** Trava contra apagar o banco de desenvolvimento por engano. */
export function garantirBancoDeTeste(): void {
  if (!env.databaseUrl.endsWith('_test')) {
    throw new Error(`Os testes de integração só rodam em banco "_test". Recebido: ${env.databaseUrl}`);
  }
}

export async function limparBanco(): Promise<void> {
  await pool.query(
    `TRUNCATE importacao_linhas_rejeitadas, importacoes, posto_combustiveis, postos, responsaveis,
              bandeiras, combustiveis RESTART IDENTITY CASCADE`,
  );
  await runSeeds(pool);
}

export async function contar(tabela: string): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM ${tabela}`);
  return rows[0]!.total;
}
