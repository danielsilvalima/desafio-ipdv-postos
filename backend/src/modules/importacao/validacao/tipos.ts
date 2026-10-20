export type CodigoErro =
  | 'CAMPO_OBRIGATORIO'
  | 'TEXTO_MUITO_LONGO'
  | 'DOCUMENTO_CARACTERES_INVALIDOS'
  | 'DOCUMENTO_QUANTIDADE_DIGITOS'
  | 'DOCUMENTO_ZERADO'
  | 'DOCUMENTO_NOTACAO_CIENTIFICA'
  | 'UF_INVALIDA'
  | 'EMAIL_INVALIDO'
  | 'DATA_FORMATO_INVALIDO'
  | 'DATA_INEXISTENTE'
  | 'DATA_FORA_DO_PERIODO'
  | 'INTEIRO_INVALIDO'
  | 'INTEIRO_NEGATIVO'
  | 'STATUS_INVALIDO'
  | 'LINHA_COLUNAS_A_MAIS';

export type CodigoAviso =
  | 'CNPJ_NOTACAO_CIENTIFICA'
  | 'COMBUSTIVEL_REPETIDO'
  | 'CNPJ_DUPLICADO_NO_ARQUIVO'
  | 'RESPONSAVEL_DIVERGENTE'
  | 'COLUNA_DESCONHECIDA'
  | 'COLUNA_OPCIONAL_AUSENTE';

export type CodigoOcorrencia = CodigoErro | CodigoAviso;

export type Parametros = Record<string, string | number>;

export interface Achado<C extends CodigoOcorrencia = CodigoOcorrencia> {
  codigo: C;
  params?: Parametros;
}

export type ResultadoCampo<T> =
  | { ok: true; valor: T; avisos: Achado<CodigoAviso>[] }
  | { ok: false; erro: Achado<CodigoErro> };

export function sucesso<T>(valor: T, avisos: Achado<CodigoAviso>[] = []): ResultadoCampo<T> {
  return { ok: true, valor, avisos };
}

export function falha<T = never>(codigo: CodigoErro, params?: Parametros): ResultadoCampo<T> {
  return { ok: false, erro: params ? { codigo, params } : { codigo } };
}
