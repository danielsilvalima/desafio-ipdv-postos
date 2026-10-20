import { NOMES_COLUNAS, type NomeColuna } from '../src/modules/importacao/validacao/colunas.js';
import { mascararCep, mascararCnpj, mascararCpf } from '../src/shared/formatacao/documentos.js';

export type LinhaGerada = Record<NomeColuna, string>;

export interface OpcoesGerador {
  /** Fração das linhas que recebe um erro proposital (0 a 1), para demonstrar a correção guiada. */
  fracaoComErro?: number;
  semente?: number;
}

const BANDEIRAS = ['Petrobras', 'Ipiranga', 'Shell', 'Raízen', 'Vibra Energia', 'Alesat', 'Total', 'Repsol', 'Bandeirante', 'Branca'];
const COMBUSTIVEIS = ['Gasolina Aditivada', 'Etanol', 'Diesel S10', 'Diesel Comum', 'GNV', 'Arla 32'];
const CARGOS = ['Gerente de Posto', 'Gerente Geral', 'Supervisor de Operações', 'Coordenador Regional', ''];
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Heitor', 'Íris', 'João', 'Larissa', 'Márcio'];
const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Pereira', 'Lima', 'Gonçalves', 'Araújo', 'Ribeiro', 'Conceição', 'Moraes'];
const FANTASIAS = ['Posto Central', 'Posto da Vila', 'Auto Posto Estrela', 'Posto Boa Viagem', 'Posto São Jorge', ''];
const LOGRADOUROS = ['Avenida Brasil', 'Rua das Flores', 'Rodovia BR-116', 'Avenida Getúlio Vargas', 'Rua XV de Novembro'];

/** CEPs de São Paulo começam com 0: geram documentos com zero à esquerda de propósito. */
const MUNICIPIOS = [
  { municipio: 'São Paulo', uf: 'SP', bairro: 'Bela Vista', faixaCep: '01' },
  { municipio: 'Guarulhos', uf: 'SP', bairro: 'Macedo', faixaCep: '07' },
  { municipio: 'Campinas', uf: 'SP', bairro: 'Cambuí', faixaCep: '13' },
  { municipio: 'Rio de Janeiro', uf: 'RJ', bairro: 'Tijuca', faixaCep: '20' },
  { municipio: 'Belo Horizonte', uf: 'MG', bairro: 'Savassi', faixaCep: '30' },
  { municipio: 'Salvador', uf: 'BA', bairro: 'Barra', faixaCep: '40' },
  { municipio: 'Recife', uf: 'PE', bairro: 'Boa Viagem', faixaCep: '51' },
  { municipio: 'Fortaleza', uf: 'CE', bairro: 'Aldeota', faixaCep: '60' },
  { municipio: 'Brasília', uf: 'DF', bairro: 'Asa Sul', faixaCep: '70' },
  { municipio: 'Curitiba', uf: 'PR', bairro: 'Batel', faixaCep: '80' },
  { municipio: 'Florianópolis', uf: 'SC', bairro: 'Centro', faixaCep: '88' },
  { municipio: 'Porto Alegre', uf: 'RS', bairro: 'Moinhos de Vento', faixaCep: '90' },
];

const OBSERVACOES = [
  '',
  'Atende frota corporativa.',
  'Loja de conveniência 24h; lava-rápido aos sábados.',
  'Possui "troca de óleo" e calibragem gratuita.',
  'Reforma prevista.\nAtendimento parcial durante a obra.',
];

/** Erros que um usuário comete de verdade na planilha. */
const ERROS: ((linha: LinhaGerada) => void)[] = [
  (l) => {
    const digitos = l.cep.replace(/\D/g, '');
    l.cep = digitos.startsWith('0') ? digitos.slice(1) : digitos.slice(0, 7);
  },
  (l) => { l.uf = 'XX'; },
  (l) => { l.data_inauguracao = '31/02/2020'; },
  (l) => { l.cnpj = l.cnpj.replace(/\D/g, '').slice(1); },
  (l) => { l.email_responsavel = 'email-sem-arroba.com'; },
  (l) => { l.status = 'fechado'; },
  (l) => { l.numero_bicos = '-2'; },
  (l) => { l.bandeira = ''; },
];

/** PRNG determinístico (mulberry32): a mesma semente gera sempre o mesmo arquivo. */
function criarAleatorio(semente: number) {
  let estado = semente >>> 0;
  const proximo = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inteiro = (min: number, max: number) => min + Math.floor(proximo() * (max - min + 1));
  const item = <T>(lista: readonly T[]) => lista[inteiro(0, lista.length - 1)]!;
  return { proximo, inteiro, item };
}

function digitoModulo11(digitos: string, pesos: number[]): string {
  const soma = pesos.reduce((total, peso, i) => total + peso * Number(digitos[i]), 0);
  const resto = soma % 11;
  return resto < 2 ? '0' : String(11 - resto);
}

/** CNPJs válidos e distintos; os primeiros têm vários zeros à esquerda. */
export function cnpjDoIndice(indice: number): string {
  const base = String(indice).padStart(8, '0') + '0001';
  const primeiro = digitoModulo11(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base + primeiro + digitoModulo11(base + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}

export function cpfDoIndice(indice: number): string {
  const base = String(indice).padStart(9, '0');
  const digito = (parcial: string) => {
    const soma = [...parcial].reduce((total, d, i) => total + Number(d) * (parcial.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? '0' : String(resto);
  };
  const primeiro = digito(base);
  return base + primeiro + digito(base + primeiro);
}

/**
 * Gera postos fictícios no formato do contrato, um por vez (não monta a lista inteira em memória).
 * Cada responsável cuida de até 5 postos, sempre com os mesmos dados, para não gerar avisos de divergência.
 */
export function* gerarPostos(quantidade: number, opcoes: OpcoesGerador = {}): Generator<LinhaGerada> {
  const aleatorio = criarAleatorio(opcoes.semente ?? 2026);
  const fracaoComErro = opcoes.fracaoComErro ?? 0;

  for (let i = 1; i <= quantidade; i++) {
    const indiceResponsavel = Math.ceil(i / 5);
    const nome = `${NOMES[indiceResponsavel % NOMES.length]} ${SOBRENOMES[(indiceResponsavel * 7) % SOBRENOMES.length]}`;
    const local = aleatorio.item(MUNICIPIOS);
    const bandeira = aleatorio.item(BANDEIRAS);
    const cep = local.faixaCep + String(aleatorio.inteiro(0, 999_999)).padStart(6, '0');
    const comMascara = i % 2 === 0;
    const extras = COMBUSTIVEIS.filter(() => aleatorio.proximo() < 0.5);
    const sorteioStatus = aleatorio.proximo();

    const linha: LinhaGerada = {
      cnpj: comMascara ? mascararCnpj(cnpjDoIndice(i)) : cnpjDoIndice(i),
      nome_posto: `${bandeira} Comércio de Combustíveis Ltda - ${String(i).padStart(5, '0')}`,
      nome_fantasia: aleatorio.item(FANTASIAS),
      bandeira,
      logradouro: aleatorio.item(LOGRADOUROS),
      numero: aleatorio.proximo() < 0.05 ? 'S/N' : String(aleatorio.inteiro(1, 9999)),
      complemento: aleatorio.proximo() < 0.3 ? `Km ${aleatorio.inteiro(1, 500)}` : '',
      bairro: local.bairro,
      municipio: local.municipio,
      uf: local.uf,
      cep: comMascara ? mascararCep(cep) : cep,
      cpf_responsavel: comMascara ? mascararCpf(cpfDoIndice(indiceResponsavel)) : cpfDoIndice(indiceResponsavel),
      nome_responsavel: nome,
      email_responsavel: `responsavel${indiceResponsavel}@grupoabast.com.br`,
      cargo_responsavel: CARGOS[indiceResponsavel % CARGOS.length]!,
      combustiveis: ['Gasolina Comum', ...extras].join(','),
      status: sorteioStatus < 0.8 ? 'ativo' : sorteioStatus < 0.9 ? 'inativo' : 'em_implantacao',
      data_inauguracao:
        aleatorio.proximo() < 0.1
          ? ''
          : `${String(aleatorio.inteiro(1, 28)).padStart(2, '0')}/${String(aleatorio.inteiro(1, 12)).padStart(2, '0')}/${aleatorio.inteiro(1970, 2025)}`,
      numero_bicos: String(aleatorio.inteiro(2, 16)),
      numero_pistas: String(aleatorio.inteiro(1, 8)),
      observacoes: aleatorio.item(OBSERVACOES),
    };

    if (aleatorio.proximo() < fracaoComErro) aleatorio.item(ERROS)(linha);
    yield linha;
  }
}

export function valoresNaOrdem(linha: LinhaGerada): string[] {
  return NOMES_COLUNAS.map((coluna) => linha[coluna]);
}
