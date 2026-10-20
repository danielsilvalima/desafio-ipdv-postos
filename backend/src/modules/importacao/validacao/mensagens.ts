import { buscarColuna } from './colunas.js';
import type { Achado, CodigoAviso, CodigoErro, CodigoOcorrencia, Parametros } from './tipos.js';

/** Ocorrência pronta para exibir ao usuário: na tela, no arquivo de correção e no histórico. */
export interface Ocorrencia {
  codigo: CodigoOcorrencia;
  tipo: 'erro' | 'aviso';
  campo: string;
  rotulo: string;
  valorRecebido: string | null;
  titulo: string;
  mensagem: string;
  dica?: string;
}

interface Contexto {
  campo: string;
  rotulo: string;
  valor: string;
  exemplo: string;
  params: Parametros;
}

interface DefinicaoMensagem {
  titulo: (ctx: Contexto) => string;
  mensagem: (ctx: Contexto) => string;
  dica?: (ctx: Contexto) => string | undefined;
}

const EXEMPLOS_DOCUMENTO: Record<string, { digitos: string; mascara: string }> = {
  cnpj: { digitos: '01234567000189', mascara: '01.234.567/0001-89' },
  cpf_responsavel: { digitos: '01234567890', mascara: '012.345.678-90' },
  cep: { digitos: '01310100', mascara: '01310-100' },
};

const DICA_FORMATAR_TEXTO =
  'O Excel costuma apagar o zero do começo quando a coluna está formatada como número.';

function exemploDocumento(ctx: Contexto) {
  return EXEMPLOS_DOCUMENTO[ctx.campo] ?? { digitos: ctx.exemplo, mascara: ctx.exemplo };
}

const ERROS: Record<CodigoErro, DefinicaoMensagem> = {
  CAMPO_OBRIGATORIO: {
    titulo: (c) => `${c.rotulo} não preenchido`,
    mensagem: (c) => `O campo ${c.rotulo} é obrigatório e está vazio.`,
    dica: (c) => `Preencha a coluna "${c.campo}". Exemplo: ${c.exemplo}.`,
  },
  TEXTO_MUITO_LONGO: {
    titulo: (c) => `${c.rotulo} acima do tamanho máximo`,
    mensagem: (c) =>
      c.params.item
        ? `O item "${c.params.item}" de ${c.rotulo} tem ${c.params.tamanho} caracteres; o máximo é ${c.params.maximo}.`
        : `${c.rotulo} tem ${c.params.tamanho} caracteres; o máximo é ${c.params.maximo}.`,
    dica: () => 'Abrevie o texto ou confira se o conteúdo de outra coluna não foi colado nesta.',
  },
  DOCUMENTO_QUANTIDADE_DIGITOS: {
    titulo: (c) => `${c.rotulo} com quantidade de números errada`,
    mensagem: (c) =>
      `O ${c.rotulo} deve ter ${c.params.esperados} números. Recebido: "${c.valor}" (${c.params.recebidos} números).`,
    dica: (c) => {
      const { digitos, mascara } = exemploDocumento(c);
      if (Number(c.params.recebidos) < Number(c.params.esperados)) {
        return `${DICA_FORMATAR_TEXTO} Formate a coluna como Texto e digite o ${c.rotulo} completo, por exemplo ${digitos}, ou use a máscara ${mascara}.`;
      }
      return `Confira se não há números a mais ou colados de outra célula. Exemplo correto: ${digitos} ou ${mascara}.`;
    },
  },
  DOCUMENTO_CARACTERES_INVALIDOS: {
    titulo: (c) => `${c.rotulo} com caracteres inválidos`,
    mensagem: (c) =>
      `O ${c.rotulo} deve conter apenas números (a máscara com ponto, barra e hífen é aceita). Recebido: "${c.valor}".`,
    dica: (c) => {
      const { digitos, mascara } = exemploDocumento(c);
      return `Remova letras e outros símbolos. Exemplo: ${digitos} ou ${mascara}.`;
    },
  },
  DOCUMENTO_ZERADO: {
    titulo: (c) => `${c.rotulo} formado só por zeros`,
    mensagem: (c) => `O ${c.rotulo} não pode ser formado só por zeros. Recebido: "${c.valor}".`,
    dica: (c) => `Informe o ${c.rotulo} verdadeiro.`,
  },
  DOCUMENTO_NOTACAO_CIENTIFICA: {
    titulo: (c) => `${c.rotulo} em notação científica`,
    mensagem: (c) =>
      `O ${c.rotulo} está em notação científica ("${c.valor}"). Isso acontece quando o Excel trata a coluna como número, e nesse formato parte dos dígitos se perde.`,
    dica: (c) => `Formate a coluna como Texto e digite o ${c.rotulo} completo, por exemplo ${exemploDocumento(c).digitos}.`,
  },
  UF_INVALIDA: {
    titulo: () => 'UF inválida',
    mensagem: (c) => `"${c.valor}" não é uma sigla de estado válida.`,
    dica: () => 'Use a sigla com 2 letras, por exemplo SP, RJ ou MG.',
  },
  EMAIL_INVALIDO: {
    titulo: (c) => `${c.rotulo} inválido`,
    mensagem: (c) => `"${c.valor}" não é um e-mail válido.`,
    dica: () => 'Use o formato nome@empresa.com.br ou deixe a coluna vazia, porque o e-mail é opcional.',
  },
  DATA_FORMATO_INVALIDO: {
    titulo: (c) => `${c.rotulo} em formato não reconhecido`,
    mensagem: (c) =>
      c.params.motivo === 'ano_dois_digitos'
        ? `"${c.valor}" tem o ano com 2 dígitos, o que deixa a data ambígua.`
        : `"${c.valor}" não é uma data reconhecida.`,
    dica: () => 'Use o formato dd/mm/aaaa, com ano de 4 dígitos, por exemplo 25/03/2015.',
  },
  DATA_INEXISTENTE: {
    titulo: (c) => `${c.rotulo} inexistente`,
    mensagem: (c) => `A data "${c.valor}" não existe no calendário.`,
    dica: () => 'Confira o dia e o mês. Use o formato dd/mm/aaaa, por exemplo 28/02/2020.',
  },
  DATA_FORA_DO_PERIODO: {
    titulo: (c) => `${c.rotulo} fora do período aceito`,
    mensagem: (c) =>
      `A data "${c.valor}" está fora do período aceito (anos de ${c.params.anoMinimo} a ${c.params.anoMaximo}).`,
    dica: () => 'Confira se o ano foi digitado corretamente.',
  },
  INTEIRO_INVALIDO: {
    titulo: (c) => `${c.rotulo} não é um número inteiro`,
    mensagem: (c) =>
      c.params.motivo === 'muito_grande'
        ? `${c.rotulo} tem um valor alto demais: "${c.valor}".`
        : `${c.rotulo} deve ser um número inteiro. Recebido: "${c.valor}".`,
    dica: (c) => `Use só números, sem casas decimais, por exemplo ${c.exemplo}.`,
  },
  INTEIRO_NEGATIVO: {
    titulo: (c) => `${c.rotulo} negativo`,
    mensagem: (c) => `${c.rotulo} não pode ser negativo. Recebido: "${c.valor}".`,
    dica: () => 'Informe 0 ou um número positivo.',
  },
  STATUS_INVALIDO: {
    titulo: () => 'Status inválido',
    mensagem: (c) => `"${c.valor}" não é um status válido.`,
    dica: () => 'Use um destes valores: ativo, inativo ou em_implantacao.',
  },
  LINHA_COLUNAS_A_MAIS: {
    titulo: () => 'Linha com mais colunas que o cabeçalho',
    mensagem: (c) =>
      `A linha tem ${c.params.recebidas} colunas, mas o cabeçalho tem ${c.params.esperadas}. Os valores ficaram deslocados e a linha não pôde ser lida.`,
    dica: (c) =>
      `Provavelmente algum campo contém "${c.params.delimitador}" sem estar entre aspas. Remova o caractere ou coloque o texto entre aspas.`,
  },
};

const AVISOS: Record<CodigoAviso, DefinicaoMensagem> = {
  CNPJ_NOTACAO_CIENTIFICA: {
    titulo: () => 'CNPJ em notação científica convertido',
    mensagem: (c) =>
      `O CNPJ estava em notação científica ("${c.valor}") e foi convertido para ${c.params.convertido}. Parte dos dígitos pode ter se perdido no Excel.`,
    dica: () => 'Confira o CNPJ deste posto. Para evitar, formate a coluna como Texto antes de salvar a planilha.',
  },
  COMBUSTIVEL_REPETIDO: {
    titulo: () => 'Combustível repetido na lista',
    mensagem: (c) => `O combustível "${c.params.nome}" aparece mais de uma vez na lista e foi considerado uma vez só.`,
  },
  CNPJ_DUPLICADO_NO_ARQUIVO: {
    titulo: () => 'CNPJ repetido no arquivo',
    mensagem: (c) =>
      `Este CNPJ aparece de novo na linha ${c.params.linhaMantida}. Foi mantida a última ocorrência (linha ${c.params.linhaMantida}) e esta linha foi ignorada.`,
    dica: () => 'Se forem postos diferentes, corrija o CNPJ de um deles. Se for o mesmo posto, remova a linha repetida.',
  },
  RESPONSAVEL_DIVERGENTE: {
    titulo: () => 'Responsável com dados diferentes no arquivo',
    mensagem: (c) =>
      `O CPF ${c.valor} aparece com dados diferentes em outras linhas (${c.params.campos}). Prevaleceram os dados da linha ${c.params.linhaMantida}.`,
    dica: () => 'Use os mesmos nome, e-mail e cargo em todas as linhas do mesmo responsável.',
  },
  COLUNA_DESCONHECIDA: {
    titulo: () => 'Coluna fora do modelo ignorada',
    mensagem: (c) => `A coluna "${c.valor}" não faz parte do modelo e foi ignorada.`,
  },
  COLUNA_OPCIONAL_AUSENTE: {
    titulo: () => 'Coluna opcional ausente',
    mensagem: (c) => `O arquivo não tem a coluna "${c.campo}" (${c.rotulo}). Esse campo ficou vazio em todos os postos.`,
    dica: () => 'Se quiser preencher esse campo, inclua a coluna com o nome exato do modelo.',
  },
};

export const CATALOGO_MENSAGENS: Record<CodigoOcorrencia, DefinicaoMensagem> = { ...ERROS, ...AVISOS };

export function ehCodigoDeErro(codigo: CodigoOcorrencia): codigo is CodigoErro {
  return codigo in ERROS;
}

export function montarOcorrencia(achado: Achado, campo: string, valorRecebido: string | null): Ocorrencia {
  const coluna = buscarColuna(campo);
  const contexto: Contexto = {
    campo,
    rotulo: coluna?.rotulo ?? campo,
    valor: (valorRecebido ?? '').trim(),
    exemplo: coluna?.exemplo ?? '',
    params: achado.params ?? {},
  };
  const definicao = CATALOGO_MENSAGENS[achado.codigo];
  const dica = definicao.dica?.(contexto);

  return {
    codigo: achado.codigo,
    tipo: ehCodigoDeErro(achado.codigo) ? 'erro' : 'aviso',
    campo,
    rotulo: contexto.rotulo,
    valorRecebido,
    titulo: definicao.titulo(contexto),
    mensagem: definicao.mensagem(contexto),
    ...(dica ? { dica } : {}),
  };
}
