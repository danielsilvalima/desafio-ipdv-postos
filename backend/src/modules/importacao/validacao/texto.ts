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

/** Chave para comparar nomes sem diferenciar maiúsculas, acentos e espaços repetidos. */
export function chaveNormalizada(valor: string): string {
  return valor.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
