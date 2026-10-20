import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { lerPaginacao } from '../../shared/http/paginacao.js';
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
