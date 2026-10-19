import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] erro inesperado em conexão ociosa:', err.message);
});
