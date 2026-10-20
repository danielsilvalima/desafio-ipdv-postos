import { describe, expect, it } from 'vitest';
import { lerCsv } from '../../src/modules/importacao/csv/leitor-csv.js';
import { ErroArquivo } from '../../src/modules/importacao/erros-arquivo.js';
import { ARQUIVO_EXEMPLO } from '../helpers/csv.js';

function erroDe(executar: () => unknown): ErroArquivo {
  try {
    executar();
  } catch (err) {
    if (err instanceof ErroArquivo) return err;
    throw err;
  }
  throw new Error('era esperado um ErroArquivo');
}

describe('lerCsv', () => {
  it('lê o arquivo de exemplo com BOM e separador ";"', () => {
    const csv = lerCsv(ARQUIVO_EXEMPLO);

    expect(csv.delimitador).toBe(';');
    expect(csv.codificacao).toBe('utf-8');
    expect(csv.cabecalho[0]).toBe('cnpj');
    expect(csv.cabecalho).toHaveLength(21);
    expect(csv.registros).toHaveLength(100);
    expect(csv.registros[0]!.linha).toBe(2);
    expect(csv.registros.at(-1)!.linha).toBe(101);
  });

  it('detecta vírgula e tabulação como separador', () => {
    expect(lerCsv(Buffer.from('cnpj,uf\n1,SP\n')).delimitador).toBe(',');
    expect(lerCsv(Buffer.from('cnpj\tuf\n1\tSP\n')).delimitador).toBe('\t');
  });

  it('ignora separadores dentro de aspas ao detectar o separador do cabeçalho', () => {
    const csv = lerCsv(Buffer.from('"a,b,c";uf\nx;SP\n'));
    expect(csv.delimitador).toBe(';');
    expect(csv.cabecalho).toEqual(['a,b,c', 'uf']);
  });

  it('usa Windows-1252 quando o arquivo não é UTF-8 válido', () => {
    const csv = lerCsv(Buffer.from('municipio;uf\nS\xe3o Paulo;SP\n', 'latin1'));
    expect(csv.codificacao).toBe('windows-1252');
    expect(csv.registros[0]!.valores[0]).toBe('São Paulo');
  });

  it('pula linhas vazias sem alterar a numeração da planilha', () => {
    const csv = lerCsv(Buffer.from('cnpj;uf\r\n1;SP\r\n\r\n;\r\n2;RJ\r\n'));
    expect(csv.registros.map((r) => r.linha)).toEqual([2, 5]);
  });

  it('aceita campo entre aspas com separador, aspas e quebra de linha', () => {
    const csv = lerCsv(Buffer.from('obs;uf\n"linha 1\nlinha; 2 com ""aspas""";SP\n'));
    expect(csv.registros[0]!.valores).toEqual(['linha 1\nlinha; 2 com "aspas"', 'SP']);
  });

  it('mantém aspas soltas no meio de um texto sem aspas', () => {
    const csv = lerCsv(Buffer.from('nome;uf\nPosto "Bom";SP\n'));
    expect(csv.registros[0]!.valores[0]).toBe('Posto "Bom"');
  });

  it('rejeita arquivo vazio ou só com linhas em branco', () => {
    expect(erroDe(() => lerCsv(Buffer.alloc(0))).code).toBe('ARQUIVO_VAZIO');
    expect(erroDe(() => lerCsv(Buffer.from('\r\n\r\n'))).code).toBe('ARQUIVO_VAZIO');
  });

  it('identifica planilha do Excel enviada no lugar do CSV', () => {
    const xlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const xls = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]);
    expect(erroDe(() => lerCsv(xlsx)).code).toBe('ARQUIVO_EXCEL');
    expect(erroDe(() => lerCsv(xls)).code).toBe('ARQUIVO_EXCEL');
  });

  it('rejeita arquivo binário', () => {
    expect(erroDe(() => lerCsv(Buffer.from([0x63, 0x00, 0x6e, 0x00]))).code).toBe('ARQUIVO_NAO_TEXTO');
  });

  it('aponta a linha das aspas que não foram fechadas', () => {
    const erro = erroDe(() => lerCsv(Buffer.from('nome;uf\nok;SP\n"sem fim;SP\n')));
    expect(erro.code).toBe('CSV_MALFORMADO');
    expect(erro.status).toBe(422);
    expect(erro.message).toContain('não foram fechadas');
    expect(erro.detalhes.dica).toBeTruthy();
  });
});
