import request from 'supertest';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { gerarPostos, valoresNaOrdem } from '../../scripts/gerador-postos.js';
import { pool } from '../../src/db/pool.js';
import { lerCsv } from '../../src/modules/importacao/csv/leitor-csv.js';
import { NOMES_COLUNAS } from '../../src/modules/importacao/validacao/colunas.js';
import { BOM, montarCsv } from '../../src/shared/csv/escritor-csv.js';
import { app, baixar, importar } from '../helpers/api.js';
import { garantirBancoDeTeste, limparBanco } from '../helpers/banco.js';
import { ARQUIVO_EXEMPLO, csvDe, linhaValida } from '../helpers/csv.js';

const POSTOS = [
  linhaValida({
    nome_posto: 'Auto Posto Ávila',
    municipio: 'São Paulo',
    combustiveis: 'GNV, Etanol',
  }),
  linhaValida({
    cnpj: '98765432000110',
    nome_posto: 'Posto Beta 100%_x',
    nome_fantasia: '',
    bandeira: 'Shell',
    municipio: 'Campinas',
    data_inauguracao: '',
    observacoes: 'Loja 24h; lava-rápido.\nAceita "vale-combustível".',
  }),
  linhaValida({
    cnpj: '11.222.333/0001-81',
    nome_posto: 'Comercial Carvalho',
    nome_fantasia: 'Posto Carvalho',
    bandeira: 'Raízen',
    municipio: 'Curitiba',
    uf: 'PR',
    status: 'Em implantação',
  }),
];

/** Tudo o que o usuário vê de um posto, sem ids nem datas de controle. */
async function retratoDoBanco() {
  const { rows } = await pool.query(
    `SELECT p.cnpj, p.razao_social, p.nome_fantasia, b.nome AS bandeira, p.logradouro, p.numero, p.complemento,
            p.bairro, p.municipio, p.uf, p.cep, r.cpf, r.nome, r.email, r.cargo, p.status,
            p.data_inauguracao::text, p.numero_bicos, p.numero_pistas, p.observacoes,
            (SELECT string_agg(c.nome, ',' ORDER BY pc.ordem)
               FROM posto_combustiveis pc JOIN combustiveis c ON c.id = pc.combustivel_id
              WHERE pc.posto_id = p.id) AS combustiveis
       FROM postos p
       JOIN bandeiras b ON b.id = p.bandeira_id
       JOIN responsaveis r ON r.id = p.responsavel_id
      ORDER BY p.cnpj`,
  );
  return rows;
}

function listar(query = '') {
  return request(app).get(`/api/postos${query}`);
}

function razoes(res: { body: { itens: { razaoSocial: string }[] } }) {
  return res.body.itens.map((item) => item.razaoSocial);
}

describe.skipIf(!inject('bancoDisponivel'))('API de postos', () => {
  garantirBancoDeTeste();
  beforeEach(limparBanco);

  afterAll(async () => {
    await pool.end();
  });

  describe('listagem', () => {
    beforeEach(async () => {
      await importar(csvDe(POSTOS));
    });

    it('pagina no servidor, ordenando por razão social', async () => {
      const primeira = await listar('?porPagina=2');
      expect(primeira.body).toMatchObject({ total: 3, pagina: 1, porPagina: 2 });
      expect(razoes(primeira)).toEqual(['Auto Posto Ávila', 'Comercial Carvalho']);

      const segunda = await listar('?porPagina=2&pagina=2');
      expect(razoes(segunda)).toEqual(['Posto Beta 100%_x']);
    });

    it('devolve o posto completo, com documentos sem máscara e combustíveis na ordem do arquivo', async () => {
      const res = await listar('?porPagina=1');
      expect(res.body.itens[0]).toMatchObject({
        cnpj: '01234567000189',
        razaoSocial: 'Auto Posto Ávila',
        bandeira: 'Ipiranga',
        cep: '01310100',
        dataInauguracao: '2015-03-25',
        numeroBicos: 8,
        combustiveis: ['GNV', 'Etanol'],
        responsavel: { cpf: '01234567890', nome: 'Maria Silva', email: 'maria@empresa.com.br' },
      });
    });

    it('busca sem diferenciar acento e caixa, por nome, município, bandeira ou CNPJ', async () => {
      expect(razoes(await listar('?busca=SAO%20PAULO'))).toEqual(['Auto Posto Ávila']);
      expect(razoes(await listar('?busca=raizen'))).toEqual(['Comercial Carvalho']);
      expect(razoes(await listar('?busca=avila'))).toEqual(['Auto Posto Ávila']);
      expect(razoes(await listar('?busca=11.222.333'))).toEqual(['Comercial Carvalho']);
      expect((await listar('?busca=inexistente')).body).toMatchObject({ total: 0, itens: [] });
    });

    it('com várias palavras, exige que cada uma apareça em algum campo', async () => {
      expect(razoes(await listar('?busca=curitiba%20raizen'))).toEqual(['Comercial Carvalho']);
      expect(razoes(await listar('?busca=curitiba%20shell'))).toEqual([]);
    });

    it('trata % e _ da busca como texto, não como curinga', async () => {
      expect(razoes(await listar('?busca=%25'))).toEqual(['Posto Beta 100%_x']);
      expect(razoes(await listar('?busca=_'))).toEqual(['Posto Beta 100%_x']);
    });

    it('ordena pelo campo pedido e deixa valores vazios por último', async () => {
      expect(razoes(await listar('?ordenarPor=cnpj&ordem=desc'))).toEqual([
        'Posto Beta 100%_x',
        'Comercial Carvalho',
        'Auto Posto Ávila',
      ]);
      expect(razoes(await listar('?ordenarPor=nomeFantasia')).at(-1)).toBe('Posto Beta 100%_x');
    });

    it('usa valores padrão quando os parâmetros são inválidos', async () => {
      const res = await listar('?pagina=abc&porPagina=1000&ordenarPor=senha;DROP&ordem=x');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ pagina: 1, porPagina: 100, total: 3 });
      expect(razoes(res)[0]).toBe('Auto Posto Ávila');
    });
  });

  describe('exportação', () => {
    it('envia o CSV em streaming, com BOM e o cabeçalho do contrato', async () => {
      await importar(csvDe(POSTOS));
      const res = await baixar('/api/postos/export.csv');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="postos-\d{4}-\d{2}-\d{2}\.csv"/);
      expect(res.headers['transfer-encoding']).toBe('chunked');

      const texto = (res.body as Buffer).toString('utf8');
      expect(texto.startsWith(BOM)).toBe(true);
      expect(texto.slice(1).split('\r\n')[0]).toBe(NOMES_COLUNAS.join(';'));
    });

    it('sai com máscara nos documentos, data dd/mm/aaaa e combustíveis na ordem', async () => {
      await importar(csvDe(POSTOS));
      const csv = lerCsv((await baixar('/api/postos/export.csv')).body as Buffer);
      const [ativo, beta] = csv.registros.map((r) => Object.fromEntries(NOMES_COLUNAS.map((c, i) => [c, r.valores[i]])));

      expect(ativo).toMatchObject({
        cnpj: '01.234.567/0001-89',
        cep: '01310-100',
        cpf_responsavel: '012.345.678-90',
        data_inauguracao: '25/03/2015',
        combustiveis: 'GNV,Etanol',
      });
      expect(beta).toMatchObject({
        nome_fantasia: '',
        data_inauguracao: '',
        observacoes: 'Loja 24h; lava-rápido.\nAceita "vale-combustível".',
      });
      expect(csv.registros[2]!.valores[16]).toBe('em_implantacao');
    });

    it('com a base vazia, envia só o cabeçalho', async () => {
      const csv = lerCsv((await baixar('/api/postos/export.csv')).body as Buffer);
      expect(csv.cabecalho).toEqual(NOMES_COLUNAS);
      expect(csv.registros).toEqual([]);
    });
  });

  describe('ida e volta', () => {
    it('o arquivo exportado é reimportado sem erros, sem avisos e sem alterar nenhum dado', async () => {
      await importar(ARQUIVO_EXEMPLO);
      await importar(csvDe(POSTOS));
      const antes = await retratoDoBanco();

      const exportado = (await baixar('/api/postos/export.csv')).body as Buffer;
      const res = await importar(exportado, 'exportado.csv');

      expect(res.body).toMatchObject({
        status: 'concluida',
        totais: { linhas: 93, inseridos: 0, atualizados: 93, rejeitados: 0, ignorados: 0, avisos: 0 },
      });
      expect(await retratoDoBanco()).toEqual(antes);
    });

    it('aguenta 10 mil postos: importa, exporta e reimporta sem perder nenhum', { timeout: 60_000 }, async () => {
      const linhas = [...gerarPostos(10_000)].map(valoresNaOrdem);
      const importacao = await importar(Buffer.from(montarCsv(NOMES_COLUNAS, linhas)), 'postos-10000.csv');
      expect(importacao.body.totais).toMatchObject({ inseridos: 10_000, rejeitados: 0 });

      const exportado = (await baixar('/api/postos/export.csv')).body as Buffer;
      expect(lerCsv(exportado).registros).toHaveLength(10_000);

      const reimportacao = await importar(exportado, 'exportado.csv');
      expect(reimportacao.body.totais).toMatchObject({ atualizados: 10_000, rejeitados: 0, avisos: 0 });
    });
  });
});
