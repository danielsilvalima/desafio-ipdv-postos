import { buscarColuna, type NomeColuna } from './colunas.js';
import { normalizarData } from './datas.js';
import { normalizarDocumento } from './documentos.js';
import {
  normalizarEmail,
  normalizarStatus,
  normalizarUf,
  separarCombustiveis,
  type StatusPosto,
  type Uf,
} from './dominio.js';
import { montarOcorrencia, type Ocorrencia } from './mensagens.js';
import { normalizarInteiroNaoNegativo } from './numeros.js';
import { ajustarCaixa, limparTexto } from './texto.js';
import { falha, sucesso, type ResultadoCampo } from './tipos.js';

export type LinhaBruta = Partial<Record<NomeColuna, string>>;

export interface PostoNormalizado {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  bandeira: string;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: Uf;
  cep: string;
  responsavel: {
    cpf: string;
    nome: string;
    email: string | null;
    cargo: string | null;
  };
  combustiveis: string[];
  status: StatusPosto;
  dataInauguracao: string | null;
  numeroBicos: number | null;
  numeroPistas: number | null;
  observacoes: string | null;
}

export type ResultadoLinha =
  | { valido: true; posto: PostoNormalizado; avisos: Ocorrencia[] }
  | { valido: false; erros: Ocorrencia[]; avisos: Ocorrencia[] };

function textoLivre(valor: string): ResultadoCampo<string> {
  return sucesso(valor);
}

/** Nomes de lugar e de pessoa. Razão social e logradouro ficam fora por causa de siglas ("LTDA", "SHN Quadra 2"). */
function nomeProprio(valor: string): ResultadoCampo<string> {
  return sucesso(ajustarCaixa(valor));
}

/**
 * Valida e normaliza uma linha do CSV. Coleta todos os erros da linha (não para no primeiro),
 * para que o usuário corrija tudo de uma vez.
 */
export function validarLinha(linha: LinhaBruta): ResultadoLinha {
  const erros: Ocorrencia[] = [];
  const avisos: Ocorrencia[] = [];

  function campo<T>(nome: NomeColuna, normalizar: (valor: string) => ResultadoCampo<T>): T | null {
    const coluna = buscarColuna(nome);
    const original = linha[nome] ?? '';
    const texto = limparTexto(original);

    if (texto === null) {
      if (coluna?.obrigatoria) erros.push(montarOcorrencia({ codigo: 'CAMPO_OBRIGATORIO' }, nome, original));
      return null;
    }

    const maximo = coluna?.tamanhoMaximo;
    const resultado =
      maximo && texto.length > maximo
        ? falha<T>('TEXTO_MUITO_LONGO', { tamanho: texto.length, maximo })
        : normalizar(texto);

    if (!resultado.ok) {
      erros.push(montarOcorrencia(resultado.erro, nome, original));
      return null;
    }
    for (const aviso of resultado.avisos) avisos.push(montarOcorrencia(aviso, nome, original));
    return resultado.valor;
  }

  const cnpj = campo('cnpj', (v) => normalizarDocumento('cnpj', v));
  const razaoSocial = campo('nome_posto', textoLivre);
  const nomeFantasia = campo('nome_fantasia', textoLivre);
  const bandeira = campo('bandeira', textoLivre);
  const logradouro = campo('logradouro', textoLivre);
  const numero = campo('numero', textoLivre);
  const complemento = campo('complemento', textoLivre);
  const bairro = campo('bairro', nomeProprio);
  const municipio = campo('municipio', nomeProprio);
  const uf = campo('uf', normalizarUf);
  const cep = campo('cep', (v) => normalizarDocumento('cep', v));
  const cpf = campo('cpf_responsavel', (v) => normalizarDocumento('cpf', v));
  const nomeResponsavel = campo('nome_responsavel', nomeProprio);
  const email = campo('email_responsavel', normalizarEmail);
  const cargo = campo('cargo_responsavel', nomeProprio);
  const combustiveis = campo('combustiveis', separarCombustiveis);
  const status = campo('status', normalizarStatus);
  const dataInauguracao = campo('data_inauguracao', normalizarData);
  const numeroBicos = campo('numero_bicos', normalizarInteiroNaoNegativo);
  const numeroPistas = campo('numero_pistas', normalizarInteiroNaoNegativo);
  const observacoes = campo('observacoes', textoLivre);

  if (erros.length > 0) {
    return { valido: false, erros, avisos };
  }

  // Sem erros, todos os campos obrigatórios estão preenchidos.
  return {
    valido: true,
    avisos,
    posto: {
      cnpj: cnpj!,
      razaoSocial: razaoSocial!,
      nomeFantasia,
      bandeira: bandeira!,
      logradouro: logradouro!,
      numero,
      complemento,
      bairro: bairro!,
      municipio: municipio!,
      uf: uf!,
      cep: cep!,
      responsavel: { cpf: cpf!, nome: nomeResponsavel!, email, cargo },
      combustiveis: combustiveis!,
      status: status!,
      dataInauguracao,
      numeroBicos,
      numeroPistas,
      observacoes,
    },
  };
}
