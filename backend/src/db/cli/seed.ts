import { pool } from '../pool.js';
import { runSeeds } from '../migrator.js';

try {
  const files = await runSeeds(pool);
  for (const file of files) console.log(`[db] seed executado: ${file}`);
} catch (err) {
  console.error('[db] erro ao executar seeds:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
