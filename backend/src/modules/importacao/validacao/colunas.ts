export interface DefinicaoColuna {
  nome: string;
  rotulo: string;
  obrigatoria: boolean;
  tamanhoMaximo?: number;
  exemplo: string;
}

/** Contrato do CSV: mesmas colunas e mesma ordem do arquivo modelo do desafio. */
export const COLUNAS_CSV = [
  { nome: 'cnpj', rotulo: 'CNPJ', obrigatoria: true, exemplo: '01234567000189' },
  { nome: 'nome_posto', rotulo: 'Razão social', obrigatoria: true, tamanhoMaximo: 200, exemplo: 'Posto Exemplo Comércio de Combustíveis Ltda' },
  { nome: 'nome_fantasia', rotulo: 'Nome fantasia', obrigatoria: false, tamanhoMaximo: 200, exemplo: 'Posto Exemplo' },
  { nome: 'bandeira', rotulo: 'Bandeira', obrigatoria: true, tamanhoMaximo: 100, exemplo: 'Ipiranga' },
  { nome: 'logradouro', rotulo: 'Logradouro', obrigatoria: true, tamanhoMaximo: 200, exemplo: 'Avenida Paulista' },
  { nome: 'numero', rotulo: 'Número', obrigatoria: false, tamanhoMaximo: 20, exemplo: '1000' },
  { nome: 'complemento', rotulo: 'Complemento', obrigatoria: false, tamanhoMaximo: 100, exemplo: 'Loja A' },
  { nome: 'bairro', rotulo: 'Bairro', obrigatoria: true, tamanhoMaximo: 100, exemplo: 'Bela Vista' },
  { nome: 'municipio', rotulo: 'Município', obrigatoria: true, tamanhoMaximo: 100, exemplo: 'São Paulo' },
  { nome: 'uf', rotulo: 'UF', obrigatoria: true, exemplo: 'SP' },
  { nome: 'cep', rotulo: 'CEP', obrigatoria: true, exemplo: '01310100' },
  { nome: 'cpf_responsavel', rotulo: 'CPF do responsável', obrigatoria: true, exemplo: '01234567890' },
  { nome: 'nome_responsavel', rotulo: 'Nome do responsável', obrigatoria: true, tamanhoMaximo: 150, exemplo: 'Maria Silva' },
  { nome: 'email_responsavel', rotulo: 'E-mail do responsável', obrigatoria: false, exemplo: 'maria.silva@empresa.com.br' },
  { nome: 'cargo_responsavel', rotulo: 'Cargo do responsável', obrigatoria: false, tamanhoMaximo: 100, exemplo: 'Gerente de Posto' },
  { nome: 'combustiveis', rotulo: 'Combustíveis', obrigatoria: true, exemplo: 'Gasolina Comum, Etanol, Diesel S10' },
  { nome: 'status', rotulo: 'Status', obrigatoria: true, exemplo: 'ativo' },
  { nome: 'data_inauguracao', rotulo: 'Data de inauguração', obrigatoria: false, exemplo: '25/03/2015' },
  { nome: 'numero_bicos', rotulo: 'Número de bicos', obrigatoria: false, exemplo: '8' },
  { nome: 'numero_pistas', rotulo: 'Número de pistas', obrigatoria: false, exemplo: '4' },
  { nome: 'observacoes', rotulo: 'Observações', obrigatoria: false, exemplo: 'Atende frota corporativa.' },
] as const satisfies readonly DefinicaoColuna[];

export type NomeColuna = (typeof COLUNAS_CSV)[number]['nome'];

export const NOMES_COLUNAS: readonly NomeColuna[] = COLUNAS_CSV.map((coluna) => coluna.nome);

const COLUNA_POR_NOME = new Map<string, DefinicaoColuna>(COLUNAS_CSV.map((coluna) => [coluna.nome, coluna]));

export function buscarColuna(nome: string): DefinicaoColuna | undefined {
  return COLUNA_POR_NOME.get(nome);
}
