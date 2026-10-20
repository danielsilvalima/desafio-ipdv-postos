import { chaveNormalizada, limparTexto } from './texto.js';
import { falha, sucesso, type Achado, type CodigoAviso, type ResultadoCampo } from './tipos.js';

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type Uf = (typeof UFS)[number];

const UF_POR_NOME: Record<string, Uf> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

export const STATUS_POSTO = ['ativo', 'inativo', 'em_implantacao'] as const;

export type StatusPosto = (typeof STATUS_POSTO)[number];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_TAMANHO_MAXIMO = 254;
export const COMBUSTIVEL_TAMANHO_MAXIMO = 60;

/** Aceita a sigla em qualquer caixa ("sp") e também o nome do estado ("São Paulo"). */
export function normalizarUf(bruto: string): ResultadoCampo<Uf> {
  const sigla = bruto.trim().toUpperCase();
  if ((UFS as readonly string[]).includes(sigla)) {
    return sucesso(sigla as Uf);
  }
  const porNome = UF_POR_NOME[chaveNormalizada(bruto)];
  return porNome ? sucesso(porNome) : falha('UF_INVALIDA');
}

export function normalizarEmail(bruto: string): ResultadoCampo<string> {
  const email = bruto.trim().toLowerCase();
  if (email.length > EMAIL_TAMANHO_MAXIMO || !EMAIL.test(email)) {
    return falha('EMAIL_INVALIDO');
  }
  return sucesso(email);
}

/** "Em implantação", "EM-IMPLANTACAO" e "em_implantacao" viram "em_implantacao". */
export function normalizarStatus(bruto: string): ResultadoCampo<StatusPosto> {
  const chave = chaveNormalizada(bruto).replace(/[\s-]+/g, '_');
  if ((STATUS_POSTO as readonly string[]).includes(chave)) {
    return sucesso(chave as StatusPosto);
  }
  return falha('STATUS_INVALIDO', { permitidos: STATUS_POSTO.join(', ') });
}

/**
 * Separa a lista de combustíveis (vírgula, ponto e vírgula ou barra vertical), limpa espaços
 * e remove repetidos sem diferenciar maiúsculas e acentos, mantendo a ordem original.
 * O nome é mantido como digitado; a associação com o catálogo é feita no banco.
 */
export function separarCombustiveis(bruto: string): ResultadoCampo<string[]> {
  const avisos: Achado<CodigoAviso>[] = [];
  const vistos = new Set<string>();
  const combustiveis: string[] = [];

  for (const parte of bruto.split(/[,;|]/)) {
    const nome = limparTexto(parte);
    if (!nome) continue;

    if (nome.length > COMBUSTIVEL_TAMANHO_MAXIMO) {
      return falha('TEXTO_MUITO_LONGO', { tamanho: nome.length, maximo: COMBUSTIVEL_TAMANHO_MAXIMO, item: nome });
    }

    const chave = chaveNormalizada(nome);
    if (vistos.has(chave)) {
      avisos.push({ codigo: 'COMBUSTIVEL_REPETIDO', params: { nome } });
      continue;
    }
    vistos.add(chave);
    combustiveis.push(nome);
  }

  if (combustiveis.length === 0) {
    return falha('CAMPO_OBRIGATORIO');
  }
  return sucesso(combustiveis, avisos);
}
