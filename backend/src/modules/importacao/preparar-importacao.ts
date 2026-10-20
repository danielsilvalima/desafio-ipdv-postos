import type { CsvLido } from './csv/leitor-csv.js';
import { mapearCabecalho } from './csv/cabecalho.js';
import { ErroArquivo } from './erros-arquivo.js';
import { NOMES_COLUNAS, type NomeColuna } from './validacao/colunas.js';
import { montarOcorrencia, type Ocorrencia } from './validacao/mensagens.js';
import { validarLinha, type LinhaBruta, type PostoNormalizado } from './validacao/validar-linha.js';

export type ValoresOriginais = Record<NomeColuna, string>;

export interface OcorrenciaNaLinha extends Ocorrencia {
  /** Linha da planilha; 1 é o cabeçalho. */
  linha: number;
}

export interface LinhaAceita {
  linha: number;
  posto: PostoNormalizado;
}

export interface LinhaRejeitada {
  linha: number;
  valoresOriginais: ValoresOriginais;
  erros: Ocorrencia[];
}

export interface ImportacaoPreparada {
  totalLinhas: number;
  aceitas: LinhaAceita[];
  rejeitadas: LinhaRejeitada[];
  avisos: OcorrenciaNaLinha[];
  ignorados: number;
}

const LINHA_CABECALHO = 1;

function extrairValores(valores: string[], indicePorColuna: Map<NomeColuna, number>): ValoresOriginais {
  const resultado = {} as ValoresOriginais;
  for (const nome of NOMES_COLUNAS) {
    const indice = indicePorColuna.get(nome);
    resultado[nome] = indice === undefined ? '' : (valores[indice] ?? '');
  }
  return resultado;
}

/** Valores além da última coluna do cabeçalho indicam um delimitador solto dentro de algum campo. */
function temColunasAMais(valores: string[], totalColunas: number): boolean {
  return valores.slice(totalColunas).some((valor) => valor.trim() !== '');
}

function camposDivergentes(a: PostoNormalizado['responsavel'], b: PostoNormalizado['responsavel']): string[] {
  const campos: string[] = [];
  if (a.nome !== b.nome) campos.push('nome');
  if (a.email !== b.email) campos.push('e-mail');
  if (a.cargo !== b.cargo) campos.push('cargo');
  return campos;
}

/**
 * Transforma o CSV lido em linhas prontas para gravar e linhas rejeitadas com os motivos.
 * Não acessa o banco: toda a regra de validação e de duplicidade fica testável isoladamente.
 */
export function prepararImportacao(csv: CsvLido): ImportacaoPreparada {
  const { indicePorColuna, colunasDesconhecidas, colunasOpcionaisAusentes } = mapearCabecalho(csv.cabecalho);

  if (csv.registros.length === 0) {
    throw new ErroArquivo('ARQUIVO_SEM_LINHAS', 'O arquivo tem o cabeçalho, mas nenhuma linha de posto.', {
      dica: 'Preencha os postos a partir da linha 2 da planilha e importe novamente.',
    });
  }

  const avisos: OcorrenciaNaLinha[] = [
    ...colunasDesconhecidas.map((coluna) => ({
      ...montarOcorrencia({ codigo: 'COLUNA_DESCONHECIDA' }, coluna, coluna),
      linha: LINHA_CABECALHO,
    })),
    ...colunasOpcionaisAusentes.map((coluna) => ({
      ...montarOcorrencia({ codigo: 'COLUNA_OPCIONAL_AUSENTE' }, coluna, null),
      linha: LINHA_CABECALHO,
    })),
  ];

  const validas: { linha: number; posto: PostoNormalizado; avisos: OcorrenciaNaLinha[]; cnpjOriginal: string }[] = [];
  const rejeitadas: LinhaRejeitada[] = [];

  for (const { linha, valores } of csv.registros) {
    const valoresOriginais = extrairValores(valores, indicePorColuna);

    if (temColunasAMais(valores, csv.cabecalho.length)) {
      const erro = montarOcorrencia(
        {
          codigo: 'LINHA_COLUNAS_A_MAIS',
          params: { recebidas: valores.length, esperadas: csv.cabecalho.length, delimitador: csv.delimitador },
        },
        'linha',
        null,
      );
      rejeitadas.push({ linha, valoresOriginais, erros: [{ ...erro, rotulo: 'Linha inteira' }] });
      continue;
    }

    const resultado = validarLinha(valoresOriginais satisfies LinhaBruta);
    if (!resultado.valido) {
      rejeitadas.push({ linha, valoresOriginais, erros: resultado.erros });
      continue;
    }

    validas.push({
      linha,
      posto: resultado.posto,
      avisos: resultado.avisos.map((aviso) => ({ ...aviso, linha })),
      cnpjOriginal: valoresOriginais.cnpj,
    });
  }

  // CNPJ repetido no arquivo: vale a última ocorrência.
  const ultimaLinhaPorCnpj = new Map<string, number>();
  for (const item of validas) ultimaLinhaPorCnpj.set(item.posto.cnpj, item.linha);

  const aceitas: typeof validas = [];
  let ignorados = 0;
  for (const item of validas) {
    const linhaMantida = ultimaLinhaPorCnpj.get(item.posto.cnpj)!;
    if (linhaMantida === item.linha) {
      aceitas.push(item);
      continue;
    }
    ignorados += 1;
    avisos.push({
      ...montarOcorrencia({ codigo: 'CNPJ_DUPLICADO_NO_ARQUIVO', params: { linhaMantida } }, 'cnpj', item.cnpjOriginal),
      linha: item.linha,
    });
  }

  // Mesmo CPF com dados diferentes: prevalece a última ocorrência entre as linhas aceitas.
  const ultimaPorCpf = new Map<string, LinhaAceita>();
  for (const item of aceitas) ultimaPorCpf.set(item.posto.responsavel.cpf, item);

  for (const item of aceitas) {
    const vencedora = ultimaPorCpf.get(item.posto.responsavel.cpf)!;
    if (vencedora.linha !== item.linha) {
      const campos = camposDivergentes(item.posto.responsavel, vencedora.posto.responsavel);
      if (campos.length > 0) {
        avisos.push({
          ...montarOcorrencia(
            { codigo: 'RESPONSAVEL_DIVERGENTE', params: { campos: campos.join(', '), linhaMantida: vencedora.linha } },
            'cpf_responsavel',
            item.posto.responsavel.cpf,
          ),
          linha: item.linha,
        });
      }
      item.posto.responsavel = vencedora.posto.responsavel;
    }
    avisos.push(...item.avisos);
  }

  avisos.sort((a, b) => a.linha - b.linha);

  return {
    totalLinhas: csv.registros.length,
    aceitas: aceitas.map(({ linha, posto }) => ({ linha, posto })),
    rejeitadas,
    avisos,
    ignorados,
  };
}
