/**
 * CSV no formato que o Excel em português abre direto: BOM UTF-8 (para os acentos),
 * separador ";" e quebra de linha CRLF.
 */
export const BOM = '\uFEFF';
export const SEPARADOR = ';';
const QUEBRA_LINHA = '\r\n';

type Valor = string | number | null | undefined;

export function escaparCampo(valor: Valor): string {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function linhaCsv(valores: readonly Valor[]): string {
  return valores.map(escaparCampo).join(SEPARADOR) + QUEBRA_LINHA;
}

export function montarCsv(cabecalho: readonly string[], linhas: readonly (readonly Valor[])[]): string {
  return BOM + linhaCsv(cabecalho) + linhas.map(linhaCsv).join('');
}
