import { falha, sucesso, type ResultadoCampo } from './tipos.js';

const INT4_MAXIMO = 2_147_483_647;

/**
 * Aceita inteiros não negativos, inclusive no formato que planilhas exportam ("4.0" ou "4,0").
 * Rejeita valores com casas decimais de verdade ("4,5"), negativos e textos.
 */
export function normalizarInteiroNaoNegativo(bruto: string): ResultadoCampo<number> {
  const valor = bruto.replace(/\s/g, '');

  if (/^-\d/.test(valor)) {
    return falha('INTEIRO_NEGATIVO');
  }

  const partes = /^\+?(\d+)(?:[.,](\d+))?$/.exec(valor);
  if (!partes) {
    return falha('INTEIRO_INVALIDO');
  }

  const [, inteira = '', decimal = ''] = partes;
  if (/[1-9]/.test(decimal)) {
    return falha('INTEIRO_INVALIDO', { motivo: 'decimal' });
  }

  const numero = Number(inteira);
  if (numero > INT4_MAXIMO) {
    return falha('INTEIRO_INVALIDO', { motivo: 'muito_grande' });
  }

  return sucesso(numero);
}
