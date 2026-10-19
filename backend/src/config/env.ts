import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}. Veja backend/.env.example.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3333),
  databaseUrl: required('DATABASE_URL'),
};
