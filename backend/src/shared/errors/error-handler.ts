import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './app-error.js';

const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  '08001',
  '08006',
  '57P01',
  '57P02',
  '57P03',
]);

function isDatabaseUnavailable(err: unknown): boolean {
  const { code, message } = err as { code?: string; message?: string };
  if (code && DB_UNAVAILABLE_CODES.has(code)) return true;
  return /Connection terminated|timeout exceeded when trying to connect/i.test(message ?? '');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROTA_NAO_ENCONTRADA', `Rota não encontrada: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  if (isDatabaseUnavailable(err)) {
    res.status(503).json({
      error: {
        code: 'BANCO_INDISPONIVEL',
        message: 'Não foi possível conectar ao banco de dados. Verifique se o PostgreSQL está em execução.',
      },
    });
    return;
  }

  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'JSON_INVALIDO', message: 'O corpo da requisição não é um JSON válido.' } });
    return;
  }

  console.error('[api] erro não tratado:', err);
  res.status(500).json({
    error: { code: 'ERRO_INTERNO', message: 'Ocorreu um erro inesperado. Tente novamente em instantes.' },
  });
};
