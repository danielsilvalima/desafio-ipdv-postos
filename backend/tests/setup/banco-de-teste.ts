import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { runMigrations, runSeeds } from '../../src/db/migrator.js';
import { TEST_DATABASE_URL } from './config.js';

declare module 'vitest' {
  export interface ProvidedContext {
    bancoDisponivel: boolean;
  }
}

/** Cria o banco de teste se preciso e aplica migrations e seed. Sem PostgreSQL, os testes de integração são pulados. */
export default async function setup(project: TestProject) {
  const url = new URL(TEST_DATABASE_URL);
  const nomeBanco = url.pathname.slice(1);
  const urlAdmin = new URL(TEST_DATABASE_URL);
  urlAdmin.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: urlAdmin.toString(), connectionTimeoutMillis: 3000 });
  try {
    await admin.connect();
  } catch (err) {
    console.warn(`[testes] PostgreSQL indisponível (${(err as Error).message}). Testes de integração serão pulados.`);
    project.provide('bancoDisponivel', false);
    return;
  }

  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${nomeBanco.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await runMigrations(pool);
    await runSeeds(pool);
  } finally {
    await pool.end();
  }
  project.provide('bancoDisponivel', true);
}
