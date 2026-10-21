import { describe, expect, it } from 'vitest';
import { normalizarData } from '../../src/modules/importacao/validacao/datas.js';
import {
  normalizarEmail,
  normalizarStatus,
  normalizarUf,
  separarCombustiveis,
} from '../../src/modules/importacao/validacao/dominio.js';
import { normalizarInteiroNaoNegativo } from '../../src/modules/importacao/validacao/numeros.js';
import { ajustarCaixa, chaveNormalizada, limparTexto } from '../../src/modules/importacao/validacao/texto.js';

describe('limparTexto', () => {
  it('remove espaços nas pontas, repetidos e espaço não separável', () => {
    expect(limparTexto('  Posto \u00A0  Leste  ')).toBe('Posto Leste');
  });

  it('retorna null para texto vazio ou só com espaços', () => {
    expect(limparTexto('   ')).toBeNull();
    expect(limparTexto('')).toBeNull();
    expect(limparTexto(undefined)).toBeNull();
  });

  it('preserva quebras de linha internas', () => {
    expect(limparTexto(' linha 1 \r\n  linha 2 ')).toBe('linha 1\nlinha 2');
  });
});

describe('ajustarCaixa', () => {
  it('transforma texto todo em minúsculas ou todo em maiúsculas em nome próprio', () => {
    expect(ajustarCaixa('campinas')).toBe('Campinas');
    expect(ajustarCaixa('CAMPINAS')).toBe('Campinas');
    expect(ajustarCaixa('SÃO PAULO')).toBe('São Paulo');
    expect(ajustarCaixa('belo horizonte')).toBe('Belo Horizonte');
  });

  it('mantém conectivos em minúsculas, exceto na primeira palavra', () => {
    expect(ajustarCaixa('SAO JOSE DOS CAMPOS')).toBe('Sao Jose dos Campos');
    expect(ajustarCaixa('maria da silva e souza')).toBe('Maria da Silva e Souza');
    expect(ajustarCaixa('GERENTE DE POSTO')).toBe('Gerente de Posto');
    expect(ajustarCaixa('DO NORTE')).toBe('Do Norte');
  });

  it('trata hífen, apóstrofo, números e numerais romanos', () => {
    expect(ajustarCaixa('EMBU-GUAÇU')).toBe('Embu-Guaçu');
    expect(ajustarCaixa("SANTA BARBARA D'OESTE")).toBe("Santa Barbara d'Oeste");
    expect(ajustarCaixa('setor t-63')).toBe('Setor T-63');
    expect(ajustarCaixa('JARDIM SAO PAULO II')).toBe('Jardim Sao Paulo II');
  });

  it('mantém texto que já mistura maiúsculas e minúsculas', () => {
    expect(ajustarCaixa('Campinas')).toBe('Campinas');
    expect(ajustarCaixa('SHN Quadra 2')).toBe('SHN Quadra 2');
    expect(ajustarCaixa('caxias do Sul')).toBe('caxias do Sul');
  });

  it('não altera texto sem letras e aplicado duas vezes dá o mesmo resultado', () => {
    expect(ajustarCaixa('1200')).toBe('1200');
    const ajustado = ajustarCaixa('SAO JOSE DOS CAMPOS');
    expect(ajustarCaixa(ajustado)).toBe(ajustado);
  });
});

describe('chaveNormalizada', () => {
  it('ignora maiúsculas, acentos e espaços repetidos', () => {
    expect(chaveNormalizada('  RAÍZEN   Energia ')).toBe('raizen energia');
  });
});

describe('normalizarData', () => {
  it.each([
    ['01/01/1990', '1990-01-01'],
    ['1/2/1991', '1991-02-01'],
    ['25-03-2015', '2015-03-25'],
    ['25.03.2015', '2015-03-25'],
    ['2015-03-25', '2015-03-25'],
    ['2015/03/25', '2015-03-25'],
    ['25/03/2015 00:00:00', '2015-03-25'],
    ['2015-03-25T10:30:00Z', '2015-03-25'],
    ['42088', '2015-03-25'],
  ])('converte "%s" para %s', (entrada, esperado) => {
    expect(normalizarData(entrada)).toMatchObject({ ok: true, valor: esperado });
  });

  it('rejeita datas que não existem', () => {
    expect(normalizarData('31/02/2020')).toMatchObject({ ok: false, erro: { codigo: 'DATA_INEXISTENTE' } });
    expect(normalizarData('29/02/2023')).toMatchObject({ ok: false, erro: { codigo: 'DATA_INEXISTENTE' } });
    expect(normalizarData('10/13/2020')).toMatchObject({ ok: false, erro: { codigo: 'DATA_INEXISTENTE' } });
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(normalizarData('29/02/2024')).toMatchObject({ ok: true, valor: '2024-02-29' });
  });

  it('rejeita ano com 2 dígitos por ser ambíguo', () => {
    expect(normalizarData('01/01/90')).toMatchObject({
      ok: false,
      erro: { codigo: 'DATA_FORMATO_INVALIDO', params: { motivo: 'ano_dois_digitos' } },
    });
  });

  it('rejeita anos fora do período aceito', () => {
    expect(normalizarData('01/01/1850')).toMatchObject({ ok: false, erro: { codigo: 'DATA_FORA_DO_PERIODO' } });
  });

  it('rejeita textos que não são data', () => {
    expect(normalizarData('ontem')).toMatchObject({ ok: false, erro: { codigo: 'DATA_FORMATO_INVALIDO' } });
  });
});

describe('normalizarInteiroNaoNegativo', () => {
  it.each([
    ['4', 4],
    [' 12 ', 12],
    ['4.0', 4],
    ['4,00', 4],
    ['0', 0],
  ])('aceita "%s" como %d', (entrada, esperado) => {
    expect(normalizarInteiroNaoNegativo(entrada)).toMatchObject({ ok: true, valor: esperado });
  });

  it('rejeita casas decimais de verdade', () => {
    expect(normalizarInteiroNaoNegativo('4,5')).toMatchObject({
      ok: false,
      erro: { codigo: 'INTEIRO_INVALIDO', params: { motivo: 'decimal' } },
    });
  });

  it('rejeita negativos e textos', () => {
    expect(normalizarInteiroNaoNegativo('-2')).toMatchObject({ ok: false, erro: { codigo: 'INTEIRO_NEGATIVO' } });
    expect(normalizarInteiroNaoNegativo('quatro')).toMatchObject({ ok: false, erro: { codigo: 'INTEIRO_INVALIDO' } });
  });

  it('rejeita valores acima do limite do banco', () => {
    expect(normalizarInteiroNaoNegativo('99999999999')).toMatchObject({
      ok: false,
      erro: { codigo: 'INTEIRO_INVALIDO', params: { motivo: 'muito_grande' } },
    });
  });
});

describe('normalizarUf', () => {
  it('aceita a sigla em qualquer caixa', () => {
    expect(normalizarUf('sp')).toMatchObject({ ok: true, valor: 'SP' });
    expect(normalizarUf(' Rj ')).toMatchObject({ ok: true, valor: 'RJ' });
  });

  it('aceita o nome do estado, com ou sem acento', () => {
    expect(normalizarUf('São Paulo')).toMatchObject({ ok: true, valor: 'SP' });
    expect(normalizarUf('parana')).toMatchObject({ ok: true, valor: 'PR' });
  });

  it('rejeita siglas inexistentes', () => {
    expect(normalizarUf('XX')).toMatchObject({ ok: false, erro: { codigo: 'UF_INVALIDA' } });
  });
});

describe('normalizarEmail', () => {
  it('converte para minúsculas', () => {
    expect(normalizarEmail(' Maria.Silva@Empresa.com.BR ')).toMatchObject({ ok: true, valor: 'maria.silva@empresa.com.br' });
  });

  it('rejeita e-mails sem domínio válido', () => {
    expect(normalizarEmail('maria@empresa')).toMatchObject({ ok: false, erro: { codigo: 'EMAIL_INVALIDO' } });
    expect(normalizarEmail('maria silva@empresa.com')).toMatchObject({ ok: false, erro: { codigo: 'EMAIL_INVALIDO' } });
  });
});

describe('normalizarStatus', () => {
  it.each([
    ['ativo', 'ativo'],
    ['ATIVO', 'ativo'],
    [' Inativo ', 'inativo'],
    ['Em implantação', 'em_implantacao'],
    ['EM-IMPLANTACAO', 'em_implantacao'],
    ['em_implantacao', 'em_implantacao'],
  ])('converte "%s" para %s', (entrada, esperado) => {
    expect(normalizarStatus(entrada)).toMatchObject({ ok: true, valor: esperado });
  });

  it('rejeita status fora da lista', () => {
    expect(normalizarStatus('fechado')).toMatchObject({ ok: false, erro: { codigo: 'STATUS_INVALIDO' } });
  });
});

describe('separarCombustiveis', () => {
  it('separa por vírgula, limpa espaços e mantém a ordem', () => {
    expect(separarCombustiveis('Gasolina Comum,  Etanol ,Diesel S10')).toEqual({
      ok: true,
      valor: ['Gasolina Comum', 'Etanol', 'Diesel S10'],
      avisos: [],
    });
  });

  it('aceita ponto e vírgula e barra vertical como separador', () => {
    expect(separarCombustiveis('GNV; Etanol | Arla 32')).toMatchObject({ ok: true, valor: ['GNV', 'Etanol', 'Arla 32'] });
  });

  it('remove repetidos sem diferenciar maiúsculas e acentos, com aviso', () => {
    expect(separarCombustiveis('Etanol, ETANOL, etanol')).toEqual({
      ok: true,
      valor: ['Etanol'],
      avisos: [
        { codigo: 'COMBUSTIVEL_REPETIDO', params: { nome: 'ETANOL' } },
        { codigo: 'COMBUSTIVEL_REPETIDO', params: { nome: 'etanol' } },
      ],
    });
  });

  it('ignora itens vazios e falha se não sobrar nenhum', () => {
    expect(separarCombustiveis('Etanol,,')).toMatchObject({ ok: true, valor: ['Etanol'] });
    expect(separarCombustiveis(' , ; ')).toMatchObject({ ok: false, erro: { codigo: 'CAMPO_OBRIGATORIO' } });
  });
});
