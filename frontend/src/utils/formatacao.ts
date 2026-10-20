import type { StatusImportacao, StatusPosto } from '@/api/tipos';

function aplicarMascara(digitos: string, padrao: RegExp, formato: string): string {
  return padrao.test(digitos) ? digitos.replace(padrao, formato) : digitos;
}

export const mascararCnpj = (v: string) => aplicarMascara(v, /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
export const mascararCpf = (v: string) => aplicarMascara(v, /^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
export const mascararCep = (v: string) => aplicarMascara(v, /^(\d{5})(\d{3})$/, '$1-$2');

/** AAAA-MM-DD para dd/mm/aaaa, sem passar por Date (evita deslocamento de fuso). */
export function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function formatarDataHora(iso: string | null): string {
  return iso ? DATA_HORA.format(new Date(iso)) : '—';
}

const NUMERO = new Intl.NumberFormat('pt-BR');

export function formatarNumero(valor: number): string {
  return NUMERO.format(valor);
}

/** "1 linha", "2 linhas". */
export function plural(quantidade: number, singular: string, pluralTexto = `${singular}s`): string {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : pluralTexto}`;
}

export function textoOuTraco(valor: string | number | null | undefined): string {
  return valor === null || valor === undefined || valor === '' ? '—' : String(valor);
}

export const STATUS_POSTO: Record<StatusPosto, { texto: string; cor: string }> = {
  ativo: { texto: 'Ativo', cor: 'success' },
  inativo: { texto: 'Inativo', cor: 'grey' },
  em_implantacao: { texto: 'Em implantação', cor: 'info' },
};

export const STATUS_IMPORTACAO: Record<StatusImportacao, { texto: string; cor: string; icone: string }> = {
  processando: { texto: 'Processando', cor: 'info', icone: 'mdi-progress-clock' },
  concluida: { texto: 'Concluída', cor: 'success', icone: 'mdi-check-circle' },
  concluida_com_pendencias: { texto: 'Com pendências', cor: 'warning', icone: 'mdi-alert' },
  falhou: { texto: 'Falhou', cor: 'error', icone: 'mdi-close-circle' },
};
