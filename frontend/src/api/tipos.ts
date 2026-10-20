/** Contratos da API (espelham as respostas do backend). */

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export type StatusPosto = 'ativo' | 'inativo' | 'em_implantacao';

export interface Posto {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  bandeira: string;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  status: StatusPosto;
  /** AAAA-MM-DD */
  dataInauguracao: string | null;
  numeroBicos: number | null;
  numeroPistas: number | null;
  observacoes: string | null;
  responsavel: { cpf: string; nome: string; email: string | null; cargo: string | null };
  combustiveis: string[];
  atualizadoEm: string;
}

export type CampoOrdenacaoPosto =
  | 'razaoSocial'
  | 'nomeFantasia'
  | 'cnpj'
  | 'bandeira'
  | 'municipio'
  | 'uf'
  | 'status'
  | 'atualizadoEm';

export interface FiltrosPostos {
  pagina: number;
  porPagina: number;
  busca?: string;
  ordenarPor?: CampoOrdenacaoPosto;
  ordem?: 'asc' | 'desc';
}

export type StatusImportacao = 'processando' | 'concluida' | 'concluida_com_pendencias' | 'falhou';

export interface Ocorrencia {
  codigo: string;
  tipo: 'erro' | 'aviso';
  campo: string;
  rotulo: string;
  valorRecebido: string | null;
  titulo: string;
  mensagem: string;
  dica?: string;
  linha: number;
}

export interface GrupoOcorrencias {
  codigo: string;
  tipo: 'erro' | 'aviso';
  campo: string;
  rotulo: string;
  titulo: string;
  dica?: string;
  quantidade: number;
  linhas: number[];
}

export interface ErroArquivoRegistrado {
  codigo: string;
  mensagem: string;
  detalhes: DetalhesErroArquivo;
}

export interface DetalhesErroArquivo {
  dica?: string;
  linha?: number;
  colunasAusentes?: string[];
  colunasRepetidas?: string[];
  cabecalhoEsperado?: string[];
  cabecalhoRecebido?: string[];
  limiteMb?: number;
  importacaoId?: number;
}

export interface TotaisImportacao {
  linhas: number;
  inseridos: number;
  atualizados: number;
  rejeitados: number;
  ignorados: number;
  avisos: number;
}

export interface RelatorioImportacao {
  id: number;
  nomeArquivo: string;
  status: StatusImportacao;
  criadaEm: string;
  finalizadaEm: string | null;
  totais: TotaisImportacao;
  novosCadastros: { bandeiras: string[]; combustiveis: string[] };
  erroArquivo: ErroArquivoRegistrado | null;
  gruposErros: GrupoOcorrencias[];
  gruposAvisos: GrupoOcorrencias[];
  erros: Ocorrencia[];
  avisos: Ocorrencia[];
}

export interface ImportacaoResumo {
  id: number;
  nomeArquivo: string;
  status: StatusImportacao;
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  rejeitados: number;
  ignorados: number;
  totalAvisos: number;
  erroArquivo: ErroArquivoRegistrado | null;
  criadaEm: string;
  finalizadaEm: string | null;
}
