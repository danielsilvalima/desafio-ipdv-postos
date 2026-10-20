import type {
  ErroArquivoRegistrado,
  ImportacaoRegistro,
  LinhaRejeitadaRegistro,
  NovosCadastros,
  StatusImportacao,
} from './importacao.repository.js';
import type { OcorrenciaNaLinha } from './preparar-importacao.js';
import type { CodigoOcorrencia } from './validacao/tipos.js';

/** Ocorrências do mesmo tipo, na mesma coluna e com a mesma dica: o usuário corrige o grupo de uma vez. */
export interface GrupoOcorrencias {
  codigo: CodigoOcorrencia;
  tipo: 'erro' | 'aviso';
  campo: string;
  rotulo: string;
  titulo: string;
  dica?: string;
  quantidade: number;
  linhas: number[];
}

export interface RelatorioImportacao {
  id: number;
  nomeArquivo: string;
  status: StatusImportacao;
  criadaEm: Date;
  finalizadaEm: Date | null;
  totais: {
    linhas: number;
    inseridos: number;
    atualizados: number;
    rejeitados: number;
    ignorados: number;
    avisos: number;
  };
  novosCadastros: NovosCadastros;
  erroArquivo: ErroArquivoRegistrado | null;
  gruposErros: GrupoOcorrencias[];
  gruposAvisos: GrupoOcorrencias[];
  erros: OcorrenciaNaLinha[];
  avisos: OcorrenciaNaLinha[];
}

export function agruparOcorrencias(ocorrencias: OcorrenciaNaLinha[]): GrupoOcorrencias[] {
  const grupos = new Map<string, GrupoOcorrencias>();

  for (const ocorrencia of ocorrencias) {
    const chave = `${ocorrencia.codigo}|${ocorrencia.campo}|${ocorrencia.dica ?? ''}`;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = {
        codigo: ocorrencia.codigo,
        tipo: ocorrencia.tipo,
        campo: ocorrencia.campo,
        rotulo: ocorrencia.rotulo,
        titulo: ocorrencia.titulo,
        ...(ocorrencia.dica ? { dica: ocorrencia.dica } : {}),
        quantidade: 0,
        linhas: [],
      };
      grupos.set(chave, grupo);
    }
    grupo.quantidade += 1;
    if (!grupo.linhas.includes(ocorrencia.linha)) grupo.linhas.push(ocorrencia.linha);
  }

  return [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade || a.linhas[0]! - b.linhas[0]!);
}

export function montarRelatorio(
  importacao: ImportacaoRegistro,
  linhasRejeitadas: LinhaRejeitadaRegistro[],
): RelatorioImportacao {
  const erros = linhasRejeitadas.flatMap(({ linha, erros: errosDaLinha }) =>
    errosDaLinha.map((erro) => ({ ...erro, linha })),
  );

  return {
    id: importacao.id,
    nomeArquivo: importacao.nomeArquivo,
    status: importacao.status,
    criadaEm: importacao.criadaEm,
    finalizadaEm: importacao.finalizadaEm,
    totais: {
      linhas: importacao.totalLinhas,
      inseridos: importacao.inseridos,
      atualizados: importacao.atualizados,
      rejeitados: importacao.rejeitados,
      ignorados: importacao.ignorados,
      avisos: importacao.totalAvisos,
    },
    novosCadastros: importacao.novosCadastros,
    erroArquivo: importacao.erroArquivo,
    gruposErros: agruparOcorrencias(erros),
    gruposAvisos: agruparOcorrencias(importacao.avisos),
    erros,
    avisos: importacao.avisos,
  };
}
