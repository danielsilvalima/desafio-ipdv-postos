import { describe, expect, it } from 'vitest';
import { gerarCsvCorrecao, gerarCsvModelo } from '../../src/modules/importacao/arquivos-csv.js';
import { lerCsv } from '../../src/modules/importacao/csv/leitor-csv.js';
import { ErroArquivo } from '../../src/modules/importacao/erros-arquivo.js';
import { prepararImportacao } from '../../src/modules/importacao/preparar-importacao.js';
import { agruparOcorrencias } from '../../src/modules/importacao/relatorio.js';
import { NOMES_COLUNAS } from '../../src/modules/importacao/validacao/colunas.js';
import { ARQUIVO_EXEMPLO, csvDe, linhaValida } from '../helpers/csv.js';

function preparar(buffer: Buffer) {
  return prepararImportacao(lerCsv(buffer));
}

describe('prepararImportacao', () => {
  it('separa as linhas válidas e rejeitadas do arquivo de exemplo', () => {
    const preparada = preparar(ARQUIVO_EXEMPLO);

    expect(preparada.totalLinhas).toBe(100);
    expect(preparada.aceitas).toHaveLength(90);
    expect(preparada.rejeitadas).toHaveLength(10);
    expect(preparada.ignorados).toBe(0);
    expect(preparada.rejeitadas.map((r) => r.linha)).toEqual([2, 4, 22, 24, 42, 44, 62, 64, 82, 84]);
    expect(preparada.rejeitadas.every((r) => r.erros.length === 1 && r.erros[0]!.campo === 'cep')).toBe(true);
  });

  it('guarda os valores rejeitados exatamente como vieram', () => {
    const { rejeitadas } = preparar(ARQUIVO_EXEMPLO);
    expect(rejeitadas[0]!.valoresOriginais.cep).toBe('1310100');
    expect(rejeitadas[0]!.valoresOriginais.cnpj).toBe('1,02346E+13');
  });

  it('mantém a última ocorrência de um CNPJ repetido e avisa nas anteriores', () => {
    const preparada = preparar(
      csvDe([
        linhaValida({ nome_fantasia: 'Primeira' }),
        linhaValida({ cnpj: '98765432000110' }),
        linhaValida({ cnpj: '01234567000189', nome_fantasia: 'Última' }),
      ]),
    );

    expect(preparada.aceitas.map((a) => a.linha)).toEqual([3, 4]);
    expect(preparada.aceitas[1]!.posto.nomeFantasia).toBe('Última');
    expect(preparada.ignorados).toBe(1);
    expect(preparada.avisos).toEqual([
      expect.objectContaining({ codigo: 'CNPJ_DUPLICADO_NO_ARQUIVO', linha: 2, campo: 'cnpj' }),
    ]);
    expect(preparada.avisos[0]!.mensagem).toContain('linha 4');
  });

  it('usa os dados da última linha quando o mesmo CPF vem com dados diferentes', () => {
    const preparada = preparar(
      csvDe([
        linhaValida({ nome_responsavel: 'Maria S.', cargo_responsavel: 'Gerente' }),
        linhaValida({ cnpj: '98765432000110', nome_responsavel: 'Maria Silva' }),
      ]),
    );

    const aviso = preparada.avisos.find((a) => a.codigo === 'RESPONSAVEL_DIVERGENTE');
    expect(aviso).toMatchObject({ linha: 2, campo: 'cpf_responsavel' });
    expect(aviso!.mensagem).toContain('nome, cargo');
    expect(preparada.aceitas.every((a) => a.posto.responsavel.nome === 'Maria Silva')).toBe(true);
  });

  it('rejeita linha com mais valores que o cabeçalho', () => {
    const conteudo = csvDe([linhaValida()]).toString('utf8').replace(/\r\n$/, ';sobrou\r\n');
    const preparada = preparar(Buffer.from(conteudo));

    expect(preparada.aceitas).toHaveLength(0);
    expect(preparada.rejeitadas[0]!.erros).toEqual([
      expect.objectContaining({ codigo: 'LINHA_COLUNAS_A_MAIS', rotulo: 'Linha inteira' }),
    ]);
  });

  it('avisa na linha 1 sobre colunas fora do modelo e colunas opcionais ausentes', () => {
    const colunas = [...NOMES_COLUNAS.filter((c) => c !== 'observacoes'), 'telefone'];
    const preparada = preparar(csvDe([linhaValida()], colunas));

    expect(preparada.avisos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'COLUNA_DESCONHECIDA', linha: 1, valorRecebido: 'telefone' }),
        expect.objectContaining({ codigo: 'COLUNA_OPCIONAL_AUSENTE', linha: 1, campo: 'observacoes' }),
      ]),
    );
  });

  it('bloqueia arquivo só com cabeçalho', () => {
    expect(() => preparar(csvDe([]))).toThrow(ErroArquivo);
    try {
      preparar(csvDe([]));
    } catch (err) {
      expect((err as ErroArquivo).code).toBe('ARQUIVO_SEM_LINHAS');
    }
  });
});

describe('arquivo de correção', () => {
  it('traz só as rejeitadas, com os valores originais e a descrição dos erros', () => {
    const { rejeitadas } = preparar(ARQUIVO_EXEMPLO);
    const csv = lerCsv(Buffer.from(gerarCsvCorrecao(rejeitadas)));

    expect(csv.cabecalho).toEqual([...NOMES_COLUNAS, 'erros_importacao']);
    expect(csv.registros).toHaveLength(10);
    expect(csv.registros[0]!.valores[10]).toBe('1310100');
    expect(csv.registros[0]!.valores[21]).toBe('CEP: O CEP deve ter 8 números. Recebido: "1310100" (7 números).');
  });

  it('pode ser reimportado sem apagar a coluna de erros, que é ignorada sem aviso', () => {
    const { rejeitadas } = preparar(ARQUIVO_EXEMPLO);
    const reimportada = preparar(Buffer.from(gerarCsvCorrecao(rejeitadas)));

    expect(reimportada.totalLinhas).toBe(10);
    expect(reimportada.rejeitadas).toHaveLength(10);
    expect(reimportada.avisos.some((a) => a.codigo === 'COLUNA_DESCONHECIDA')).toBe(false);
  });
});

describe('modelo CSV', () => {
  it('é importável sem erros nem avisos', () => {
    const preparada = preparar(Buffer.from(gerarCsvModelo()));
    expect(preparada.rejeitadas).toEqual([]);
    expect(preparada.avisos).toEqual([]);
    expect(preparada.aceitas[0]!.posto).toMatchObject({ cnpj: '01234567000189', cep: '01310100' });
  });
});

describe('agruparOcorrencias', () => {
  it('agrupa por tipo, coluna e dica, do maior grupo para o menor', () => {
    const base = { tipo: 'erro' as const, rotulo: 'CEP', valorRecebido: '1', titulo: 't', mensagem: 'm' };
    const grupos = agruparOcorrencias([
      { ...base, codigo: 'UF_INVALIDA', campo: 'uf', linha: 9 },
      { ...base, codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', campo: 'cep', dica: 'd', linha: 3 },
      { ...base, codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS', campo: 'cep', dica: 'd', linha: 5 },
    ]);

    expect(grupos.map((g) => [g.campo, g.quantidade, g.linhas])).toEqual([
      ['cep', 2, [3, 5]],
      ['uf', 1, [9]],
    ]);
  });
});
