export const MAIOR_INTEIRO_PG = 2_147_483_647;
const POR_PAGINA_PADRAO = 20;
const POR_PAGINA_MAXIMO = 100;

export interface Paginacao {
  pagina: number;
  porPagina: number;
}

export interface Pagina<T> extends Paginacao {
  itens: T[];
  total: number;
}

function inteiroPositivo(valor: unknown, padrao: number, maximo = MAIOR_INTEIRO_PG): number {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(numero) || numero < 1) return padrao;
  return Math.min(numero, maximo);
}

/** Valores ausentes ou inválidos caem no padrão, para a tela nunca quebrar por causa da URL. */
export function lerPaginacao(query: Record<string, unknown>): Paginacao {
  return {
    pagina: inteiroPositivo(query.pagina, 1),
    porPagina: inteiroPositivo(query.porPagina, POR_PAGINA_PADRAO, POR_PAGINA_MAXIMO),
  };
}

export function deslocamento({ pagina, porPagina }: Paginacao): number {
  return (pagina - 1) * porPagina;
}
