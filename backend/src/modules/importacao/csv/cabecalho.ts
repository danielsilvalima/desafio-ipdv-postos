import { COLUNAS_CSV, NOMES_COLUNAS, type NomeColuna } from '../validacao/colunas.js';
import { chaveNormalizada } from '../validacao/texto.js';
import { ErroArquivo } from '../erros-arquivo.js';

/** Coluna extra do arquivo de correção; é ignorada sem aviso ao reimportar. */
export const COLUNA_ERROS_IMPORTACAO = 'erros_importacao';

export interface CabecalhoMapeado {
  indicePorColuna: Map<NomeColuna, number>;
  colunasDesconhecidas: string[];
  colunasOpcionaisAusentes: NomeColuna[];
}

/** "Nome Posto", "NOME_POSTO" e " nome-posto " viram "nome_posto". */
export function normalizarNomeColuna(nome: string): string {
  return chaveNormalizada(nome.replace(/^\uFEFF/, '')).replace(/[\s-]+/g, '_');
}

export function mapearCabecalho(cabecalho: string[]): CabecalhoMapeado {
  const conhecidas = new Set<string>(NOMES_COLUNAS);
  const indicePorColuna = new Map<NomeColuna, number>();
  const repetidas = new Set<string>();
  const colunasDesconhecidas: string[] = [];

  cabecalho.forEach((original, indice) => {
    const nome = normalizarNomeColuna(original);
    if (nome === '' || nome === COLUNA_ERROS_IMPORTACAO) return;

    if (!conhecidas.has(nome)) {
      colunasDesconhecidas.push(original.trim());
      return;
    }
    if (indicePorColuna.has(nome as NomeColuna)) {
      repetidas.add(nome);
      return;
    }
    indicePorColuna.set(nome as NomeColuna, indice);
  });

  if (repetidas.size > 0) {
    throw new ErroArquivo('CABECALHO_COLUNAS_REPETIDAS', `O cabeçalho tem colunas repetidas: ${[...repetidas].join(', ')}.`, {
      dica: 'Deixe cada coluna aparecer uma única vez na primeira linha da planilha.',
      colunasRepetidas: [...repetidas],
    });
  }

  const ausentes = COLUNAS_CSV.filter((coluna) => !indicePorColuna.has(coluna.nome));
  const obrigatoriasAusentes = ausentes.filter((coluna) => coluna.obrigatoria).map((coluna) => coluna.nome);
  if (obrigatoriasAusentes.length > 0) {
    throw new ErroArquivo(
      'CABECALHO_COLUNAS_AUSENTES',
      `Faltam colunas obrigatórias no cabeçalho: ${obrigatoriasAusentes.join(', ')}.`,
      {
        dica: 'A primeira linha da planilha precisa ter os nomes das colunas exatamente como no modelo. Baixe o modelo CSV e compare.',
        colunasAusentes: obrigatoriasAusentes,
        cabecalhoEsperado: [...NOMES_COLUNAS],
        cabecalhoRecebido: cabecalho.map((coluna) => coluna.trim()),
      },
    );
  }

  return {
    indicePorColuna,
    colunasDesconhecidas,
    colunasOpcionaisAusentes: ausentes.map((coluna) => coluna.nome),
  };
}
