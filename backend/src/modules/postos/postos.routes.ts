import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { lerPaginacao } from '../../shared/http/paginacao.js';
import { exportarPostosCsv } from './exportacao.js';
import { listarPostos, ORDENACOES, type CampoOrdenacao } from './postos.repository.js';

const TAMANHO_MAXIMO_BUSCA = 100;

function textoDaQuery(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim().slice(0, TAMANHO_MAXIMO_BUSCA);
  return texto === '' ? null : texto;
}

function campoOrdenacao(valor: unknown): CampoOrdenacao {
  return typeof valor === 'string' && Object.hasOwn(ORDENACOES, valor) ? (valor as CampoOrdenacao) : 'razaoSocial';
}

export const postosRouter = Router();

postosRouter.get('/', async (req, res) => {
  res.json(
    await listarPostos(pool, {
      ...lerPaginacao(req.query),
      busca: textoDaQuery(req.query.busca),
      ordenarPor: campoOrdenacao(req.query.ordenarPor),
      ordem: req.query.ordem === 'desc' ? 'desc' : 'asc',
    }),
  );
});

postosRouter.get('/export.csv', async (_req, res) => {
  const nomeArquivo = `postos-${new Date().toISOString().slice(0, 10)}.csv`;

  try {
    await exportarPostosCsv(pool, res, () => {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    });
  } catch (err) {
    // Falha ao conectar acontece antes do pipeline: a resposta está intacta e vira JSON pelo handler central.
    if (!res.headersSent && !res.destroyed) throw err;
    // Com o download em andamento só resta interrompê-lo. Cliente que cancelou não é erro do servidor.
    if ((err as { code?: string }).code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error('[export] falha durante a exportação:', err);
    }
    res.destroy();
  }
});
