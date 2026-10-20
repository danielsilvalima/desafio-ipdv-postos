import { parse } from 'csv-parse/sync';
import { ErroArquivo } from '../erros-arquivo.js';

export type Delimitador = ';' | ',' | '\t';

export interface RegistroCsv {
  /** Número da linha como o usuário vê na planilha: o cabeçalho é a linha 1. */
  linha: number;
  valores: string[];
}

export interface CsvLido {
  delimitador: Delimitador;
  codificacao: 'utf-8' | 'windows-1252';
  cabecalho: string[];
  registros: RegistroCsv[];
}

const ASSINATURA_ZIP = [0x50, 0x4b, 0x03, 0x04];
const ASSINATURA_XLS = [0xd0, 0xcf, 0x11, 0xe0];
const CANDIDATOS_DELIMITADOR: Delimitador[] = [';', ',', '\t'];

function comecaCom(buffer: Buffer, assinatura: number[]): boolean {
  return assinatura.every((byte, i) => buffer[i] === byte);
}

/** UTF-8 primeiro; se houver bytes inválidos, o arquivo veio do Excel em Windows-1252. */
function decodificar(buffer: Buffer): { texto: string; codificacao: CsvLido['codificacao'] } {
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(buffer), codificacao: 'utf-8' };
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(buffer), codificacao: 'windows-1252' };
  }
}

/** Conta os delimitadores fora de aspas na primeira linha (o cabeçalho). */
function detectarDelimitador(texto: string): Delimitador {
  const contagem = new Map<Delimitador, number>(CANDIDATOS_DELIMITADOR.map((d) => [d, 0]));
  let dentroDeAspas = false;

  for (const caractere of texto) {
    if (caractere === '"') dentroDeAspas = !dentroDeAspas;
    else if (!dentroDeAspas && (caractere === '\n' || caractere === '\r')) break;
    else if (!dentroDeAspas && contagem.has(caractere as Delimitador)) {
      contagem.set(caractere as Delimitador, (contagem.get(caractere as Delimitador) ?? 0) + 1);
    }
  }

  let melhor: Delimitador = ';';
  for (const [delimitador, quantidade] of contagem) {
    if (quantidade > (contagem.get(melhor) ?? 0)) melhor = delimitador;
  }
  return melhor;
}

function linhaVazia(valores: string[]): boolean {
  return valores.every((valor) => valor.trim() === '');
}

export function lerCsv(buffer: Buffer): CsvLido {
  if (buffer.length === 0) {
    throw new ErroArquivo('ARQUIVO_VAZIO', 'O arquivo enviado está vazio.', {
      dica: 'Confira se você selecionou o arquivo certo e se ele foi salvo com os dados.',
    });
  }
  if (comecaCom(buffer, ASSINATURA_ZIP) || comecaCom(buffer, ASSINATURA_XLS)) {
    throw new ErroArquivo('ARQUIVO_EXCEL', 'O arquivo é uma planilha do Excel (.xlsx ou .xls), não um CSV.', {
      dica: 'No Excel, use Arquivo > Salvar como e escolha o tipo "CSV UTF-8 (delimitado por vírgulas)". Depois importe o arquivo .csv gerado.',
    });
  }

  const { texto, codificacao } = decodificar(buffer);
  if (texto.includes('\u0000')) {
    throw new ErroArquivo('ARQUIVO_NAO_TEXTO', 'O arquivo não é um CSV de texto.', {
      dica: 'Envie um arquivo .csv exportado da planilha de postos.',
    });
  }

  const delimitador = detectarDelimitador(texto.replace(/^\uFEFF/, ''));
  let linhas: string[][];
  try {
    linhas = parse(texto, {
      delimiter: delimitador,
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
    }) as string[][];
  } catch (err) {
    const { lines } = err as { lines?: number };
    throw new ErroArquivo('CSV_MALFORMADO', 'Não foi possível ler o CSV: há aspas abertas que não foram fechadas.', {
      dica: `Confira as aspas perto da linha ${lines ?? '?'} da planilha. Todo texto que começa com aspas precisa terminar com aspas.`,
      ...(lines ? { linha: lines } : {}),
    });
  }

  const [cabecalho, ...restante] = linhas;
  if (!cabecalho || linhaVazia(cabecalho)) {
    throw new ErroArquivo('ARQUIVO_VAZIO', 'O arquivo não tem cabeçalho nem dados.', {
      dica: 'A primeira linha deve conter os nomes das colunas. Baixe o modelo CSV para ver o formato esperado.',
    });
  }

  const registros = restante
    .map((valores, indice) => ({ linha: indice + 2, valores }))
    .filter((registro) => !linhaVazia(registro.valores));

  return { delimitador, codificacao, cabecalho, registros };
}
