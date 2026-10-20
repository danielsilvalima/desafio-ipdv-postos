import { AppError } from '../../shared/errors/app-error.js';

export type CodigoErroArquivo =
  | 'ARQUIVO_AUSENTE'
  | 'ARQUIVO_VAZIO'
  | 'ARQUIVO_MUITO_GRANDE'
  | 'ARQUIVO_EXCEL'
  | 'ARQUIVO_NAO_TEXTO'
  | 'CSV_MALFORMADO'
  | 'CABECALHO_COLUNAS_AUSENTES'
  | 'CABECALHO_COLUNAS_REPETIDAS'
  | 'ARQUIVO_SEM_LINHAS';

interface DetalhesErroArquivo {
  dica: string;
  [chave: string]: unknown;
}

const STATUS_POR_CODIGO: Record<CodigoErroArquivo, number> = {
  ARQUIVO_AUSENTE: 400,
  ARQUIVO_VAZIO: 422,
  ARQUIVO_MUITO_GRANDE: 413,
  ARQUIVO_EXCEL: 422,
  ARQUIVO_NAO_TEXTO: 422,
  CSV_MALFORMADO: 422,
  CABECALHO_COLUNAS_AUSENTES: 422,
  CABECALHO_COLUNAS_REPETIDAS: 422,
  ARQUIVO_SEM_LINHAS: 422,
};

/** Erro que impede ler o arquivo inteiro. Nada é gravado e o usuário recebe motivo e dica. */
export class ErroArquivo extends AppError {
  constructor(
    public readonly codigoArquivo: CodigoErroArquivo,
    message: string,
    details: DetalhesErroArquivo,
  ) {
    super(STATUS_POR_CODIGO[codigoArquivo], codigoArquivo, message, details);
    this.name = 'ErroArquivo';
  }

  get detalhes(): DetalhesErroArquivo {
    return this.details as DetalhesErroArquivo;
  }
}
