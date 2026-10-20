import { describe, expect, it } from 'vitest';
import { mapearCabecalho, normalizarNomeColuna } from '../../src/modules/importacao/csv/cabecalho.js';
import { ErroArquivo } from '../../src/modules/importacao/erros-arquivo.js';
import { NOMES_COLUNAS } from '../../src/modules/importacao/validacao/colunas.js';

const OBRIGATORIAS = [
  'cnpj', 'nome_posto', 'bandeira', 'logradouro', 'bairro', 'municipio', 'uf', 'cep',
  'cpf_responsavel', 'nome_responsavel', 'combustiveis', 'status',
];

function erroDe(executar: () => unknown): ErroArquivo {
  try {
    executar();
  } catch (err) {
    if (err instanceof ErroArquivo) return err;
    throw err;
  }
  throw new Error('era esperado um ErroArquivo');
}

describe('normalizarNomeColuna', () => {
  it('ignora caixa, acentos, espaços e hífens', () => {
    expect(normalizarNomeColuna(' Nome Posto ')).toBe('nome_posto');
    expect(normalizarNomeColuna('NÚMERO-BICOS')).toBe('numero_bicos');
    expect(normalizarNomeColuna('\uFEFFcnpj')).toBe('cnpj');
  });
});

describe('mapearCabecalho', () => {
  it('mapeia o cabeçalho completo do contrato', () => {
    const mapa = mapearCabecalho([...NOMES_COLUNAS]);
    expect(mapa.indicePorColuna.get('cnpj')).toBe(0);
    expect(mapa.indicePorColuna.get('observacoes')).toBe(20);
    expect(mapa.colunasDesconhecidas).toEqual([]);
    expect(mapa.colunasOpcionaisAusentes).toEqual([]);
  });

  it('aceita colunas em outra ordem e só com as obrigatórias', () => {
    const mapa = mapearCabecalho([...OBRIGATORIAS].reverse());
    expect(mapa.indicePorColuna.get('status')).toBe(0);
    expect(mapa.colunasOpcionaisAusentes).toContain('observacoes');
    expect(mapa.colunasOpcionaisAusentes).not.toContain('cnpj');
  });

  it('lista colunas fora do modelo e ignora a coluna do arquivo de correção', () => {
    const mapa = mapearCabecalho([...NOMES_COLUNAS, 'Telefone', 'erros_importacao', '']);
    expect(mapa.colunasDesconhecidas).toEqual(['Telefone']);
  });

  it('bloqueia o arquivo quando falta coluna obrigatória, mostrando o cabeçalho esperado', () => {
    const erro = erroDe(() => mapearCabecalho(NOMES_COLUNAS.filter((c) => c !== 'cep' && c !== 'uf')));
    expect(erro.code).toBe('CABECALHO_COLUNAS_AUSENTES');
    expect(erro.detalhes.colunasAusentes).toEqual(['uf', 'cep']);
    expect(erro.detalhes.cabecalhoEsperado).toEqual(NOMES_COLUNAS);
  });

  it('bloqueia coluna repetida', () => {
    const erro = erroDe(() => mapearCabecalho([...NOMES_COLUNAS, 'CNPJ']));
    expect(erro.code).toBe('CABECALHO_COLUNAS_REPETIDAS');
    expect(erro.detalhes.colunasRepetidas).toEqual(['cnpj']);
  });
});
