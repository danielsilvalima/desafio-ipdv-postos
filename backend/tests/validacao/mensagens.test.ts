import { describe, expect, it } from 'vitest';
import {
  CATALOGO_MENSAGENS,
  ehCodigoDeErro,
  montarOcorrencia,
} from '../../src/modules/importacao/validacao/mensagens.js';
import type { CodigoOcorrencia } from '../../src/modules/importacao/validacao/tipos.js';

// Todos os parâmetros que algum código do catálogo usa.
const PARAMETROS_COMPLETOS = {
  recebidos: 7,
  esperados: 8,
  tamanho: 250,
  maximo: 200,
  anoMinimo: 1900,
  anoMaximo: 2100,
  permitidos: 'ativo, inativo, em_implantacao',
  convertido: '10234600000000',
  nome: 'Etanol',
  linhaMantida: 12,
  campos: 'nome, e-mail',
};

describe('catálogo de mensagens', () => {
  const codigos = Object.keys(CATALOGO_MENSAGENS) as CodigoOcorrencia[];

  it.each(codigos)('%s gera título e mensagem preenchidos', (codigo) => {
    const ocorrencia = montarOcorrencia({ codigo, params: PARAMETROS_COMPLETOS }, 'cep', '1310100');
    expect(ocorrencia.titulo.length).toBeGreaterThan(0);
    expect(ocorrencia.mensagem.length).toBeGreaterThan(0);
    expect(`${ocorrencia.titulo} ${ocorrencia.mensagem} ${ocorrencia.dica ?? ''}`).not.toContain('undefined');
  });

  it.each(codigos.filter(ehCodigoDeErro))('o erro %s sempre traz uma dica de correção', (codigo) => {
    const ocorrencia = montarOcorrencia({ codigo, params: PARAMETROS_COMPLETOS }, 'cep', '1310100');
    expect(ocorrencia.tipo).toBe('erro');
    expect(ocorrencia.dica).toBeTruthy();
  });
});

describe('mensagens de documento com zeros faltando', () => {
  it('CEP com 7 dígitos explica a causa e mostra o exemplo correto', () => {
    const ocorrencia = montarOcorrencia(
      { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 7, esperados: 8 } },
      'cep',
      '1310100',
    );
    expect(ocorrencia).toMatchObject({
      campo: 'cep',
      rotulo: 'CEP',
      valorRecebido: '1310100',
      titulo: 'CEP com quantidade de números errada',
      mensagem: 'O CEP deve ter 8 números. Recebido: "1310100" (7 números).',
    });
    expect(ocorrencia.dica).toContain('formatada como número');
    expect(ocorrencia.dica).toContain('01310100');
    expect(ocorrencia.dica).toContain('01310-100');
  });

  it('CNPJ com 13 dígitos sugere a máscara de CNPJ', () => {
    const ocorrencia = montarOcorrencia(
      { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 13, esperados: 14 } },
      'cnpj',
      '1234567000189',
    );
    expect(ocorrencia.mensagem).toBe('O CNPJ deve ter 14 números. Recebido: "1234567000189" (13 números).');
    expect(ocorrencia.dica).toContain('01.234.567/0001-89');
  });

  it('documento com dígitos a mais não fala de zero apagado', () => {
    const ocorrencia = montarOcorrencia(
      { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 12, esperados: 11 } },
      'cpf_responsavel',
      '012345678901',
    );
    expect(ocorrencia.rotulo).toBe('CPF do responsável');
    expect(ocorrencia.dica).toContain('números a mais');
    expect(ocorrencia.dica).not.toContain('zero');
  });
});

describe('avisos', () => {
  it('são marcados como aviso e não como erro', () => {
    const ocorrencia = montarOcorrencia(
      { codigo: 'CNPJ_NOTACAO_CIENTIFICA', params: { convertido: '10234600000000' } },
      'cnpj',
      '1,02346E+13',
    );
    expect(ocorrencia.tipo).toBe('aviso');
    expect(ocorrencia.mensagem).toContain('10234600000000');
  });

  it('aceitam campos fora do modelo, como colunas desconhecidas', () => {
    const ocorrencia = montarOcorrencia({ codigo: 'COLUNA_DESCONHECIDA' }, 'coluna_extra', 'coluna_extra');
    expect(ocorrencia.rotulo).toBe('coluna_extra');
    expect(ocorrencia.mensagem).toBe('A coluna "coluna_extra" não faz parte do modelo e foi ignorada.');
  });
});
