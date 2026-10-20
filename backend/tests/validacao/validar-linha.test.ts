import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOMES_COLUNAS } from '../../src/modules/importacao/validacao/colunas.js';
import { validarLinha, type LinhaBruta } from '../../src/modules/importacao/validacao/validar-linha.js';

const linhaValida: LinhaBruta = {
  cnpj: '1,12346E+13',
  nome_posto: 'Raízen Comércio de Combustíveis Ltda - 002',
  nome_fantasia: 'Posto Oeste',
  bandeira: 'Raízen',
  logradouro: 'Avenida Moraes Salles',
  numero: '137',
  complemento: 'Loja A',
  bairro: 'Jardim Guanabara',
  municipio: 'Campinas',
  uf: 'SP',
  cep: '13010113',
  cpf_responsavel: '12445603404',
  nome_responsavel: 'Carlos Souza Carvalho',
  email_responsavel: 'carlos.carvalho1@grupoabast.com.br',
  cargo_responsavel: 'Supervisor de Operações',
  combustiveis: 'Gasolina Comum,Etanol,Diesel S10,Diesel Comum',
  status: 'ativo',
  data_inauguracao: '01/02/1991',
  numero_bicos: '5',
  numero_pistas: '3',
  observacoes: 'Unidade com maior volume de vendas da bandeira na cidade. ',
};

describe('validarLinha', () => {
  it('normaliza uma linha válida do arquivo de exemplo', () => {
    const resultado = validarLinha(linhaValida);

    expect(resultado.valido).toBe(true);
    if (!resultado.valido) return;
    expect(resultado.posto).toEqual({
      cnpj: '11234600000000',
      razaoSocial: 'Raízen Comércio de Combustíveis Ltda - 002',
      nomeFantasia: 'Posto Oeste',
      bandeira: 'Raízen',
      logradouro: 'Avenida Moraes Salles',
      numero: '137',
      complemento: 'Loja A',
      bairro: 'Jardim Guanabara',
      municipio: 'Campinas',
      uf: 'SP',
      cep: '13010113',
      responsavel: {
        cpf: '12445603404',
        nome: 'Carlos Souza Carvalho',
        email: 'carlos.carvalho1@grupoabast.com.br',
        cargo: 'Supervisor de Operações',
      },
      combustiveis: ['Gasolina Comum', 'Etanol', 'Diesel S10', 'Diesel Comum'],
      status: 'ativo',
      dataInauguracao: '1991-02-01',
      numeroBicos: 5,
      numeroPistas: 3,
      observacoes: 'Unidade com maior volume de vendas da bandeira na cidade.',
    });
    expect(resultado.avisos.map((a) => a.codigo)).toEqual(['CNPJ_NOTACAO_CIENTIFICA']);
  });

  it('transforma campos opcionais vazios em null', () => {
    const resultado = validarLinha({
      ...linhaValida,
      nome_fantasia: '  ',
      complemento: '',
      email_responsavel: undefined,
      data_inauguracao: '',
      numero_bicos: '',
      observacoes: ' ',
    });

    expect(resultado.valido).toBe(true);
    if (!resultado.valido) return;
    expect(resultado.posto).toMatchObject({
      nomeFantasia: null,
      complemento: null,
      dataInauguracao: null,
      numeroBicos: null,
      observacoes: null,
      responsavel: { email: null },
    });
  });

  it('rejeita CEP com 7 dígitos sem completar o zero', () => {
    const resultado = validarLinha({ ...linhaValida, cep: '1310100' });

    expect(resultado.valido).toBe(false);
    if (resultado.valido) return;
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0]).toMatchObject({
      codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS',
      campo: 'cep',
      valorRecebido: '1310100',
    });
  });

  it('coleta todos os erros da linha de uma vez', () => {
    const resultado = validarLinha({
      ...linhaValida,
      cnpj: '',
      uf: 'XX',
      cep: '1310100',
      cpf_responsavel: '1234567890',
      status: 'fechado',
      data_inauguracao: '31/02/2020',
      numero_bicos: '-1',
    });

    expect(resultado.valido).toBe(false);
    if (resultado.valido) return;
    expect(resultado.erros.map((e) => [e.campo, e.codigo])).toEqual([
      ['cnpj', 'CAMPO_OBRIGATORIO'],
      ['uf', 'UF_INVALIDA'],
      ['cep', 'DOCUMENTO_QUANTIDADE_DIGITOS'],
      ['cpf_responsavel', 'DOCUMENTO_QUANTIDADE_DIGITOS'],
      ['status', 'STATUS_INVALIDO'],
      ['data_inauguracao', 'DATA_INEXISTENTE'],
      ['numero_bicos', 'INTEIRO_NEGATIVO'],
    ]);
  });

  it('rejeita texto acima do tamanho máximo da coluna', () => {
    const resultado = validarLinha({ ...linhaValida, numero: '1'.repeat(21) });

    expect(resultado.valido).toBe(false);
    if (resultado.valido) return;
    expect(resultado.erros[0]).toMatchObject({ campo: 'numero', codigo: 'TEXTO_MUITO_LONGO' });
  });
});

describe('arquivo de exemplo do desafio', () => {
  const caminho = fileURLToPath(new URL('../../../samples/modelo-importacao-desafio.csv', import.meta.url));
  const linhas = readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const registros = linhas.slice(1).map((linha, indice) => {
    const valores = linha.split(';');
    const bruta = Object.fromEntries(NOMES_COLUNAS.map((nome, i) => [nome, valores[i] ?? ''])) as LinhaBruta;
    return { numeroLinha: indice + 2, resultado: validarLinha(bruta) };
  });

  it('tem 100 postos', () => {
    expect(registros).toHaveLength(100);
  });

  it('aceita 90 linhas e rejeita 10 só por CEP com 7 dígitos', () => {
    const rejeitadas = registros.filter((r) => !r.resultado.valido);

    expect(registros.length - rejeitadas.length).toBe(90);
    expect(rejeitadas).toHaveLength(10);
    for (const { resultado } of rejeitadas) {
      if (resultado.valido) continue;
      expect(resultado.erros.map((e) => [e.campo, e.codigo])).toEqual([['cep', 'DOCUMENTO_QUANTIDADE_DIGITOS']]);
    }
  });

  it('as linhas rejeitadas são de São Paulo e Guarulhos', () => {
    const municipios = new Set(
      registros
        .filter((r) => !r.resultado.valido)
        .map((r) => linhas[r.numeroLinha - 1]?.split(';')[8]),
    );
    expect([...municipios].sort()).toEqual(['Guarulhos', 'São Paulo']);
  });

  it('converte todos os CNPJs em notação científica para 14 dígitos distintos', () => {
    const cnpjs = registros.flatMap((r) => (r.resultado.valido ? [r.resultado.posto.cnpj] : []));
    expect(cnpjs.every((cnpj) => /^[0-9]{14}$/.test(cnpj))).toBe(true);
    expect(new Set(cnpjs).size).toBe(cnpjs.length);
  });
});
