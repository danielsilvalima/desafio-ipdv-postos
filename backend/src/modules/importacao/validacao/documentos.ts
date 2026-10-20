import { falha, sucesso, type Achado, type CodigoAviso, type ResultadoCampo } from './tipos.js';

export const REGRAS_DOCUMENTO = {
  cnpj: { tamanho: 14, aceitaNotacaoCientifica: true },
  cpf: { tamanho: 11, aceitaNotacaoCientifica: false },
  cep: { tamanho: 8, aceitaNotacaoCientifica: false },
} as const;

export type TipoDocumento = keyof typeof REGRAS_DOCUMENTO;

const NOTACAO_CIENTIFICA = /^([0-9]+)(?:[.,]([0-9]+))?[eE]\+?([0-9]+)$/;
const MASCARA = /[.\-/\s]/g;

/**
 * Reescreve um número em notação científica (ex.: "1,02346E+13") com todos os dígitos.
 * Não inventa dígitos: apenas desloca a vírgula. Retorna null se o resultado não for inteiro.
 */
export function expandirNotacaoCientifica(valor: string): string | null {
  const partes = NOTACAO_CIENTIFICA.exec(valor);
  if (!partes) return null;

  const [, inteira = '', decimal = '', expoenteTexto = '0'] = partes;
  const expoente = Number(expoenteTexto);
  if (decimal.length > expoente) return null;

  return inteira + decimal + '0'.repeat(expoente - decimal.length);
}

/**
 * Normaliza CNPJ, CPF ou CEP mantendo exatamente os dígitos informados.
 * Nunca completa zeros à esquerda: se faltar dígito, o valor é rejeitado.
 * Não confere dígito verificador (ver DECISOES.md).
 */
export function normalizarDocumento(tipo: TipoDocumento, bruto: string): ResultadoCampo<string> {
  const regra = REGRAS_DOCUMENTO[tipo];
  // Apóstrofo inicial é o jeito do Excel de forçar texto; não faz parte do valor.
  const valor = bruto.trim().replace(/^'/, '');
  const avisos: Achado<CodigoAviso>[] = [];
  let candidato = valor;

  const semEspacos = valor.replace(/\s/g, '');
  if (NOTACAO_CIENTIFICA.test(semEspacos)) {
    const expandido = regra.aceitaNotacaoCientifica ? expandirNotacaoCientifica(semEspacos) : null;
    if (expandido === null) {
      return falha('DOCUMENTO_NOTACAO_CIENTIFICA');
    }
    avisos.push({ codigo: 'CNPJ_NOTACAO_CIENTIFICA', params: { convertido: expandido } });
    candidato = expandido;
  }

  const digitos = candidato.replace(MASCARA, '');
  if (!/^[0-9]+$/.test(digitos)) {
    return falha('DOCUMENTO_CARACTERES_INVALIDOS');
  }
  if (digitos.length !== regra.tamanho) {
    return falha('DOCUMENTO_QUANTIDADE_DIGITOS', { recebidos: digitos.length, esperados: regra.tamanho });
  }
  if (/^0+$/.test(digitos)) {
    return falha('DOCUMENTO_ZERADO');
  }

  return sucesso(digitos, avisos);
}

function calcularDigitoCnpj(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, i) => acc + peso * Number(digitos[i]), 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Confere os dígitos verificadores do CNPJ. Não é usada na importação porque os dados do
 * desafio são fictícios; fica pronta para ser ligada com dados reais.
 */
export function cnpjTemDigitosVerificadoresValidos(cnpj: string): boolean {
  if (!/^[0-9]{14}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, ...pesos1];
  return (
    calcularDigitoCnpj(cnpj, pesos1) === Number(cnpj[12]) && calcularDigitoCnpj(cnpj, pesos2) === Number(cnpj[13])
  );
}

/** Confere os dígitos verificadores do CPF. Mesma situação da função de CNPJ. */
export function cpfTemDigitosVerificadoresValidos(cpf: string): boolean {
  if (!/^[0-9]{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  const digito = (pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + peso * Number(cpf[i]), 0);
    return ((soma * 10) % 11) % 10;
  };
  const pesos1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [11, ...pesos1];
  return digito(pesos1) === Number(cpf[9]) && digito(pesos2) === Number(cpf[10]);
}
