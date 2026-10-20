import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { useNotificacoes } from '@/composables/useNotificacoes';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** A tela trata o erro sozinha (ex.: erro de arquivo na importação); não mostra o aviso global. */
    silencioso?: boolean;
  }
}

/** Erro já traduzido para a tela: sempre tem uma mensagem pronta para o usuário. */
export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    message: string,
    public readonly detalhes: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ErroApi';
  }
}

interface CorpoErro {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

function traduzir(erro: AxiosError<CorpoErro>): ErroApi {
  const corpo = erro.response?.data?.error;
  if (erro.response && corpo?.message) {
    return new ErroApi(erro.response.status, corpo.code ?? 'ERRO', corpo.message, corpo.details ?? {});
  }
  if (erro.response) {
    return new ErroApi(
      erro.response.status,
      'ERRO_HTTP',
      'O servidor respondeu com um erro inesperado. Tente novamente em instantes.',
    );
  }
  return new ErroApi(
    0,
    'SEM_CONEXAO',
    'Não foi possível falar com o servidor. Confira sua conexão e se a API está em execução.',
  );
}

export const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(undefined, (erro: AxiosError<CorpoErro>) => {
  if (axios.isCancel(erro)) return Promise.reject(erro);

  const traduzido = traduzir(erro);
  const config = erro.config as AxiosRequestConfig | undefined;
  if (!config?.silencioso) {
    useNotificacoes().notificar({ text: traduzido.message, color: 'error', timeout: 6000 });
  }
  return Promise.reject(traduzido);
});

/** URL absoluta de um download da API, para usar em `<a href>` sem passar pela memória do navegador. */
export function urlDaApi(caminho: string): string {
  return `/api${caminho}`;
}
