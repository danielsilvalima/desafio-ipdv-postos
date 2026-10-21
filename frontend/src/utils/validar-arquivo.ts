/** Igual ao limite do upload no backend (backend/src/modules/importacao/importacao.routes.ts). */
export const TAMANHO_MAXIMO_MB = 20;
const TAMANHO_MAXIMO_BYTES = TAMANHO_MAXIMO_MB * 1024 * 1024;

/** ".txt" é como o Excel salva "Texto (separado por tabulação)", formato que o backend também lê. */
const EXTENSOES_ACEITAS = ['.csv', '.txt'];
const EXTENSOES_EXCEL = ['.xlsx', '.xls', '.xlsm'];

export interface ProblemaArquivo {
  mensagem: string;
  dica: string;
}

function extensao(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto >= 0 ? nome.slice(ponto).toLowerCase() : '';
}

function emMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');
}

/**
 * Checagem rápida antes do envio, para não gastar o upload com um arquivo que será recusado.
 * Usa a extensão e não o tipo informado pelo navegador: no Windows com Excel instalado, um .csv
 * chega como "application/vnd.ms-excel". O backend continua conferindo o conteúdo do arquivo.
 */
export function validarArquivo(arquivo: File): ProblemaArquivo | null {
  const ext = extensao(arquivo.name);

  if (EXTENSOES_EXCEL.includes(ext)) {
    return {
      mensagem: 'O arquivo é uma planilha do Excel, não um CSV.',
      dica: 'No Excel, use Arquivo > Salvar como e escolha o tipo "CSV UTF-8 (delimitado por vírgulas)". Depois importe o arquivo .csv gerado.',
    };
  }
  if (!EXTENSOES_ACEITAS.includes(ext)) {
    return {
      mensagem: ext ? `Arquivos ${ext} não são aceitos.` : 'O arquivo não tem extensão.',
      dica: 'Envie o arquivo .csv da planilha de postos.',
    };
  }
  if (arquivo.size === 0) {
    return {
      mensagem: 'O arquivo está vazio.',
      dica: 'Confira se você selecionou o arquivo certo e se ele foi salvo com os dados.',
    };
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return {
      mensagem: `O arquivo tem ${emMb(arquivo.size)} MB e o limite é ${TAMANHO_MAXIMO_MB} MB.`,
      dica: 'Divida a planilha em arquivos menores e importe um de cada vez.',
    };
  }
  return null;
}
