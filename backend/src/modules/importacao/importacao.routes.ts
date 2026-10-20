import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { pool } from '../../db/pool.js';
import { ErroArquivo } from './erros-arquivo.js';
import { importarCsv } from './importacao.service.js';

const TAMANHO_MAXIMO_MB = 20;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO_MB * 1024 * 1024, files: 1 },
}).single('arquivo');

/** Converte os erros do multer em mensagens que o usuário entende. */
const receberArquivo: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new ErroArquivo('ARQUIVO_MUITO_GRANDE', `O arquivo passa do limite de ${TAMANHO_MAXIMO_MB} MB.`, {
          dica: 'Divida a planilha em arquivos menores e importe um de cada vez.',
          limiteMb: TAMANHO_MAXIMO_MB,
        }),
      );
    }
    if (err instanceof multer.MulterError) {
      return next(
        new ErroArquivo('ARQUIVO_AUSENTE', 'Envie um único arquivo CSV no campo "arquivo".', {
          dica: 'Selecione o arquivo .csv da planilha de postos e envie novamente.',
        }),
      );
    }
    next(err);
  });
};

/** O multer entrega o nome original em latin1; acentos do nome do arquivo precisam da conversão. */
function nomeOriginal(arquivo: Express.Multer.File): string {
  return Buffer.from(arquivo.originalname, 'latin1').toString('utf8');
}

export const importacaoRouter = Router();

importacaoRouter.post('/', receberArquivo, async (req, res) => {
  if (!req.file) {
    throw new ErroArquivo('ARQUIVO_AUSENTE', 'Nenhum arquivo foi enviado.', {
      dica: 'Selecione o arquivo .csv da planilha de postos e envie novamente.',
    });
  }

  const relatorio = await importarCsv(pool, { nome: nomeOriginal(req.file), conteudo: req.file.buffer });
  res.status(201).json(relatorio);
});
