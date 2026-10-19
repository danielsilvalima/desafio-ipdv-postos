import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const DB_DIR = fileURLToPath(new URL('../../db/', import.meta.url));
const MIGRATIONS_DIR = join(DB_DIR, 'migrations');
const SEEDS_DIR = join(DB_DIR, 'seeds');

// Impede que duas execuções simultâneas apliquem as mesmas migrations.
const ADVISORY_LOCK_KEY = 7_274_001;

async function listSqlFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files.filter((file) => file.endsWith('.sql')).sort();
}

export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome        varchar(255) PRIMARY KEY,
        aplicada_em timestamptz  NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ nome: string }>('SELECT nome FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((row) => row.nome));

    for (const file of await listSqlFiles(MIGRATIONS_DIR)) {
      if (alreadyApplied.has(file)) continue;

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falha ao aplicar a migration ${file}: ${(err as Error).message}`, { cause: err });
      }
    }

    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

export async function runSeeds(pool: Pool): Promise<string[]> {
  const files = await listSqlFiles(SEEDS_DIR);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const file of files) {
      await client.query(await readFile(join(SEEDS_DIR, file), 'utf8'));
    }
    await client.query('COMMIT');
    return files;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
