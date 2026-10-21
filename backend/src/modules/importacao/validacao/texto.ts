// Espaço comum, tab e os espaços "invisíveis" que costumam vir de planilhas e sites.
const ESPACOS_HORIZONTAIS = /[ \t\u00A0\u2007\u202F]+/g;
const CARACTERES_DE_CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const DIACRITICOS = /[\u0300-\u036f]/g;

/**
 * Remove espaços nas pontas e espaços repetidos. Quebras de linha internas são preservadas
 * (relevante para observações). Retorna null quando não sobra conteúdo.
 */
export function limparTexto(valor: string | null | undefined): string | null {
  if (valor == null) return null;

  const limpo = valor
    .replace(CARACTERES_DE_CONTROLE, '')
    .replace(ESPACOS_HORIZONTAIS, ' ')
    .split(/\r\n|\r|\n/)
    .map((linha) => linha.trim())
    .join('\n')
    .trim();

  return limpo === '' ? null : limpo;
}

const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const NUMERAL_ROMANO = /^(?=[ivx]+$)x{0,3}(?:ix|iv|v?i{0,3})$/;

function capitalizar(parte: string): string {
  return parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1);
}

function ajustarPalavra(palavra: string, primeira: boolean): string {
  if (/\d/.test(palavra)) return palavra.toLocaleUpperCase('pt-BR');
  if (NUMERAL_ROMANO.test(palavra)) return palavra.toLocaleUpperCase('pt-BR');
  if (!primeira && CONECTIVOS.has(palavra)) return palavra;
  if (!primeira && palavra.startsWith("d'") && palavra.length > 2) return "d'" + capitalizar(palavra.slice(2));
  return palavra.split('-').map(capitalizar).join('-');
}

/**
 * Texto digitado todo em maiúsculas ou todo em minúsculas vira nome próprio:
 * "CAMPINAS" e "campinas" viram "Campinas"; "SAO JOSE DOS CAMPOS" vira "Sao Jose dos Campos".
 * Texto que já mistura maiúsculas e minúsculas é mantido, porque a grafia foi escolhida por quem digitou.
 * Acentos não são acrescentados.
 */
export function ajustarCaixa(valor: string): string {
  const temMaiuscula = /\p{Lu}/u.test(valor);
  const temMinuscula = /\p{Ll}/u.test(valor);
  if (temMaiuscula === temMinuscula) return valor;

  return valor
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((palavra, indice) => ajustarPalavra(palavra, indice === 0))
    .join(' ');
}

/** Chave para comparar nomes sem diferenciar maiúsculas, acentos e espaços repetidos. */
export function chaveNormalizada(valor: string): string {
  return valor.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
