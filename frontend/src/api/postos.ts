import { api, urlDaApi } from './cliente';
import type { FiltrosPostos, Pagina, Posto } from './tipos';

export async function listarPostos(filtros: FiltrosPostos, signal?: AbortSignal): Promise<Pagina<Posto>> {
  // A tela mostra o erro no lugar da tabela, com o botão de tentar de novo.
  const { data } = await api.get<Pagina<Posto>>('/postos', { params: filtros, signal, silencioso: true });
  return data;
}

/** Download direto: a exportação vem em streaming do servidor e não passa pela memória do navegador. */
export const URL_EXPORTACAO_POSTOS = urlDaApi('/postos/export.csv');
