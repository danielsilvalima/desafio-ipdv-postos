import { falha, sucesso, type ResultadoCampo } from './tipos.js';

const DIA_MES_ANO = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;
const ANO_MES_DIA = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/;
const SERIAL_EXCEL = /^\d{2,5}(?:[.,]\d+)?$/;
const HORARIO_FINAL = /(?:\s+|T)\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

const ANO_MINIMO = 1900;
const ANO_MAXIMO = 2100;
// Serial 61 = 01/03/1900. Abaixo disso o Excel tem o bug do 29/02/1900, então não aceitamos.
const SERIAL_MINIMO = 61;
const SERIAL_MAXIMO = 73050;
const EPOCA_EXCEL_MS = Date.UTC(1899, 11, 30);
const MS_POR_DIA = 86_400_000;

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function montarData(ano: number, mes: number, dia: number): ResultadoCampo<string> {
  if (ano < ANO_MINIMO || ano > ANO_MAXIMO) {
    return falha('DATA_FORA_DO_PERIODO', { anoMinimo: ANO_MINIMO, anoMaximo: ANO_MAXIMO });
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) {
    return falha('DATA_INEXISTENTE');
  }
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return sucesso(`${ano}-${mm}-${dd}`);
}

/**
 * Converte a data para o formato ISO (aaaa-mm-dd).
 * Aceita dd/mm/aaaa (padrão brasileiro, também com "-" ou "."), aaaa-mm-dd e o número serial
 * que o Excel grava quando a célula está formatada como número. Horário no final é ignorado.
 */
export function normalizarData(bruto: string): ResultadoCampo<string> {
  const valor = bruto.trim().replace(HORARIO_FINAL, '').trim();

  const dma = DIA_MES_ANO.exec(valor);
  if (dma) {
    const [, dia = '', mes = '', ano = ''] = dma;
    if (ano.length === 2) return falha('DATA_FORMATO_INVALIDO', { motivo: 'ano_dois_digitos' });
    return montarData(Number(ano), Number(mes), Number(dia));
  }

  const amd = ANO_MES_DIA.exec(valor);
  if (amd) {
    const [, ano = '', mes = '', dia = ''] = amd;
    return montarData(Number(ano), Number(mes), Number(dia));
  }

  if (SERIAL_EXCEL.test(valor)) {
    const serial = Math.floor(Number(valor.replace(',', '.')));
    if (serial < SERIAL_MINIMO || serial > SERIAL_MAXIMO) {
      return falha('DATA_FORMATO_INVALIDO');
    }
    const data = new Date(EPOCA_EXCEL_MS + serial * MS_POR_DIA);
    return montarData(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate());
  }

  return falha('DATA_FORMATO_INVALIDO');
}
