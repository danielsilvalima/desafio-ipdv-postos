# Postos de Combustível

Ferramenta interna para importar postos de combustível a partir de CSV, visualizar os postos cadastrados e exportá-los novamente em CSV.

O foco está na importação: o arquivo real vem do Excel, com CNPJ em notação científica, CEP sem o zero do começo e outros problemas comuns. O sistema valida linha a linha, grava o que está certo, explica o que está errado em português simples e devolve um arquivo só com as linhas para corrigir e reimportar.

As escolhas de modelagem, validação e escala estão explicadas em [DECISOES.md](DECISOES.md).

## Stack

- Node.js 22+ e TypeScript nos dois lados
- Backend: Express 5 + `pg` (sem ORM) + PostgreSQL 16
- Frontend: Vue 3 + Vuetify 3 + Vite
- Testes: Vitest + Supertest, com banco PostgreSQL real

## Requisitos

- Node.js 22 ou mais novo (há um `.nvmrc` na raiz)
- Docker, para subir o PostgreSQL. Sem Docker, qualquer PostgreSQL 16 serve (veja [Sem Docker](#sem-docker)).

## Como rodar

1. Suba o banco. O PostgreSQL fica na porta `5433`, para não conflitar com uma instalação local na 5432.

   ```bash
   docker compose up -d
   ```

2. Rode o backend em `http://localhost:3333`. O `db:setup` aplica as migrations e o seed (catálogo inicial de bandeiras e combustíveis).

   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run db:setup
   npm run dev
   ```

3. Em outro terminal, rode o frontend em `http://localhost:5173`. O Vite repassa `/api` para o backend.

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Abra `http://localhost:5173`, vá em **Importar** e envie `samples/modelo-importacao-desafio.csv`.

### O que esperar do arquivo de exemplo

O arquivo fornecido tem 100 linhas, e o resultado da primeira importação é este:

- **90 postos importados.**
- **10 linhas recusadas**, todas de São Paulo e Guarulhos, porque o CEP veio com 7 dígitos (o Excel apagou o zero do começo, por exemplo `1310100` em vez de `01310100`). O sistema não completa zeros por conta própria: veja o motivo em [DECISOES.md](DECISOES.md#3-cnpj-cpf-e-cep-sem-completar-zeros).
- **90 avisos** de CNPJ em notação científica (`1,02346E+13`), convertido para dígitos.

Para ver a correção guiada:

1. Clique em **Baixar linhas com erro**.
2. Corrija os CEPs no Excel. A coluna extra `erros_importacao` explica o problema de cada linha e pode ficar no arquivo.
3. Importe o arquivo corrigido. Os 10 postos entram e as pendências zeram.

Reimportar o arquivo completo também é seguro: postos com o mesmo CNPJ são atualizados, nunca duplicados.

## Funcionalidades

- **Importar:** upload por clique ou arrastando o arquivo, com progresso de envio. Ao terminar, a tela mostra:
  - o resumo do que entrou (novos, atualizados, recusados, avisos);
  - os erros agrupados por tipo, cada grupo com uma dica de correção e os números das linhas no Excel;
  - uma tabela linha a linha, com filtro por coluna;
  - o botão para baixar o arquivo de correção.
- **Erros de arquivo:** quando o arquivo nem pode ser lido, a tela explica o motivo e mostra as colunas que faltam ou que têm nome errado. Casos cobertos: planilha `.xlsx` em vez de CSV, cabeçalho errado, arquivo vazio e aspas quebradas.
- **Histórico:** toda importação fica registrada, inclusive as que falharam. Dá para abrir o relatório de novo e baixar o arquivo de correção de uma importação antiga.
- **Postos:** listagem paginada no servidor, com busca por nome, município, bandeira ou CNPJ (aceita várias palavras, como `florianopolis repsol`), ordenação por coluna e diálogo com todos os dados do posto.
- **Exportar:** baixa todos os postos num CSV que volta para o importador sem ajustes. A exportação é feita em streaming, sem carregar a base na memória.
- **Modelo CSV:** arquivo com o cabeçalho esperado e uma linha de exemplo.

## Comandos

### Backend (`backend/`)

| Comando | O que faz |
|---|---|
| `npm run dev` | API em modo watch |
| `npm run build` / `npm start` | Compila para `dist/` e roda a versão compilada |
| `npm test` | Testes unitários e de integração |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:seed` | Aplica o seed (idempotente) |
| `npm run db:setup` | Migrations + seed |
| `npm run gerar:csv` | Gera um CSV com 10 mil postos fictícios |

### Frontend (`frontend/`)

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com proxy para a API |
| `npm run build` | Checagem de tipos (`vue-tsc`) e build de produção |
| `npm run preview` | Serve o build localmente |

## Testes

```bash
cd backend
npm test
```

Os testes de integração usam um banco separado, `postos_test`, no mesmo servidor do Docker. Ele é criado automaticamente e recebe as migrations e o seed antes da execução. Para usar outro servidor, defina `TEST_DATABASE_URL`. Por segurança, o nome do banco precisa terminar em `_test`, porque as tabelas são limpas a cada teste.

A suíte cobre os validadores, a leitura do CSV, a importação ponta a ponta pela API, o arquivo de correção, a listagem e a exportação. Inclui o teste de ida e volta com o arquivo fornecido e com 10 mil linhas: exportar, reimportar e conferir que nada mudou.

## Teste de volume

```bash
cd backend
npm run gerar:csv                          # 10.000 linhas válidas
npm run gerar:csv -- 50000                 # outra quantidade
npm run gerar:csv -- 10000 --com-erros     # cerca de 3% das linhas com erros propositais
```

Os arquivos vão para `samples/gerados/`, que fica fora do git. Os dados são fictícios e reproduzíveis: a mesma quantidade gera sempre o mesmo arquivo. Os CNPJs e CPFs gerados têm dígito verificador válido e incluem casos com zero à esquerda.

Na máquina de desenvolvimento, com a API em modo dev, os tempos medidos com 10 mil postos foram:

- primeira importação, com todos os postos novos: cerca de 6 s;
- reimportação, atualizando os mesmos postos: de 2 a 3 s;
- exportação completa: menos de 1 s.

## API

Todas as rotas ficam sob `/api`. Erros seguem sempre o formato `{ "error": { "code", "message", "details" } }`.

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Saúde da API e do banco |
| `POST` | `/api/importacoes` | Importa um CSV (multipart, campo `arquivo`, até 20 MB) e devolve o relatório |
| `GET` | `/api/importacoes` | Histórico paginado (`pagina`, `porPagina`) |
| `GET` | `/api/importacoes/modelo.csv` | Modelo de CSV com cabeçalho e exemplo |
| `GET` | `/api/importacoes/:id` | Relatório de uma importação |
| `GET` | `/api/importacoes/:id/linhas-rejeitadas.csv` | Arquivo de correção com as linhas recusadas |
| `GET` | `/api/postos` | Listagem paginada (`pagina`, `porPagina`, `busca`, `ordenarPor`, `ordem`) |
| `GET` | `/api/postos/export.csv` | Exportação de todos os postos, em streaming |

## Estrutura

```
backend/
  db/migrations/        schema versionado em SQL puro
  db/seeds/             catálogo inicial de bandeiras e combustíveis
  scripts/              gerador de CSV para teste de volume
  src/
    db/                 pool, transação e runner de migrations
    modules/importacao/ leitura do CSV, validação, gravação, relatório e arquivo de correção
    modules/postos/     listagem e exportação
    shared/             erros HTTP, paginação, escrita de CSV e máscaras
  tests/                Vitest (unitários e integração)
frontend/
  src/api/              cliente HTTP e contratos da API
  src/components/       diálogo do posto e componentes da importação
  src/views/            Postos, Importar, Histórico e detalhe da importação
samples/                CSV fornecido no desafio
```

## Configuração

| Variável | Onde | Padrão |
|---|---|---|
| `PORT` | `backend/.env` | `3333` |
| `DATABASE_URL` | `backend/.env` | `postgres://postos:postos@localhost:5433/postos` |
| `TEST_DATABASE_URL` | ambiente, ao rodar os testes | `postgres://postos:postos@localhost:5433/postos_test` |
| `POSTGRES_PORT` | ambiente, ao rodar o `docker compose` | `5433` |
| `API_PROXY_TARGET` | ambiente, ao rodar o frontend | `http://localhost:3333` |

### Sem Docker

Crie um banco no seu PostgreSQL 16 e aponte o `DATABASE_URL` para ele. A primeira migration cria a extensão `unaccent`, que vem no pacote `contrib` do PostgreSQL. O usuário do banco precisa de permissão para criar extensões, ou a extensão precisa ser criada antes por um administrador. Para os testes, o usuário também precisa poder criar o banco `postos_test`.
