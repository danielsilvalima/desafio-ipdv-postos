import type { Pool } from 'pg';
import { emTransacao } from '../../db/transacao.js';
import { AppError } from '../../shared/errors/app-error.js';
import { lerCsv } from './csv/leitor-csv.js';
import { ErroArquivo } from './erros-arquivo.js';
import * as repositorio from './importacao.repository.js';
import { prepararImportacao, type ImportacaoPreparada } from './preparar-importacao.js';
import { montarRelatorio, type RelatorioImportacao } from './relatorio.js';
import { chaveNormalizada } from './validacao/texto.js';

export interface ArquivoRecebido {
  nome: string;
  conteudo: Buffer;
}

export function importacaoNaoEncontrada(): AppError {
  return new AppError(404, 'IMPORTACAO_NAO_ENCONTRADA', 'Importação não encontrada.');
}

/** Combustíveis que só diferem por acento ou caixa ("Etanol" e "etanol") viram um item só. */
function idsSemRepeticao(nomes: string[], idPorNome: Map<string, number>): number[] {
  return [...new Set(nomes.map((nome) => idPorNome.get(nome)!))];
}

async function gravar(pool: Pool, importacaoId: number, preparada: ImportacaoPreparada): Promise<void> {
  await emTransacao(pool, async (client) => {
    const postos = preparada.aceitas.map((item) => item.posto);

    const bandeiras = await repositorio.garantirBandeiras(client, postos.map((p) => p.bandeira));
    const combustiveis = await repositorio.garantirCombustiveis(client, postos.flatMap((p) => p.combustiveis));

    const responsaveisPorCpf = new Map(postos.map((p) => [p.responsavel.cpf, p.responsavel]));
    const responsavelIdPorCpf = await repositorio.upsertResponsaveis(client, [...responsaveisPorCpf.values()]);

    const { inseridos, atualizados } = await repositorio.upsertPostos(
      client,
      postos.map((posto) => ({
        posto,
        bandeiraId: bandeiras.idPorNome.get(posto.bandeira)!,
        responsavelId: responsavelIdPorCpf.get(posto.responsavel.cpf)!,
        combustivelIds: idsSemRepeticao(posto.combustiveis, combustiveis.idPorNome),
      })),
    );

    await repositorio.inserirLinhasRejeitadas(client, importacaoId, preparada.rejeitadas);
    await repositorio.finalizarImportacao(client, importacaoId, {
      status: preparada.rejeitadas.length > 0 ? 'concluida_com_pendencias' : 'concluida',
      totalLinhas: preparada.totalLinhas,
      inseridos,
      atualizados,
      rejeitados: preparada.rejeitadas.length,
      ignorados: preparada.ignorados,
      avisos: preparada.avisos,
      novosCadastros: {
        bandeiras: bandeiras.criados.sort((a, b) => chaveNormalizada(a).localeCompare(chaveNormalizada(b))),
        combustiveis: combustiveis.criados.sort((a, b) => chaveNormalizada(a).localeCompare(chaveNormalizada(b))),
      },
    });
  });
}

/**
 * Importa o CSV: erros que impedem ler o arquivo não gravam nenhum posto, mas ficam no histórico.
 * As linhas válidas são gravadas numa única transação; as inválidas ficam guardadas para o arquivo de correção.
 */
export async function importarCsv(pool: Pool, arquivo: ArquivoRecebido): Promise<RelatorioImportacao> {
  let cabecalho: string[] | null = null;
  let preparada: ImportacaoPreparada;

  try {
    const csv = lerCsv(arquivo.conteudo);
    cabecalho = csv.cabecalho;
    preparada = prepararImportacao(csv);
  } catch (err) {
    if (!(err instanceof ErroArquivo)) throw err;
    const importacaoId = await repositorio.registrarFalha(pool, {
      nomeArquivo: arquivo.nome,
      cabecalho,
      erro: { codigo: err.code, mensagem: err.message, detalhes: err.detalhes },
    });
    throw err.comImportacao(importacaoId);
  }

  const importacaoId = await repositorio.inserirImportacao(pool, arquivo.nome, cabecalho);
  try {
    await gravar(pool, importacaoId, preparada);
  } catch (err) {
    await repositorio
      .registrarFalha(pool, {
        importacaoId,
        nomeArquivo: arquivo.nome,
        cabecalho,
        erro: {
          codigo: 'ERRO_INTERNO',
          mensagem: 'A importação foi interrompida por um erro inesperado. Nenhum posto deste arquivo foi gravado.',
          detalhes: { dica: 'Tente importar novamente. Se o erro continuar, avise o suporte.' },
        },
      })
      .catch(() => undefined);
    throw err;
  }

  return buscarRelatorio(pool, importacaoId);
}

export async function buscarRelatorio(pool: Pool, importacaoId: number): Promise<RelatorioImportacao> {
  const importacao = await repositorio.buscarImportacao(pool, importacaoId);
  if (!importacao) throw importacaoNaoEncontrada();
  const linhasRejeitadas = await repositorio.listarLinhasRejeitadas(pool, importacaoId);
  return montarRelatorio(importacao, linhasRejeitadas);
}

export function listarHistorico(pool: Pool, pagina: number, porPagina: number) {
  return repositorio.listarImportacoes(pool, pagina, porPagina);
}

export async function linhasParaCorrecao(pool: Pool, importacaoId: number) {
  const importacao = await repositorio.buscarImportacao(pool, importacaoId);
  if (!importacao) throw importacaoNaoEncontrada();
  return { importacao, linhas: await repositorio.listarLinhasRejeitadas(pool, importacaoId) };
}
