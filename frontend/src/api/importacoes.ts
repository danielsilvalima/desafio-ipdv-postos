import { api, urlDaApi } from './cliente';
import type { ImportacaoResumo, Pagina, RelatorioImportacao } from './tipos';

export async function importarCsv(
  arquivo: File,
  aoEnviar?: (percentual: number) => void,
): Promise<RelatorioImportacao> {
  const formulario = new FormData();
  formulario.append('arquivo', arquivo);

  const { data } = await api.post<RelatorioImportacao>('/importacoes', formulario, {
    // Erros de arquivo e de cabeçalho são explicados na própria tela de importação.
    silencioso: true,
    onUploadProgress: (evento) => {
      if (evento.total) aoEnviar?.(Math.round((evento.loaded / evento.total) * 100));
    },
  });
  return data;
}

export async function listarImportacoes(
  pagina: number,
  porPagina: number,
  signal?: AbortSignal,
): Promise<Pagina<ImportacaoResumo>> {
  const { data } = await api.get<Pagina<ImportacaoResumo>>('/importacoes', {
    params: { pagina, porPagina },
    signal,
    silencioso: true,
  });
  return data;
}

export async function buscarImportacao(id: number): Promise<RelatorioImportacao> {
  const { data } = await api.get<RelatorioImportacao>(`/importacoes/${id}`, { silencioso: true });
  return data;
}

export const URL_MODELO_CSV = urlDaApi('/importacoes/modelo.csv');

export function urlArquivoCorrecao(importacaoId: number): string {
  return urlDaApi(`/importacoes/${importacaoId}/linhas-rejeitadas.csv`);
}
