# Postos de Combustível

Ferramenta interna para importar postos de combustível a partir de CSV, visualizar os postos cadastrados e exportá-los novamente em CSV.

> Projeto em desenvolvimento. Instruções completas de setup serão adicionadas ao final.

## Stack

- Node.js 22+
- Backend: Express + `pg` (sem ORM) + PostgreSQL
- Frontend: Vue 3 + Vuetify 3
- TypeScript nos dois lados

## Estrutura

```
backend/    API Express
frontend/   SPA Vue 3 + Vuetify 3
samples/    CSV de exemplo fornecido no desafio
```

## Banco de dados local

```bash
docker compose up -d
```

O PostgreSQL sobe na porta `5433` (configurável pela variável `POSTGRES_PORT`).
