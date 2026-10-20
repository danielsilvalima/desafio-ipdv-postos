/** Banco exclusivo dos testes de integração: é truncado a cada teste. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postos:postos@localhost:5433/postos_test';
