import { describe, expect, it } from 'vitest';
import { cnpjDoIndice, cpfDoIndice, gerarPostos, valoresNaOrdem } from '../../scripts/gerador-postos.js';
import { lerCsv } from '../../src/modules/importacao/csv/leitor-csv.js';
import { prepararImportacao } from '../../src/modules/importacao/preparar-importacao.js';
import { NOMES_COLUNAS } from '../../src/modules/importacao/validacao/colunas.js';
import {
  cnpjTemDigitosVerificadoresValidos,
  cpfTemDigitosVerificadoresValidos,
} from '../../src/modules/importacao/validacao/documentos.js';
import { escaparCampo, linhaCsv, montarCsv } from '../../src/shared/csv/escritor-csv.js';
import { mascararCep, mascararCnpj, mascararCpf } from '../../src/shared/formatacao/documentos.js';

describe('máscaras de documento', () => {
  it('formata preservando os zeros à esquerda', () => {
    expect(mascararCnpj('01234567000189')).toBe('01.234.567/0001-89');
    expect(mascararCpf('01234567890')).toBe('012.345.678-90');
    expect(mascararCep('01310100')).toBe('01310-100');
  });

  it('devolve o valor como está quando o tamanho não confere', () => {
    expect(mascararCnpj('123')).toBe('123');
    expect(mascararCep('1310100')).toBe('1310100');
  });
});

describe('escritor de CSV', () => {
  it('só coloca aspas quando o campo tem separador, aspas ou quebra de linha', () => {
    expect(escaparCampo('Posto Central')).toBe('Posto Central');
    expect(escaparCampo('a;b')).toBe('"a;b"');
    expect(escaparCampo('Posto "Bom"')).toBe('"Posto ""Bom"""');
    expect(escaparCampo('linha 1\nlinha 2')).toBe('"linha 1\nlinha 2"');
    expect(escaparCampo(null)).toBe('');
    expect(escaparCampo(8)).toBe('8');
  });

  it('termina cada linha com CRLF', () => {
    expect(linhaCsv(['a', null, 3])).toBe('a;;3\r\n');
  });
});

describe('gerador de postos', () => {
  it('gera CNPJs e CPFs com dígito verificador válido e zeros à esquerda', () => {
    expect(cnpjDoIndice(1)).toMatch(/^0{7}1/);
    expect(cnpjTemDigitosVerificadoresValidos(cnpjDoIndice(1))).toBe(true);
    expect(cnpjTemDigitosVerificadoresValidos(cnpjDoIndice(98_765))).toBe(true);
    expect(cpfTemDigitosVerificadoresValidos(cpfDoIndice(1))).toBe(true);
    expect(cpfTemDigitosVerificadoresValidos(cpfDoIndice(4_321))).toBe(true);
  });

  it('é determinístico para a mesma semente', () => {
    const primeira = [...gerarPostos(20, { semente: 7 })];
    const segunda = [...gerarPostos(20, { semente: 7 })];
    expect(primeira).toEqual(segunda);
  });

  it('gera linhas todas válidas e com CNPJ distinto', () => {
    const linhas = [...gerarPostos(2_000)];
    const preparada = prepararImportacao(lerCsv(Buffer.from(montarCsv(NOMES_COLUNAS, linhas.map(valoresNaOrdem)))));

    expect(preparada.rejeitadas).toEqual([]);
    expect(preparada.avisos).toEqual([]);
    expect(preparada.aceitas).toHaveLength(2_000);
  });

  it('com erros propositais, parte das linhas é rejeitada', () => {
    const linhas = [...gerarPostos(2_000, { fracaoComErro: 0.05 })];
    const preparada = prepararImportacao(lerCsv(Buffer.from(montarCsv(NOMES_COLUNAS, linhas.map(valoresNaOrdem)))));

    expect(preparada.rejeitadas.length).toBeGreaterThan(50);
    expect(preparada.rejeitadas.length).toBeLessThan(200);
  });
});
