import { env } from './config/env.js';
import { createApp } from './app.js';
import { pool } from './db/pool.js';

const server = createApp().listen(env.port, () => {
  console.log(`[api] ouvindo em http://localhost:${env.port}`);
});

function shutdown(signal: string) {
  console.log(`[api] ${signal} recebido, encerrando...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
