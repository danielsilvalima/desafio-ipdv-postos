import { describe, expect, it } from 'vitest';
import {
  cnpjTemDigitosVerificadoresValidos,
  cpfTemDigitosVerificadoresValidos,
  expandirNotacaoCientifica,
  normalizarDocumento,
} from '../../src/modules/importacao/validacao/documentos.js';

describe('CNPJ', () => {
  it('aceita 14 dígitos sem máscara, inclusive começando com zero', () => {
    expect(normalizarDocumento('cnpj', '01234567000189')).toEqual({ ok: true, valor: '01234567000189', avisos: [] });
  });

  it('aceita CNPJ com máscara e espaços nas pontas', () => {
    const resultado = normalizarDocumento('cnpj', '  01.234.567/0001-89 ');
    expect(resultado).toMatchObject({ ok: true, valor: '01234567000189' });
  });

  it('remove o apóstrofo que o Excel usa para forçar texto', () => {
    expect(normalizarDocumento('cnpj', "'01234567000189")).toMatchObject({ ok: true, valor: '01234567000189' });
  });

  it('rejeita 13 dígitos sem completar zeros à esquerda', () => {
    expect(normalizarDocumento('cnpj', '1234567000189')).toEqual({
      ok: false,
      erro: { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 13, esperados: 14 } },
    });
  });

  it('rejeita mais de 14 dígitos', () => {
    expect(normalizarDocumento('cnpj', '123456780001899')).toMatchObject({
      ok: false,
      erro: { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 15 } },
    });
  });

  it('expande a notação científica com vírgula e gera aviso', () => {
    expect(normalizarDocumento('cnpj', '1,02346E+13')).toEqual({
      ok: true,
      valor: '10234600000000',
      avisos: [{ codigo: 'CNPJ_NOTACAO_CIENTIFICA', params: { convertido: '10234600000000' } }],
    });
  });

  it('expande a notação científica com ponto e sem sinal de +', () => {
    expect(normalizarDocumento('cnpj', '1.02346e13')).toMatchObject({ ok: true, valor: '10234600000000' });
  });

  it('rejeita notação científica que não resulta em número inteiro', () => {
    expect(normalizarDocumento('cnpj', '1,234567E+2')).toMatchObject({
      ok: false,
      erro: { codigo: 'DOCUMENTO_NOTACAO_CIENTIFICA' },
    });
  });

  it('rejeita sequência só de zeros', () => {
    expect(normalizarDocumento('cnpj', '00000000000000')).toMatchObject({ ok: false, erro: { codigo: 'DOCUMENTO_ZERADO' } });
  });

  it('rejeita letras e símbolos fora da máscara', () => {
    expect(normalizarDocumento('cnpj', '01234567A00189')).toMatchObject({
      ok: false,
      erro: { codigo: 'DOCUMENTO_CARACTERES_INVALIDOS' },
    });
  });

  it('não confere dígito verificador na importação (dados fictícios)', () => {
    expect(cnpjTemDigitosVerificadoresValidos('10234600000000')).toBe(false);
    expect(normalizarDocumento('cnpj', '10234600000000')).toMatchObject({ ok: true });
  });
});

describe('CPF', () => {
  it('aceita 11 dígitos com e sem máscara, inclusive começando com zero', () => {
    expect(normalizarDocumento('cpf', '01234567890')).toMatchObject({ ok: true, valor: '01234567890' });
    expect(normalizarDocumento('cpf', '012.345.678-90')).toMatchObject({ ok: true, valor: '01234567890' });
  });

  it('rejeita 10 dígitos sem completar zeros à esquerda', () => {
    expect(normalizarDocumento('cpf', '1234567890')).toEqual({
      ok: false,
      erro: { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 10, esperados: 11 } },
    });
  });

  it('rejeita mais de 11 dígitos', () => {
    expect(normalizarDocumento('cpf', '012345678901')).toMatchObject({
      ok: false,
      erro: { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 12 } },
    });
  });

  it('não aceita notação científica, porque os dígitos já se perderam', () => {
    expect(normalizarDocumento('cpf', '1,23456E+10')).toMatchObject({
      ok: false,
      erro: { codigo: 'DOCUMENTO_NOTACAO_CIENTIFICA' },
    });
  });

  it('rejeita sequência só de zeros', () => {
    expect(normalizarDocumento('cpf', '000.000.000-00')).toMatchObject({ ok: false, erro: { codigo: 'DOCUMENTO_ZERADO' } });
  });

  it('não confere dígito verificador na importação (dados fictícios)', () => {
    expect(cpfTemDigitosVerificadoresValidos('01234567891')).toBe(false);
    expect(normalizarDocumento('cpf', '01234567891')).toMatchObject({ ok: true });
  });
});

describe('CEP', () => {
  it('aceita 8 dígitos com e sem máscara', () => {
    expect(normalizarDocumento('cep', '01310100')).toMatchObject({ ok: true, valor: '01310100' });
    expect(normalizarDocumento('cep', '01310-100')).toMatchObject({ ok: true, valor: '01310100' });
    expect(normalizarDocumento('cep', '01.310-100')).toMatchObject({ ok: true, valor: '01310100' });
  });

  it('rejeita 7 dígitos sem completar zeros à esquerda', () => {
    expect(normalizarDocumento('cep', '1310100')).toEqual({
      ok: false,
      erro: { codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', params: { recebidos: 7, esperados: 8 } },
    });
  });
});

describe('expandirNotacaoCientifica', () => {
  it('desloca a vírgula sem inventar dígitos', () => {
    expect(expandirNotacaoCientifica('1,00235E+13')).toBe('10023500000000');
    expect(expandirNotacaoCientifica('9,92348E+13')).toBe('99234800000000');
    expect(expandirNotacaoCientifica('5E+3')).toBe('5000');
  });

  it('retorna null para valores que não estão em notação científica', () => {
    expect(expandirNotacaoCientifica('01234567000189')).toBeNull();
  });
});

describe('dígitos verificadores (prontos para dados reais)', () => {
  it('valida CNPJ e CPF reais de teste', () => {
    expect(cnpjTemDigitosVerificadoresValidos('11222333000181')).toBe(true);
    expect(cnpjTemDigitosVerificadoresValidos('11222333000182')).toBe(false);
    expect(cpfTemDigitosVerificadoresValidos('52998224725')).toBe(true);
    expect(cpfTemDigitosVerificadoresValidos('52998224726')).toBe(false);
  });

  it('rejeita sequências de dígitos iguais', () => {
    expect(cnpjTemDigitosVerificadoresValidos('11111111111111')).toBe(false);
    expect(cpfTemDigitosVerificadoresValidos('11111111111')).toBe(false);
  });
});
