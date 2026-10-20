import request from 'supertest';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { lerCsv } from '../../src/modules/importacao/csv/leitor-csv.js';
import { montarCsv } from '../../src/shared/csv/escritor-csv.js';
import { app, baixar, importar } from '../helpers/api.js';
import { contar, garantirBancoDeTeste, limparBanco } from '../helpers/banco.js';
import { ARQUIVO_EXEMPLO, csvDe, linhaValida } from '../helpers/csv.js';

const INDICE_CEP = 10;

describe.skipIf(!inject('bancoDisponivel'))('API de importação', () => {
  garantirBancoDeTeste();
  beforeEach(limparBanco);

  afterAll(async () => {
    await pool.end();
  });

  it('importa o arquivo de exemplo e agrupa os erros de CEP', async () => {
    const res = await importar(ARQUIVO_EXEMPLO, 'modelo importação desafio.csv');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nomeArquivo: 'modelo importação desafio.csv',
      status: 'concluida_com_pendencias',
      totais: { linhas: 100, inseridos: 90, atualizados: 0, rejeitados: 10, ignorados: 0, avisos: 90 },
      novosCadastros: { bandeiras: [], combustiveis: [] },
    });
    expect(res.body.gruposErros).toEqual([
      expect.objectContaining({
        codigo: 'DOCUMENTO_QUANTIDADE_DIGITOS',
        campo: 'cep',
        quantidade: 10,
        linhas: [2, 4, 22, 24, 42, 44, 62, 64, 82, 84],
      }),
    ]);
    expect(res.body.gruposAvisos[0]).toMatchObject({ codigo: 'CNPJ_NOTACAO_CIENTIFICA', quantidade: 90 });
    expect(await contar('postos')).toBe(90);
  });

  it('reimportar o mesmo arquivo atualiza os postos em vez de duplicar', async () => {
    await importar(ARQUIVO_EXEMPLO);
    const res = await importar(ARQUIVO_EXEMPLO);

    expect(res.body.totais).toMatchObject({ inseridos: 0, atualizados: 90, rejeitados: 10 });
    expect(await contar('postos')).toBe(90);
  });

  it('o arquivo de correção, depois de corrigido, completa a importação', async () => {
    const primeira = await importar(ARQUIVO_EXEMPLO);
    const download = await baixar(`/api/importacoes/${primeira.body.id}/linhas-rejeitadas.csv`);

    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/csv');
    expect(download.headers['content-disposition']).toContain(`correcao-importacao-${primeira.body.id}.csv`);

    // O usuário corrige o CEP na planilha (digitando o zero que o Excel apagou) e não apaga a coluna de erros.
    const correcao = lerCsv(download.body as Buffer);
    const corrigido = montarCsv(
      correcao.cabecalho,
      correcao.registros.map(({ valores }) => valores.map((v, i) => (i === INDICE_CEP ? `0${v}` : v))),
    );

    const segunda = await importar(Buffer.from(corrigido), `correcao-importacao-${primeira.body.id}.csv`);
    expect(segunda.body).toMatchObject({
      status: 'concluida',
      totais: { linhas: 10, inseridos: 10, atualizados: 0, rejeitados: 0 },
    });
    expect(segunda.body.gruposAvisos.some((g: { codigo: string }) => g.codigo === 'COLUNA_DESCONHECIDA')).toBe(false);
    expect(await contar('postos')).toBe(100);
  });

  it('grava documentos com zero à esquerda e combustíveis na ordem do arquivo', async () => {
    const res = await importar(
      csvDe([linhaValida({ combustiveis: 'GNV; etanol; Hidrogênio Verde', bandeira: 'Posto Independente' })]),
    );

    expect(res.body.novosCadastros).toEqual({ bandeiras: ['Posto Independente'], combustiveis: ['Hidrogênio Verde'] });

    const { rows } = await pool.query(
      `SELECT p.cnpj, p.cep, r.cpf, string_agg(c.nome, ', ' ORDER BY pc.ordem) AS combustiveis
         FROM postos p
         JOIN responsaveis r ON r.id = p.responsavel_id
         JOIN posto_combustiveis pc ON pc.posto_id = p.id
         JOIN combustiveis c ON c.id = pc.combustivel_id
        GROUP BY p.cnpj, p.cep, r.cpf`,
    );
    expect(rows).toEqual([
      { cnpj: '01234567000189', cep: '01310100', cpf: '01234567890', combustiveis: 'GNV, Etanol, Hidrogênio Verde' },
    ]);
  });

  it('reimportação substitui a lista de combustíveis do posto', async () => {
    await importar(csvDe([linhaValida({ combustiveis: 'Gasolina Comum, Etanol, GNV' })]));
    await importar(csvDe([linhaValida({ combustiveis: 'Diesel S10' })]));

    expect(await contar('posto_combustiveis')).toBe(1);
  });

  it('reimportação reordena, acrescenta e remove combustíveis conforme o arquivo', async () => {
    await importar(csvDe([linhaValida({ combustiveis: 'Gasolina Comum, Etanol, GNV' })]));
    await importar(csvDe([linhaValida({ combustiveis: 'GNV, Diesel S10, Gasolina Comum' })]));

    const { rows } = await pool.query<{ nomes: string }>(
      `SELECT string_agg(c.nome, ', ' ORDER BY pc.ordem) AS nomes
         FROM posto_combustiveis pc JOIN combustiveis c ON c.id = pc.combustivel_id`,
    );
    expect(rows[0]!.nomes).toBe('GNV, Diesel S10, Gasolina Comum');
  });

  it('o modelo CSV pode ser importado como está', async () => {
    const modelo = await baixar('/api/importacoes/modelo.csv');
    expect(modelo.status).toBe(200);

    const res = await importar(modelo.body as Buffer);
    expect(res.body).toMatchObject({ status: 'concluida', totais: { inseridos: 1, rejeitados: 0, avisos: 0 } });
  });

  it('bloqueia arquivo sem coluna obrigatória e registra a falha no histórico', async () => {
    const colunas = ['cnpj', 'nome_posto', 'bandeira'];
    const res = await importar(csvDe([linhaValida()], colunas));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CABECALHO_COLUNAS_AUSENTES');
    expect(res.body.error.details.colunasAusentes).toContain('cep');
    expect(await contar('postos')).toBe(0);

    const historico = await request(app).get(`/api/importacoes/${res.body.error.details.importacaoId}`);
    expect(historico.body).toMatchObject({ status: 'falhou', erroArquivo: { codigo: 'CABECALHO_COLUNAS_AUSENTES' } });
  });

  it('responde com mensagens claras para envio sem arquivo, Excel e arquivo grande demais', async () => {
    const semArquivo = await request(app).post('/api/importacoes');
    expect(semArquivo.status).toBe(400);
    expect(semArquivo.body.error.code).toBe('ARQUIVO_AUSENTE');

    const excel = await importar(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]), 'postos.xlsx');
    expect(excel.status).toBe(422);
    expect(excel.body.error.code).toBe('ARQUIVO_EXCEL');

    const grande = await importar(Buffer.alloc(21 * 1024 * 1024, 'a'));
    expect(grande.status).toBe(413);
    expect(grande.body.error.code).toBe('ARQUIVO_MUITO_GRANDE');
  });

  it('lista o histórico paginado, do mais recente para o mais antigo', async () => {
    await importar(ARQUIVO_EXEMPLO, 'primeiro.csv');
    await importar(csvDe([linhaValida()]), 'segundo.csv');

    const res = await request(app).get('/api/importacoes?pagina=1&porPagina=1');
    expect(res.body).toMatchObject({ total: 2, pagina: 1, porPagina: 1 });
    expect(res.body.itens).toHaveLength(1);
    expect(res.body.itens[0]).toMatchObject({ nomeArquivo: 'segundo.csv', status: 'concluida' });
    expect(res.body.itens[0]).not.toHaveProperty('avisos');
  });

  it('responde 404 para importação inexistente e para importação sem linhas rejeitadas', async () => {
    expect((await request(app).get('/api/importacoes/999')).body.error.code).toBe('IMPORTACAO_NAO_ENCONTRADA');
    expect((await request(app).get('/api/importacoes/abc')).status).toBe(404);

    const ok = await importar(csvDe([linhaValida()]));
    const correcao = await request(app).get(`/api/importacoes/${ok.body.id}/linhas-rejeitadas.csv`);
    expect(correcao.status).toBe(404);
    expect(correcao.body.error.code).toBe('SEM_LINHAS_REJEITADAS');
  });
});
