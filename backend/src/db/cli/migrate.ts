import { pool } from '../pool.js';
import { runMigrations } from '../migrator.js';

try {
  const applied = await runMigrations(pool);
  if (applied.length === 0) {
    console.log('[db] nenhuma migration pendente.');
  } else {
    for (const file of applied) console.log(`[db] aplicada: ${file}`);
  }
} catch (err) {
  console.error('[db] erro ao executar migrations:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
