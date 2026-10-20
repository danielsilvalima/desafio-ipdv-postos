import { montarCsv } from '../../shared/csv/escritor-csv.js';
import { COLUNA_ERROS_IMPORTACAO } from './csv/cabecalho.js';
import type { LinhaRejeitadaRegistro } from './importacao.repository.js';
import { COLUNAS_CSV, NOMES_COLUNAS } from './validacao/colunas.js';
import { EXEMPLOS_DOCUMENTO, type Ocorrencia } from './validacao/mensagens.js';

function descreverErros(erros: Ocorrencia[]): string {
  return erros.map((erro) => `${erro.rotulo}: ${erro.mensagem}`).join(' | ');
}

/**
 * Só as linhas rejeitadas, com os valores exatamente como vieram e a coluna extra "erros_importacao".
 * O usuário corrige no Excel e importa o mesmo arquivo de volta; o importador ignora a coluna extra.
 */
export function gerarCsvCorrecao(linhas: LinhaRejeitadaRegistro[]): string {
  return montarCsv(
    [...NOMES_COLUNAS, COLUNA_ERROS_IMPORTACAO],
    linhas.map((linha) => [...NOMES_COLUNAS.map((nome) => linha.valoresOriginais[nome] ?? ''), descreverErros(linha.erros)]),
  );
}

/** Cabeçalho do contrato e uma linha de exemplo. Documentos vão com máscara para o Excel não apagar zeros. */
export function gerarCsvModelo(): string {
  const exemplo = COLUNAS_CSV.map((coluna) => EXEMPLOS_DOCUMENTO[coluna.nome]?.mascara ?? coluna.exemplo);
  return montarCsv(NOMES_COLUNAS, [exemplo]);
}
