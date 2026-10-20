import request from 'supertest';
import { createApp } from '../../src/app.js';

export const app = createApp();

export function importar(conteudo: Buffer, nome = 'postos.csv') {
  return request(app).post('/api/importacoes').attach('arquivo', conteudo, nome);
}

/** Lê o corpo de um download de CSV como Buffer, sem depender do parser padrão do supertest. */
export function baixar(url: string) {
  return request(app)
    .get(url)
    .buffer(true)
    .parse((res, callback) => {
      const partes: Buffer[] = [];
      res.on('data', (parte: Buffer) => partes.push(parte));
      res.on('end', () => callback(null, Buffer.concat(partes)));
    });
}
