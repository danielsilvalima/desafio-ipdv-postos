import type { Pool, PoolClient } from 'pg';
import type { Ocorrencia } from './validacao/mensagens.js';
import type { PostoNormalizado } from './validacao/validar-linha.js';
import type { LinhaRejeitada, OcorrenciaNaLinha, ValoresOriginais } from './preparar-importacao.js';

type Executor = Pool | PoolClient;

export type StatusImportacao = 'processando' | 'concluida' | 'concluida_com_pendencias' | 'falhou';

export interface NovosCadastros {
  bandeiras: string[];
  combustiveis: string[];
}

export interface ErroArquivoRegistrado {
  codigo: string;
  mensagem: string;
  detalhes: Record<string, unknown>;
}

export interface ImportacaoRegistro {
  id: number;
  nomeArquivo: string;
  status: StatusImportacao;
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  rejeitados: number;
  ignorados: number;
  totalAvisos: number;
  avisos: OcorrenciaNaLinha[];
  novosCadastros: NovosCadastros;
  erroArquivo: ErroArquivoRegistrado | null;
  criadaEm: Date;
  finalizadaEm: Date | null;
}

export interface LinhaRejeitadaRegistro {
  linha: number;
  valoresOriginais: ValoresOriginais;
  erros: Ocorrencia[];
}

export interface ResultadoUpsertPostos {
  inseridos: number;
  atualizados: number;
}

/** Limita o tamanho de cada INSERT ... unnest para não montar arrays gigantes numa só consulta. */
const TAMANHO_LOTE = 1000;

const COLUNAS_RESUMO = `
  id, nome_arquivo AS "nomeArquivo", status, total_linhas AS "totalLinhas", inseridos, atualizados,
  rejeitados, ignorados, total_avisos AS "totalAvisos", novos_cadastros AS "novosCadastros",
  erro_arquivo AS "erroArquivo", criada_em AS "criadaEm", finalizada_em AS "finalizadaEm"
`;
const COLUNAS_IMPORTACAO = `${COLUNAS_RESUMO}, avisos`;

function emLotes<T>(itens: T[]): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += TAMANHO_LOTE) lotes.push(itens.slice(i, i + TAMANHO_LOTE));
  return lotes;
}

export async function inserirImportacao(
  db: Executor,
  nomeArquivo: string,
  cabecalho: string[] | null,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO importacoes (nome_arquivo, status, header_original)
     VALUES ($1, 'processando', $2) RETURNING id`,
    [nomeArquivo, cabecalho ? JSON.stringify(cabecalho) : null],
  );
  return rows[0]!.id;
}

export async function registrarFalha(
  db: Executor,
  dados: { nomeArquivo: string; cabecalho: string[] | null; erro: ErroArquivoRegistrado; importacaoId?: number },
): Promise<number> {
  if (dados.importacaoId) {
    await db.query(
      `UPDATE importacoes SET status = 'falhou', erro_arquivo = $2, finalizada_em = now() WHERE id = $1`,
      [dados.importacaoId, JSON.stringify(dados.erro)],
    );
    return dados.importacaoId;
  }
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO importacoes (nome_arquivo, status, header_original, erro_arquivo, finalizada_em)
     VALUES ($1, 'falhou', $2, $3, now()) RETURNING id`,
    [dados.nomeArquivo, dados.cabecalho ? JSON.stringify(dados.cabecalho) : null, JSON.stringify(dados.erro)],
  );
  return rows[0]!.id;
}

/**
 * Garante que cada nome exista no catálogo, comparando sem acento, caixa ou espaços extras.
 * Devolve o id de cada nome recebido e os nomes que precisaram ser criados.
 */
async function garantirCatalogo(
  db: Executor,
  tabela: 'bandeiras' | 'combustiveis',
  nomes: string[],
): Promise<{ idPorNome: Map<string, number>; criados: string[] }> {
  const distintos = [...new Set(nomes)];
  if (distintos.length === 0) return { idPorNome: new Map(), criados: [] };

  const inseridos = await db.query<{ nome: string }>(
    `INSERT INTO ${tabela} (nome)
     SELECT nome FROM unnest($1::text[]) WITH ORDINALITY AS entrada(nome, ordem) ORDER BY ordem
     ON CONFLICT DO NOTHING
     RETURNING nome`,
    [distintos],
  );
  const { rows } = await db.query<{ entrada: string; id: number }>(
    `SELECT entrada.nome AS entrada, catalogo.id
       FROM unnest($1::text[]) AS entrada(nome)
       JOIN ${tabela} catalogo ON normalizar_nome(catalogo.nome) = normalizar_nome(entrada.nome)`,
    [distintos],
  );

  return {
    idPorNome: new Map(rows.map((row) => [row.entrada, row.id])),
    criados: inseridos.rows.map((row) => row.nome),
  };
}

export function garantirBandeiras(db: Executor, nomes: string[]) {
  return garantirCatalogo(db, 'bandeiras', nomes);
}

export function garantirCombustiveis(db: Executor, nomes: string[]) {
  return garantirCatalogo(db, 'combustiveis', nomes);
}

/** Espera um responsável por CPF; a escolha entre dados divergentes já foi feita na preparação. */
export async function upsertResponsaveis(
  db: Executor,
  responsaveis: PostoNormalizado['responsavel'][],
): Promise<Map<string, number>> {
  const idPorCpf = new Map<string, number>();
  for (const lote of emLotes(responsaveis)) {
    const { rows } = await db.query<{ id: number; cpf: string }>(
      `INSERT INTO responsaveis (cpf, nome, email, cargo)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
       ON CONFLICT (cpf) DO UPDATE
         SET nome = EXCLUDED.nome, email = EXCLUDED.email, cargo = EXCLUDED.cargo
       RETURNING id, cpf`,
      [lote.map((r) => r.cpf), lote.map((r) => r.nome), lote.map((r) => r.email), lote.map((r) => r.cargo)],
    );
    for (const row of rows) idPorCpf.set(row.cpf, row.id);
  }
  return idPorCpf;
}

export interface PostoParaGravar {
  posto: PostoNormalizado;
  bandeiraId: number;
  responsavelId: number;
  combustivelIds: number[];
}

/**
 * Deixa a lista de combustíveis de cada posto igual à do arquivo gravando só a diferença.
 * Apagar e inserir tudo de novo custaria uma checagem de chave estrangeira por vínculo a cada reimportação.
 * Concorrência: o upsert dos postos já travou essas linhas, então outra importação do mesmo posto espera.
 */
async function sincronizarCombustiveis(
  db: Executor,
  todosPostoIds: number[],
  postoIds: number[],
  combustivelIds: number[],
  ordens: number[],
): Promise<void> {
  await db.query(
    `DELETE FROM posto_combustiveis atual
      WHERE atual.posto_id = ANY($1::int[])
        AND NOT EXISTS (
          SELECT 1 FROM unnest($2::int[], $3::int[]) AS novo(posto_id, combustivel_id)
           WHERE novo.posto_id = atual.posto_id AND novo.combustivel_id = atual.combustivel_id
        )`,
    [todosPostoIds, postoIds, combustivelIds],
  );
  await db.query(
    `UPDATE posto_combustiveis atual SET ordem = novo.ordem
       FROM unnest($1::int[], $2::int[], $3::smallint[]) AS novo(posto_id, combustivel_id, ordem)
      WHERE novo.posto_id = atual.posto_id AND novo.combustivel_id = atual.combustivel_id
        AND atual.ordem <> novo.ordem`,
    [postoIds, combustivelIds, ordens],
  );
  await db.query(
    `INSERT INTO posto_combustiveis (posto_id, combustivel_id, ordem)
     SELECT novo.posto_id, novo.combustivel_id, novo.ordem
       FROM unnest($1::int[], $2::int[], $3::smallint[]) AS novo(posto_id, combustivel_id, ordem)
      WHERE NOT EXISTS (
        SELECT 1 FROM posto_combustiveis atual
         WHERE atual.posto_id = novo.posto_id AND atual.combustivel_id = novo.combustivel_id
      )`,
    [postoIds, combustivelIds, ordens],
  );
}

/** Insere ou atualiza pelo CNPJ e sincroniza a lista de combustíveis, preservando a ordem do arquivo. */
export async function upsertPostos(db: Executor, itens: PostoParaGravar[]): Promise<ResultadoUpsertPostos> {
  let inseridos = 0;
  let atualizados = 0;
  const idPorCnpj = new Map<string, number>();

  for (const lote of emLotes(itens)) {
    const coluna = <T>(f: (item: PostoParaGravar) => T) => lote.map(f);
    const { rows } = await db.query<{ id: number; cnpj: string; inserido: boolean }>(
      `INSERT INTO postos (
         cnpj, razao_social, nome_fantasia, bandeira_id, responsavel_id, logradouro, numero, complemento,
         bairro, municipio, uf, cep, status, data_inauguracao, numero_bicos, numero_pistas, observacoes
       )
       SELECT * FROM unnest(
         $1::text[], $2::text[], $3::text[], $4::int[], $5::int[], $6::text[], $7::text[], $8::text[],
         $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::date[], $15::int[], $16::int[], $17::text[]
       )
       ON CONFLICT (cnpj) DO UPDATE SET
         razao_social = EXCLUDED.razao_social, nome_fantasia = EXCLUDED.nome_fantasia,
         bandeira_id = EXCLUDED.bandeira_id, responsavel_id = EXCLUDED.responsavel_id,
         logradouro = EXCLUDED.logradouro, numero = EXCLUDED.numero, complemento = EXCLUDED.complemento,
         bairro = EXCLUDED.bairro, municipio = EXCLUDED.municipio, uf = EXCLUDED.uf, cep = EXCLUDED.cep,
         status = EXCLUDED.status, data_inauguracao = EXCLUDED.data_inauguracao,
         numero_bicos = EXCLUDED.numero_bicos, numero_pistas = EXCLUDED.numero_pistas,
         observacoes = EXCLUDED.observacoes
       RETURNING id, cnpj, (xmax = 0) AS inserido`,
      [
        coluna((i) => i.posto.cnpj),
        coluna((i) => i.posto.razaoSocial),
        coluna((i) => i.posto.nomeFantasia),
        coluna((i) => i.bandeiraId),
        coluna((i) => i.responsavelId),
        coluna((i) => i.posto.logradouro),
        coluna((i) => i.posto.numero),
        coluna((i) => i.posto.complemento),
        coluna((i) => i.posto.bairro),
        coluna((i) => i.posto.municipio),
        coluna((i) => i.posto.uf),
        coluna((i) => i.posto.cep),
        coluna((i) => i.posto.status),
        coluna((i) => i.posto.dataInauguracao),
        coluna((i) => i.posto.numeroBicos),
        coluna((i) => i.posto.numeroPistas),
        coluna((i) => i.posto.observacoes),
      ],
    );

    for (const row of rows) {
      idPorCnpj.set(row.cnpj, row.id);
      if (row.inserido) inseridos += 1;
      else atualizados += 1;
    }
  }

  // Uma única sincronização para o arquivo inteiro: cada consulta percorre a tabela de vínculos uma vez só,
  // em vez de uma vez por lote.
  const postoIds: number[] = [];
  const combustivelIds: number[] = [];
  const ordens: number[] = [];
  for (const item of itens) {
    const postoId = idPorCnpj.get(item.posto.cnpj)!;
    item.combustivelIds.forEach((combustivelId, indice) => {
      postoIds.push(postoId);
      combustivelIds.push(combustivelId);
      ordens.push(indice + 1);
    });
  }
  await sincronizarCombustiveis(db, [...idPorCnpj.values()], postoIds, combustivelIds, ordens);

  return { inseridos, atualizados };
}

export async function inserirLinhasRejeitadas(
  db: Executor,
  importacaoId: number,
  linhas: LinhaRejeitada[],
): Promise<void> {
  for (const lote of emLotes(linhas)) {
    await db.query(
      `INSERT INTO importacao_linhas_rejeitadas (importacao_id, linha, valores_originais, erros)
       SELECT $1, * FROM unnest($2::int[], $3::jsonb[], $4::jsonb[])`,
      [
        importacaoId,
        lote.map((l) => l.linha),
        lote.map((l) => JSON.stringify(l.valoresOriginais)),
        lote.map((l) => JSON.stringify(l.erros)),
      ],
    );
  }
}

export async function finalizarImportacao(
  db: Executor,
  importacaoId: number,
  dados: {
    status: StatusImportacao;
    totalLinhas: number;
    inseridos: number;
    atualizados: number;
    rejeitados: number;
    ignorados: number;
    avisos: OcorrenciaNaLinha[];
    novosCadastros: NovosCadastros;
  },
): Promise<void> {
  await db.query(
    `UPDATE importacoes SET
       status = $2, total_linhas = $3, inseridos = $4, atualizados = $5, rejeitados = $6, ignorados = $7,
       total_avisos = $8, avisos = $9, novos_cadastros = $10, finalizada_em = now()
     WHERE id = $1`,
    [
      importacaoId,
      dados.status,
      dados.totalLinhas,
      dados.inseridos,
      dados.atualizados,
      dados.rejeitados,
      dados.ignorados,
      dados.avisos.length,
      JSON.stringify(dados.avisos),
      JSON.stringify(dados.novosCadastros),
    ],
  );
}

export async function listarImportacoes(
  db: Executor,
  pagina: number,
  porPagina: number,
): Promise<{ itens: Omit<ImportacaoRegistro, 'avisos'>[]; total: number }> {
  const [itens, total] = await Promise.all([
    db.query<Omit<ImportacaoRegistro, 'avisos'>>(
      `SELECT ${COLUNAS_RESUMO}
         FROM importacoes ORDER BY criada_em DESC, id DESC LIMIT $1 OFFSET $2`,
      [porPagina, (pagina - 1) * porPagina],
    ),
    db.query<{ total: number }>('SELECT count(*)::int AS total FROM importacoes'),
  ]);
  return { itens: itens.rows, total: total.rows[0]!.total };
}

export async function buscarImportacao(db: Executor, id: number): Promise<ImportacaoRegistro | null> {
  const { rows } = await db.query<ImportacaoRegistro>(`SELECT ${COLUNAS_IMPORTACAO} FROM importacoes WHERE id = $1`, [
    id,
  ]);
  return rows[0] ?? null;
}

export async function listarLinhasRejeitadas(db: Executor, importacaoId: number): Promise<LinhaRejeitadaRegistro[]> {
  const { rows } = await db.query<LinhaRejeitadaRegistro>(
    `SELECT linha, valores_originais AS "valoresOriginais", erros
       FROM importacao_linhas_rejeitadas WHERE importacao_id = $1 ORDER BY linha`,
    [importacaoId],
  );
  return rows;
}
