import type { Pool } from 'pg';
import { deslocamento, type Pagina, type Paginacao } from '../../shared/http/paginacao.js';

export interface PostoListagem {
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
  status: string;
  /** AAAA-MM-DD, sem fuso: a data de inauguração não tem hora. */
  dataInauguracao: string | null;
  numeroBicos: number | null;
  numeroPistas: number | null;
  observacoes: string | null;
  responsavel: { cpf: string; nome: string; email: string | null; cargo: string | null };
  combustiveis: string[];
  atualizadoEm: Date;
}

export const ORDENACOES = {
  razaoSocial: 'p.razao_social',
  nomeFantasia: 'p.nome_fantasia',
  cnpj: 'p.cnpj',
  bandeira: 'b.nome',
  municipio: 'p.municipio',
  uf: 'p.uf',
  status: 'p.status',
  atualizadoEm: 'p.updated_at',
} as const;

export type CampoOrdenacao = keyof typeof ORDENACOES;

export interface FiltrosListagem extends Paginacao {
  busca: string | null;
  ordenarPor: CampoOrdenacao;
  ordem: 'asc' | 'desc';
}

function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

const COLUNAS_BUSCA = ['p.razao_social', 'p.nome_fantasia', 'p.municipio', 'b.nome'];
const MAXIMO_PALAVRAS_BUSCA = 6;

/**
 * Cada palavra precisa aparecer em algum campo: "florianopolis repsol" encontra os postos Repsol de Florianópolis.
 * Nomes, município e bandeira são comparados sem acento e sem caixa; palavra numérica também procura no CNPJ.
 */
function montarFiltro(busca: string | null): { where: string; params: string[] } {
  if (!busca) return { where: '', params: [] };

  const params: string[] = [];
  const grupos = busca
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAXIMO_PALAVRAS_BUSCA)
    .map((palavra) => {
      params.push(`%${escaparLike(palavra)}%`);
      const indiceTexto = params.length;
      const condicoes = COLUNAS_BUSCA.map((coluna) => `normalizar_nome(${coluna}) LIKE normalizar_nome($${indiceTexto})`);

      const digitos = palavra.replace(/[.\-/]/g, '');
      if (/^\d+$/.test(digitos)) {
        params.push(`%${digitos}%`);
        condicoes.push(`p.cnpj LIKE $${params.length}`);
      }
      return `(${condicoes.join(' OR ')})`;
    });

  return { where: `WHERE ${grupos.join(' AND ')}`, params };
}

export async function listarPostos(pool: Pool, filtros: FiltrosListagem): Promise<Pagina<PostoListagem>> {
  const { where, params } = montarFiltro(filtros.busca);
  const ordem = filtros.ordem === 'desc' ? 'DESC' : 'ASC';
  const limite = params.length + 1;

  const [itens, total] = await Promise.all([
    pool.query<PostoListagem>(
      `SELECT p.id, p.cnpj, p.razao_social AS "razaoSocial", p.nome_fantasia AS "nomeFantasia", b.nome AS bandeira,
              p.logradouro, p.numero, p.complemento, p.bairro, p.municipio, p.uf, p.cep, p.status,
              to_char(p.data_inauguracao, 'YYYY-MM-DD') AS "dataInauguracao",
              p.numero_bicos AS "numeroBicos", p.numero_pistas AS "numeroPistas", p.observacoes,
              json_build_object('cpf', r.cpf, 'nome', r.nome, 'email', r.email, 'cargo', r.cargo) AS responsavel,
              COALESCE(comb.nomes, '{}') AS combustiveis,
              p.updated_at AS "atualizadoEm"
         FROM postos p
         JOIN bandeiras b ON b.id = p.bandeira_id
         JOIN responsaveis r ON r.id = p.responsavel_id
         LEFT JOIN LATERAL (
           SELECT array_agg(c.nome::text ORDER BY pc.ordem) AS nomes
             FROM posto_combustiveis pc
             JOIN combustiveis c ON c.id = pc.combustivel_id
            WHERE pc.posto_id = p.id
         ) comb ON true
         ${where}
        ORDER BY ${ORDENACOES[filtros.ordenarPor]} ${ordem} NULLS LAST, p.id
        LIMIT $${limite} OFFSET $${limite + 1}`,
      [...params, filtros.porPagina, deslocamento(filtros)],
    ),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM postos p JOIN bandeiras b ON b.id = p.bandeira_id ${where}`,
      params,
    ),
  ]);

  return { itens: itens.rows, total: total.rows[0]!.total, pagina: filtros.pagina, porPagina: filtros.porPagina };
}
