import express from 'express';
import { pool } from './db/pool.js';
import { importacaoRouter } from './modules/importacao/importacao.routes.js';
import { postosRouter } from './modules/postos/postos.routes.js';
import { errorHandler, notFoundHandler } from './shared/errors/error-handler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/importacoes', importacaoRouter);
  app.use('/api/postos', postosRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
